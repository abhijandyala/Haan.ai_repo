"""
Pipeline orchestration for the Haan.ai backend.

The pipeline executes software engineering tasks through a series of stages:
PLANNING -> BUILDING -> TESTING -> (pass) -> REVIEWING -> COMPLETE
                                   (fail) -> DEBUGGING -> BUILDING -> TESTING (retry loop)

Modules:
- types:      PipelineStage enum, StageOutput, PipelineState data models
- dag:        DAG computation and topological sort for stage ordering
- checkpoint: Save/restore pipeline state for crash recovery
- engine:     Main pipeline orchestrator with DAG execution, retries, and approval gates
"""
