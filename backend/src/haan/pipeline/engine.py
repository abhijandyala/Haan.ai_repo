"""
Pipeline engine — the main orchestrator for the Haan.ai backend.

Executes the software engineering pipeline by running CrewAI agents
through a DAG of stages with:
- Parallel execution of independent stages
- Automatic retry with debug loop on test failure
- Review-driven improvement passes
- Human-aided approval gates
- Checkpoint save/restore for crash recovery
- Budget enforcement via cost tracker

Pipeline flow:
    PLANNING -> BUILDING -> TESTING -> (pass) -> REVIEWING -> COMPLETE
                                       (fail) -> DEBUGGING -> BUILDING -> TESTING (retry)
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Literal

from crewai import Crew, Process

from haan.agents.base import create_task
from haan.agents.builder import create_builder_agent
from haan.agents.debugger import create_debugger_agent
from haan.agents.planner import create_planner_agent
from haan.agents.reviewer import create_reviewer_agent
from haan.agents.tester import create_tester_agent
from haan.config import settings
from haan.pipeline.checkpoint import load_checkpoint, remove_checkpoint, save_checkpoint
from haan.pipeline.dag import PipelineDAG
from haan.pipeline.types import (
    DEFAULT_PIPELINE_DAG,
    DEFAULT_PIPELINE_STAGES,
    PipelineStage,
    PipelineState,
    StageDependency,
    StageOutput,
)
from haan.utils.cost_tracker import BudgetExceededError, cost_tracker
from haan.utils.event_bus import event_bus
from haan.utils.logger import logger


class PipelineEngine:
    """
    The main pipeline state machine.

    Orchestrates CrewAI agents through the software engineering pipeline,
    handling stage execution, retries, improvement cycles, and checkpoints.
    """

    def __init__(self, llm: Any = None) -> None:
        """
        Initialize the pipeline engine.

        Args:
            llm: Optional LangChain LLM instance to use for all agents.
                 If None, agents use CrewAI's default LLM.
        """
        self._llm = llm
        self._state = self._create_initial_state("")
        self._stage_timeout = settings.stage_timeout / 1000  # Convert ms to seconds
        self._pending_approvals: dict[str, asyncio.Future[bool]] = {}

    @property
    def state(self) -> PipelineState:
        """Return a copy of the current pipeline state."""
        return PipelineState(
            current_stage=self._state.current_stage,
            task=self._state.task,
            mode=self._state.mode,
            outputs=dict(self._state.outputs),
            retry_count=self._state.retry_count,
            max_retries=self._state.max_retries,
            improvement_pass=self._state.improvement_pass,
            max_improvement_passes=self._state.max_improvement_passes,
            start_time=self._state.start_time,
            error=self._state.error,
            cancelled=self._state.cancelled,
        )

    async def execute(
        self,
        task: str,
        mode: Literal["auto", "human"] = "auto",
        max_retries: int | None = None,
        stages: list[PipelineStage] | None = None,
        checkpoint_path: str | None = None,
    ) -> PipelineState:
        """
        Execute the pipeline for the given task.

        Args:
            task: Natural language task description.
            mode: "auto" for fully automatic, "human" for approval gates.
            max_retries: Max retry attempts on test failure (default from config).
            stages: Optional subset of stages to run.
            checkpoint_path: Path to resume from a checkpoint.

        Returns:
            Final PipelineState after execution completes.
        """
        retries = max_retries if max_retries is not None else settings.max_retries

        # Initialize state
        self._state = self._create_initial_state(task, mode, retries)

        # Set up budget tracking
        if settings.budget_per_task > 0 or settings.budget_daily > 0:
            cost_tracker.set_budget(
                per_task=settings.budget_per_task,
                daily=settings.budget_daily,
            )
        cost_tracker.reset_task_cost()

        await event_bus.emit("pipeline:start", {"task": task, "mode": mode})
        logger.info("pipeline", f'Starting pipeline for task: "{task}" in {mode} mode')

        # Determine stages to run
        pipeline_stages = stages or list(DEFAULT_PIPELINE_STAGES)

        # Resume from checkpoint if provided
        if checkpoint_path:
            data = load_checkpoint(checkpoint_path)
            if data:
                self._state.retry_count = data.get("retry_count", 0)
                self._state.improvement_pass = data.get("improvement_pass", 0)
                completed = {PipelineStage(s) for s in data.get("completed_stages", [])}
                pipeline_stages = [s for s in pipeline_stages if s not in completed]
                logger.info(
                    "pipeline",
                    f"Resumed from checkpoint. Remaining: {[s.value for s in pipeline_stages]}",
                )

        # Build DAG for the stages
        dag_deps = self._build_dag_for_stages(pipeline_stages)

        try:
            await self._run_stages_dag(dag_deps)
            # Clean up checkpoint on success
            remove_checkpoint(task)
        except BudgetExceededError as e:
            self._state.current_stage = PipelineStage.FAILED
            self._state.error = str(e)
            logger.warn("pipeline", f"Pipeline stopped: {e}")
            await event_bus.emit("pipeline:complete", {
                "success": False,
                "summary": f"Pipeline stopped: {e}",
            })
        except Exception as e:
            self._state.current_stage = PipelineStage.FAILED
            self._state.error = str(e)
            logger.error("pipeline", f"Pipeline failed: {e}")
            await event_bus.emit("pipeline:complete", {
                "success": False,
                "summary": f"Pipeline failed: {e}",
            })

        return self.state

    async def execute_autonomous(
        self,
        task: str,
        max_iterations: int = 10,
        max_retries: int | None = None,
    ) -> PipelineState:
        """
        Execute the pipeline autonomously, looping until done or stopped.

        Flow per iteration:
          plan -> build -> test -> (pass) -> review -> (approve) -> DONE
                                   (fail) -> debug -> rebuild -> retest (up to 3 retries)
                                             review -> (improvements needed) -> next iteration

        Exit conditions:
          - All tests pass AND review approves -> success
          - Max iterations reached -> stops with best result
          - User cancels -> cancelled
        """
        retries = max_retries if max_retries is not None else settings.max_retries

        self._state = self._create_initial_state(task, "auto", retries)
        self._state.cancelled = False

        if settings.budget_per_task > 0 or settings.budget_daily > 0:
            cost_tracker.set_budget(
                per_task=settings.budget_per_task,
                daily=settings.budget_daily,
            )
        cost_tracker.reset_task_cost()

        await event_bus.emit("pipeline:start", {"task": task, "mode": "auto"})
        logger.info("pipeline", f'Starting autonomous pipeline: "{task}"')

        for iteration in range(1, max_iterations + 1):
            if self._state.cancelled:
                self._state.current_stage = PipelineStage.FAILED
                self._state.error = "Pipeline cancelled by user"
                await event_bus.emit("pipeline:cancelled", {"iteration": iteration})
                break

            await event_bus.emit("pipeline:iteration_start", {
                "iteration": iteration,
                "maxIterations": max_iterations,
            })
            logger.info("pipeline", f"Autonomous iteration {iteration}/{max_iterations}")

            try:
                # Run the full pipeline
                stages = list(DEFAULT_PIPELINE_STAGES)
                dag_deps = self._build_dag_for_stages(stages)

                # Reset retry count for this iteration
                self._state.retry_count = 0
                self._state.improvement_pass = 0

                await self._run_stages_dag(dag_deps)

                await event_bus.emit("pipeline:iteration_complete", {
                    "iteration": iteration,
                    "success": self._state.current_stage == PipelineStage.COMPLETE,
                })

                # If pipeline completed successfully, we're done
                if self._state.current_stage == PipelineStage.COMPLETE:
                    logger.info("pipeline", f"Autonomous pipeline completed on iteration {iteration}")
                    await event_bus.emit("pipeline:autonomous_complete", {
                        "iterations": iteration,
                        "success": True,
                        "summary": self._build_completion_summary(),
                    })
                    return self.state

                # If failed and not cancelled, continue to next iteration
                if self._state.cancelled:
                    break

            except BudgetExceededError as e:
                self._state.current_stage = PipelineStage.FAILED
                self._state.error = str(e)
                await event_bus.emit("pipeline:complete", {
                    "success": False,
                    "summary": f"Pipeline stopped: {e}",
                })
                return self.state
            except Exception as e:
                logger.error("pipeline", f"Iteration {iteration} error: {e}")
                # Continue to next iteration on error
                continue

        # Max iterations reached
        if not self._state.cancelled:
            await event_bus.emit("pipeline:autonomous_complete", {
                "iterations": max_iterations,
                "success": False,
                "summary": f"Max iterations ({max_iterations}) reached",
            })

        return self.state

    def cancel(self) -> None:
        """Cancel the running pipeline."""
        self._state.cancelled = True

    def approve_stage(self, stage: str, approved: bool) -> None:
        """
        Approve or reject a stage in human-aided mode.

        Called by the WebSocket handler when the user responds to
        an approval prompt.

        Args:
            stage: Stage name that was pending approval.
            approved: Whether the user approved the stage.
        """
        future = self._pending_approvals.pop(stage, None)
        if future and not future.done():
            future.set_result(approved)

    # ═══════════════════════════════════════════════
    # Internal: Stage Execution
    # ═══════════════════════════════════════════════

    async def _run_stages_dag(self, deps: list[StageDependency]) -> None:
        """
        Run stages respecting the dependency graph.

        Independent stages within the same level run in parallel.
        Handles test-failure retry loops and review improvement passes.
        """
        dag = PipelineDAG(deps)
        levels = dag.get_execution_levels()

        for level_idx, group in enumerate(levels):
            if self._state.cancelled:
                break

            if len(group) > 1:
                await event_bus.emit("pipeline:parallel_group", {
                    "stages": [s.value for s in group],
                    "level": level_idx,
                })
                logger.info("pipeline", f"Parallel group {level_idx}: {[s.value for s in group]}")

            # Run all stages in this level concurrently
            results = await asyncio.gather(
                *(self._run_single_stage(stage) for stage in group),
                return_exceptions=True,
            )

            # Process results
            for i, result in enumerate(results):
                stage = group[i]

                if isinstance(result, Exception):
                    raise result

                if result is None:
                    # Stage rejected by user in human-aided mode
                    return

                output = result

                if output.success:
                    # Handle review-driven improvement
                    if stage == PipelineStage.REVIEWING:
                        await self._handle_review_result(output)
                    continue

                # Handle test failure with retry loop
                if stage == PipelineStage.TESTING:
                    recovered = await self._handle_test_failure(output)
                    if not recovered:
                        self._state.current_stage = PipelineStage.FAILED
                        self._state.error = f"Tests failed after {self._state.retry_count} retries"
                        await event_bus.emit("pipeline:complete", {
                            "success": False,
                            "summary": (
                                f"Pipeline failed: tests did not pass after "
                                f"{self._state.retry_count} retries.\n\n"
                                f"Last output: {output.content[:500]}"
                            ),
                        })
                        return
                    continue

                # Non-test stage failure — pipeline fails immediately
                self._state.current_stage = PipelineStage.FAILED
                self._state.error = f"Stage {stage.value} failed: {output.content[:500]}"
                await event_bus.emit("pipeline:complete", {
                    "success": False,
                    "summary": (
                        f"Pipeline failed at {stage.value.upper()} stage.\n\n"
                        f"Error: {output.content[:500]}"
                    ),
                })
                return

        # All stages completed successfully
        self._state.current_stage = PipelineStage.COMPLETE
        await event_bus.emit("pipeline:complete", {
            "success": True,
            "summary": self._build_completion_summary(),
        })
        logger.info("pipeline", "Pipeline completed successfully")

    async def _run_single_stage(self, stage: PipelineStage) -> StageOutput | None:
        """
        Run a single pipeline stage with optional approval gate.

        Returns None if the user rejected the stage in human-aided mode,
        or if the pipeline was cancelled.
        """
        self._state.current_stage = stage

        # Check for cancellation before executing
        if self._state.cancelled:
            self._state.current_stage = PipelineStage.FAILED
            self._state.error = "Pipeline cancelled by user"
            await event_bus.emit("pipeline:cancelled", {"stage": stage.value})
            return None

        # Human-aided approval gate
        if self._state.mode == "human":
            approved = await self._wait_for_approval(stage)
            if not approved:
                self._state.current_stage = PipelineStage.FAILED
                self._state.error = f"User rejected stage: {stage.value}"
                await event_bus.emit("pipeline:complete", {
                    "success": False,
                    "summary": f"Pipeline stopped: user rejected {stage.value} stage",
                })
                return None

        # Execute the stage
        await event_bus.emit("pipeline:stage_start", {
            "stage": stage.value,
            "agent": stage.value,
        })

        output = await self._execute_stage(stage)
        self._state.outputs[stage] = output

        if output.success:
            await event_bus.emit("pipeline:stage_complete", {
                "stage": stage.value,
                "output": output.to_dict(),
            })
        else:
            await event_bus.emit("pipeline:stage_error", {
                "stage": stage.value,
                "error": output.content[:500],
            })

        # Save checkpoint after each stage
        try:
            cp_path = save_checkpoint(self._state)
            await event_bus.emit("pipeline:checkpoint", {
                "stage": stage.value,
                "path": cp_path,
            })
        except Exception as e:
            logger.warn("pipeline", f"Failed to save checkpoint after {stage.value}: {e}")

        return output

    async def _execute_stage(self, stage: PipelineStage) -> StageOutput:
        """
        Execute a pipeline stage by creating and running a CrewAI Crew.

        Each stage gets its own agent and task, run as a sequential Crew.
        """
        start_time = time.time()

        try:
            # Create the agent for this stage
            agent = self._create_agent_for_stage(stage)

            # Build the task description with context from previous stages
            task_description = self._build_task_description(stage)

            # Create the CrewAI task
            task = create_task(
                description=task_description,
                agent=agent,
                expected_output=f"Complete {stage.value} stage output.",
            )

            # Create and run the Crew
            crew = Crew(
                agents=[agent],
                tasks=[task],
                process=Process.sequential,
                verbose=True,
            )

            # Run the crew in a thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, crew.kickoff),
                timeout=self._stage_timeout,
            )

            duration = int((time.time() - start_time) * 1000)
            content = str(result)

            # Emit completion event
            await event_bus.emit("agent:complete", {
                "agent": stage.value,
                "output": content[:1000],
            })

            return StageOutput(
                stage=stage,
                success=True,
                content=content,
                duration=duration,
            )

        except asyncio.TimeoutError:
            duration = int((time.time() - start_time) * 1000)
            return StageOutput(
                stage=stage,
                success=False,
                content=f"Stage '{stage.value}' timed out after {self._stage_timeout}s",
                duration=duration,
            )
        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error("pipeline", f"Stage {stage.value} failed: {e}")
            return StageOutput(
                stage=stage,
                success=False,
                content=str(e),
                duration=duration,
            )

    def _create_agent_for_stage(self, stage: PipelineStage) -> Any:
        """Create the appropriate CrewAI agent for a pipeline stage."""
        agent_factories = {
            PipelineStage.PLANNING: create_planner_agent,
            PipelineStage.BUILDING: create_builder_agent,
            PipelineStage.TESTING: create_tester_agent,
            PipelineStage.DEBUGGING: create_debugger_agent,
            PipelineStage.REVIEWING: create_reviewer_agent,
        }

        factory = agent_factories.get(stage)
        if factory is None:
            raise ValueError(f"No agent defined for stage: {stage.value}")

        return factory(llm=self._llm)

    def _build_task_description(self, stage: PipelineStage) -> str:
        """
        Build the task description for a stage, incorporating context
        from previous stage outputs.
        """
        parts = [f"Task: {self._state.task}"]

        # Add context from previous stages
        for prev_stage, output in self._state.outputs.items():
            if output.success:
                preview = output.content[:2000]
                parts.append(
                    f"\n--- {prev_stage.value.upper()} stage output ---\n{preview}"
                )

        # Add retry context if applicable
        if self._state.retry_count > 0 and stage in (
            PipelineStage.DEBUGGING,
            PipelineStage.BUILDING,
        ):
            parts.append(
                f"\nThis is retry attempt {self._state.retry_count}/{self._state.max_retries}. "
                "Previous tests failed. Fix the issues identified by the debugger."
            )

        # Add improvement context if applicable
        if self._state.improvement_pass > 0 and stage in (
            PipelineStage.BUILDING,
            PipelineStage.REVIEWING,
        ):
            parts.append(
                f"\nThis is improvement pass {self._state.improvement_pass}/"
                f"{self._state.max_improvement_passes}. "
                "Address the issues identified in the review."
            )

        return "\n".join(parts)

    # ═══════════════════════════════════════════════
    # Internal: Retry and Improvement Loops
    # ═══════════════════════════════════════════════

    async def _handle_test_failure(self, failed_output: StageOutput) -> bool:
        """
        Handle test failure with debug -> rebuild -> re-test loop.

        Returns True if tests eventually pass, False if max retries exceeded.
        """
        while self._state.retry_count < self._state.max_retries:
            self._state.retry_count += 1

            await event_bus.emit("pipeline:retry", {
                "stage": PipelineStage.TESTING.value,
                "attempt": self._state.retry_count,
                "maxRetries": self._state.max_retries,
            })

            logger.info(
                "pipeline",
                f"Test failure retry {self._state.retry_count}/{self._state.max_retries}",
            )

            # Exponential backoff
            backoff = min(2 ** (self._state.retry_count - 1), 30)
            await asyncio.sleep(backoff)

            # 1. DEBUG: analyze test failures
            debug_output = await self._run_single_stage(PipelineStage.DEBUGGING)
            if debug_output is None:
                return False

            # 2. BUILD: rebuild with debug insights
            build_output = await self._run_single_stage(PipelineStage.BUILDING)
            if build_output is None:
                return False

            # 3. TEST: re-test
            test_output = await self._run_single_stage(PipelineStage.TESTING)
            if test_output is None:
                return False

            if test_output.success:
                logger.info("pipeline", f"Tests passed on retry {self._state.retry_count}")
                return True

            failed_output = test_output

        return False

    async def _handle_review_result(self, output: StageOutput) -> None:
        """
        Handle review results, potentially triggering improvement passes.

        If the review score is below threshold and we haven't exhausted
        improvement passes, re-run BUILD -> TEST -> REVIEW.
        """
        structured = output.structured or {}
        score = int(structured.get("score", 10))
        approved = structured.get("approved", True)

        if (
            not approved
            and score < 8
            and self._state.improvement_pass < self._state.max_improvement_passes
        ):
            self._state.improvement_pass += 1
            logger.info(
                "pipeline",
                f"Improvement pass {self._state.improvement_pass}/"
                f"{self._state.max_improvement_passes} (score: {score}/10)",
            )

            await event_bus.emit("pipeline:improvement", {
                "pass": self._state.improvement_pass,
                "score": score,
                "issues": structured.get("issues", []),
            })

            # Re-run BUILD -> TEST -> REVIEW
            improvement_deps = [
                StageDependency(stage=PipelineStage.BUILDING, depends_on=[]),
                StageDependency(
                    stage=PipelineStage.TESTING,
                    depends_on=[PipelineStage.BUILDING],
                ),
                StageDependency(
                    stage=PipelineStage.REVIEWING,
                    depends_on=[PipelineStage.TESTING],
                ),
            ]
            await self._run_stages_dag(improvement_deps)

    # ═══════════════════════════════════════════════
    # Internal: Approval Gates
    # ═══════════════════════════════════════════════

    async def _wait_for_approval(self, stage: PipelineStage) -> bool:
        """
        Wait for user approval in human-aided mode.

        Emits an approval_needed event and waits for the WebSocket handler
        to call approve_stage(). Times out after stage_timeout seconds.
        """
        loop = asyncio.get_event_loop()
        future: asyncio.Future[bool] = loop.create_future()
        self._pending_approvals[stage.value] = future

        summary = self._build_approval_summary(stage)
        await event_bus.emit("pipeline:approval_needed", {
            "stage": stage.value,
            "summary": summary,
        })

        try:
            return await asyncio.wait_for(future, timeout=self._stage_timeout)
        except asyncio.TimeoutError:
            logger.warn("pipeline", f"Approval timeout for stage: {stage.value}")
            return False

    def _build_approval_summary(self, stage: PipelineStage) -> str:
        """Build a summary string for the approval prompt."""
        parts = [f"Ready to execute: {stage.value.upper()}"]

        # Include previous stage info
        for prev_stage, output in self._state.outputs.items():
            parts.append(
                f"Previous ({prev_stage.value}): "
                f"{'passed' if output.success else 'failed'}"
            )

        if self._state.retry_count > 0:
            parts.append(
                f"Retry attempt: {self._state.retry_count}/{self._state.max_retries}"
            )

        return "\n".join(parts)

    # ═══════════════════════════════════════════════
    # Internal: Helpers
    # ═══════════════════════════════════════════════

    def _build_completion_summary(self) -> str:
        """Build a summary of the completed pipeline run."""
        total_duration = int((time.time() - self._state.start_time) * 1000)
        total_tokens = {"input": 0, "output": 0}

        for output in self._state.outputs.values():
            total_tokens["input"] += output.tokens_used.get("input", 0)
            total_tokens["output"] += output.tokens_used.get("output", 0)

        stage_results = "\n".join(
            f"  {stage.value}: {'passed' if out.success else 'FAILED'} ({out.duration}ms)"
            for stage, out in self._state.outputs.items()
        )

        lines = [
            f"Pipeline completed in {total_duration}ms",
            f"Retries used: {self._state.retry_count}/{self._state.max_retries}",
        ]
        if self._state.improvement_pass > 0:
            lines.append(
                f"Improvement passes: {self._state.improvement_pass}/"
                f"{self._state.max_improvement_passes}"
            )
        lines.extend([
            f"Total tokens: {total_tokens['input']} in / {total_tokens['output']} out",
            f"Stage results:\n{stage_results}",
        ])

        return "\n".join(lines)

    @staticmethod
    def _build_dag_for_stages(
        stages: list[PipelineStage],
    ) -> list[StageDependency]:
        """Build a filtered DAG for the given stages."""
        dag = PipelineDAG(DEFAULT_PIPELINE_DAG)
        return dag.filter_stages(stages)

    @staticmethod
    def _create_initial_state(
        task: str,
        mode: Literal["auto", "human"] = "auto",
        max_retries: int = 3,
    ) -> PipelineState:
        """Create the initial pipeline state."""
        return PipelineState(
            current_stage=PipelineStage.IDLE,
            task=task,
            mode=mode,
            max_retries=max_retries,
            max_improvement_passes=settings.max_improvement_passes,
            start_time=time.time(),
        )
