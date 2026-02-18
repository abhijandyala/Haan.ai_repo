"""
DAG (Directed Acyclic Graph) computation for pipeline stage ordering.

Provides topological sort and parallel execution group computation
so the pipeline engine knows which stages can run concurrently and
which must wait for dependencies.
"""

from __future__ import annotations

from collections import defaultdict, deque

from haan.pipeline.types import PipelineStage, StageDependency


class PipelineDAG:
    """
    Directed Acyclic Graph for pipeline stage dependencies.

    Computes execution order using Kahn's algorithm (topological sort)
    and groups stages into parallel execution levels.
    """

    def __init__(self, dependencies: list[StageDependency]) -> None:
        """
        Initialize the DAG from a list of stage dependencies.

        Args:
            dependencies: List of StageDependency objects defining the graph edges.
        """
        self._deps = dependencies
        self._adjacency: dict[PipelineStage, list[PipelineStage]] = defaultdict(list)
        self._in_degree: dict[PipelineStage, int] = {}

        # Build the graph
        for dep in dependencies:
            if dep.stage not in self._in_degree:
                self._in_degree[dep.stage] = 0
            for parent in dep.depends_on:
                self._adjacency[parent].append(dep.stage)
                self._in_degree[dep.stage] = self._in_degree.get(dep.stage, 0) + 1
                if parent not in self._in_degree:
                    self._in_degree[parent] = 0

    def topological_sort(self) -> list[PipelineStage]:
        """
        Compute a topological ordering of the stages.

        Returns:
            List of PipelineStage values in valid execution order.

        Raises:
            ValueError: If the graph contains a cycle.
        """
        in_degree = dict(self._in_degree)
        queue: deque[PipelineStage] = deque()
        result: list[PipelineStage] = []

        # Start with stages that have no dependencies
        for stage, degree in in_degree.items():
            if degree == 0:
                queue.append(stage)

        while queue:
            stage = queue.popleft()
            result.append(stage)

            for child in self._adjacency.get(stage, []):
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    queue.append(child)

        if len(result) != len(self._in_degree):
            raise ValueError(
                "Pipeline DAG contains a cycle. "
                f"Processed {len(result)} stages out of {len(self._in_degree)}."
            )

        return result

    def get_execution_levels(self) -> list[list[PipelineStage]]:
        """
        Group stages into parallel execution levels.

        Stages within the same level have no dependencies on each other
        and can be executed concurrently.

        Returns:
            List of lists, where each inner list is a group of stages
            that can run in parallel. Groups are ordered by dependency level.
        """
        in_degree = dict(self._in_degree)
        levels: list[list[PipelineStage]] = []

        # Start with all stages that have no dependencies
        current_level = [
            stage for stage, degree in in_degree.items() if degree == 0
        ]

        while current_level:
            levels.append(sorted(current_level, key=lambda s: s.value))
            next_level: list[PipelineStage] = []

            for stage in current_level:
                for child in self._adjacency.get(stage, []):
                    in_degree[child] -= 1
                    if in_degree[child] == 0:
                        next_level.append(child)

            current_level = next_level

        return levels

    def filter_stages(self, stages: list[PipelineStage]) -> list[StageDependency]:
        """
        Filter the DAG to only include the specified stages.

        Dependencies that reference excluded stages are removed.

        Args:
            stages: List of stages to keep.

        Returns:
            Filtered list of StageDependency objects.
        """
        stage_set = set(stages)
        return [
            StageDependency(
                stage=dep.stage,
                depends_on=[d for d in dep.depends_on if d in stage_set],
            )
            for dep in self._deps
            if dep.stage in stage_set
        ]

    def get_dependencies(self, stage: PipelineStage) -> list[PipelineStage]:
        """Return the direct dependencies of a stage."""
        for dep in self._deps:
            if dep.stage == stage:
                return list(dep.depends_on)
        return []
