import { describe, it, expect } from 'vitest';
import { PipelineDAG } from '../../src/pipeline/dag.js';
import { PipelineStage, StageDependency } from '../../src/pipeline/types.js';

describe('PipelineDAG', () => {
  it('creates execution levels for a linear pipeline', () => {
    const deps: StageDependency[] = [
      { stage: PipelineStage.PLANNING, dependsOn: [] },
      { stage: PipelineStage.BUILDING, dependsOn: [PipelineStage.PLANNING] },
      { stage: PipelineStage.TESTING, dependsOn: [PipelineStage.BUILDING] },
      { stage: PipelineStage.REVIEWING, dependsOn: [PipelineStage.TESTING] },
    ];

    const dag = new PipelineDAG(deps);
    const levels = dag.getExecutionLevels();

    expect(levels).toHaveLength(4);
    expect(levels[0]).toEqual([PipelineStage.PLANNING]);
    expect(levels[1]).toEqual([PipelineStage.BUILDING]);
    expect(levels[2]).toEqual([PipelineStage.TESTING]);
    expect(levels[3]).toEqual([PipelineStage.REVIEWING]);
  });

  it('groups independent stages into the same level', () => {
    // PLANNING has no deps
    // BUILDING depends on PLANNING
    // TESTING depends on BUILDING
    // REVIEWING depends on TESTING
    // Add a hypothetical "linting" stage that only depends on PLANNING
    const LINTING = 'linting' as PipelineStage;

    const deps: StageDependency[] = [
      { stage: PipelineStage.PLANNING, dependsOn: [] },
      { stage: PipelineStage.BUILDING, dependsOn: [PipelineStage.PLANNING] },
      { stage: LINTING, dependsOn: [PipelineStage.PLANNING] },
      { stage: PipelineStage.TESTING, dependsOn: [PipelineStage.BUILDING, LINTING] },
      { stage: PipelineStage.REVIEWING, dependsOn: [PipelineStage.TESTING] },
    ];

    const dag = new PipelineDAG(deps);
    const levels = dag.getExecutionLevels();

    expect(levels).toHaveLength(4);
    expect(levels[0]).toEqual([PipelineStage.PLANNING]);
    // BUILDING and LINTING are in the same level (both only depend on PLANNING)
    expect(levels[1]).toContain(PipelineStage.BUILDING);
    expect(levels[1]).toContain(LINTING);
    expect(levels[1]).toHaveLength(2);
    expect(levels[2]).toEqual([PipelineStage.TESTING]);
    expect(levels[3]).toEqual([PipelineStage.REVIEWING]);
  });

  it('detects cycles', () => {
    const deps: StageDependency[] = [
      { stage: PipelineStage.PLANNING, dependsOn: [PipelineStage.REVIEWING] },
      { stage: PipelineStage.BUILDING, dependsOn: [PipelineStage.PLANNING] },
      { stage: PipelineStage.REVIEWING, dependsOn: [PipelineStage.BUILDING] },
    ];

    expect(() => new PipelineDAG(deps)).toThrow(/[Cc]ycle/);
  });

  it('returns topological order', () => {
    const deps: StageDependency[] = [
      { stage: PipelineStage.PLANNING, dependsOn: [] },
      { stage: PipelineStage.BUILDING, dependsOn: [PipelineStage.PLANNING] },
      { stage: PipelineStage.TESTING, dependsOn: [PipelineStage.BUILDING] },
    ];

    const dag = new PipelineDAG(deps);
    const order = dag.getTopologicalOrder();

    expect(order).toEqual([
      PipelineStage.PLANNING,
      PipelineStage.BUILDING,
      PipelineStage.TESTING,
    ]);
  });

  it('filters stages to a subset', () => {
    const deps: StageDependency[] = [
      { stage: PipelineStage.PLANNING, dependsOn: [] },
      { stage: PipelineStage.BUILDING, dependsOn: [PipelineStage.PLANNING] },
      { stage: PipelineStage.TESTING, dependsOn: [PipelineStage.BUILDING] },
      { stage: PipelineStage.REVIEWING, dependsOn: [PipelineStage.TESTING] },
    ];

    const dag = new PipelineDAG(deps);
    const filtered = dag.filterStages([PipelineStage.BUILDING, PipelineStage.TESTING]);

    expect(filtered).toEqual([
      { stage: PipelineStage.BUILDING, dependsOn: [] },
      { stage: PipelineStage.TESTING, dependsOn: [PipelineStage.BUILDING] },
    ]);
  });

  it('handles single-stage pipeline', () => {
    const deps: StageDependency[] = [
      { stage: PipelineStage.BUILDING, dependsOn: [] },
    ];

    const dag = new PipelineDAG(deps);
    const levels = dag.getExecutionLevels();

    expect(levels).toEqual([[PipelineStage.BUILDING]]);
  });

  it('handles empty pipeline', () => {
    const dag = new PipelineDAG([]);
    const levels = dag.getExecutionLevels();
    expect(levels).toEqual([]);
  });

  it('gets dependencies for a stage', () => {
    const deps: StageDependency[] = [
      { stage: PipelineStage.PLANNING, dependsOn: [] },
      { stage: PipelineStage.BUILDING, dependsOn: [PipelineStage.PLANNING] },
    ];

    const dag = new PipelineDAG(deps);
    expect(dag.getDependencies(PipelineStage.BUILDING)).toEqual([PipelineStage.PLANNING]);
    expect(dag.getDependencies(PipelineStage.PLANNING)).toEqual([]);
  });
});
