import { PipelineStage, StageDependency } from './types.js';

/**
 * Directed acyclic graph for pipeline stages.
 * Provides topological sorting and identifies parallelizable stage groups.
 */
export class PipelineDAG {
  private deps: Map<PipelineStage, Set<PipelineStage>> = new Map();
  private stages: Set<PipelineStage> = new Set();

  constructor(dependencies: StageDependency[]) {
    for (const { stage, dependsOn } of dependencies) {
      this.stages.add(stage);
      this.deps.set(stage, new Set(dependsOn));
      for (const dep of dependsOn) {
        this.stages.add(dep);
        if (!this.deps.has(dep)) {
          this.deps.set(dep, new Set());
        }
      }
    }
    this.validateNoCycles();
  }

  /**
   * Returns stages grouped by execution level.
   * Stages within the same group have no dependencies on each other
   * and can run in parallel.
   *
   * Example for PLAN->BUILD->TEST->REVIEW:
   *   [[PLANNING], [BUILDING], [TESTING], [REVIEWING]]
   *
   * Example with LINTING depending only on PLANNING:
   *   [[PLANNING], [BUILDING, LINTING], [TESTING], [REVIEWING]]
   */
  getExecutionLevels(): PipelineStage[][] {
    const levels: PipelineStage[][] = [];
    const completed = new Set<PipelineStage>();
    const remaining = new Set(this.stages);

    while (remaining.size > 0) {
      const level: PipelineStage[] = [];

      for (const stage of remaining) {
        const deps = this.deps.get(stage) || new Set();
        const allDepsCompleted = [...deps].every(d => completed.has(d));
        if (allDepsCompleted) {
          level.push(stage);
        }
      }

      if (level.length === 0) {
        throw new Error('DAG has unresolvable dependencies — possible cycle or missing stage');
      }

      // Sort within level for deterministic ordering
      level.sort();

      for (const stage of level) {
        remaining.delete(stage);
        completed.add(stage);
      }

      levels.push(level);
    }

    return levels;
  }

  /**
   * Get the flat topological order (for backward compatibility).
   */
  getTopologicalOrder(): PipelineStage[] {
    return this.getExecutionLevels().flat();
  }

  /**
   * Get direct dependencies for a stage.
   */
  getDependencies(stage: PipelineStage): PipelineStage[] {
    return [...(this.deps.get(stage) || [])];
  }

  /**
   * Check if running the given subset of stages is valid
   * (all dependencies for each stage are either in the subset or skipped).
   */
  filterStages(subset: PipelineStage[]): StageDependency[] {
    const subsetSet = new Set(subset);
    return subset.map(stage => ({
      stage,
      dependsOn: [...(this.deps.get(stage) || [])].filter(d => subsetSet.has(d)),
    }));
  }

  private validateNoCycles(): void {
    const visited = new Set<PipelineStage>();
    const inStack = new Set<PipelineStage>();

    const dfs = (stage: PipelineStage) => {
      if (inStack.has(stage)) {
        throw new Error(`Cycle detected in pipeline DAG involving stage: ${stage}`);
      }
      if (visited.has(stage)) return;
      visited.add(stage);
      inStack.add(stage);
      for (const dep of this.deps.get(stage) || []) {
        dfs(dep);
      }
      inStack.delete(stage);
    };

    for (const stage of this.stages) {
      dfs(stage);
    }
  }
}
