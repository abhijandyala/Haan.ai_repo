import { describe, it, expect } from 'vitest';
import { AgentCoordinator, SubTask } from '../../src/agents/agent-coordinator.js';

describe('AgentCoordinator', () => {
  describe('parseSubTasks', () => {
    it('should parse valid subtask output', () => {
      const output = {
        subtasks: [
          { id: 'auth', description: 'Create auth middleware', agent: 'builder', dependsOn: [] },
          { id: 'model', description: 'Create user model', agent: 'builder', dependsOn: [] },
          { id: 'routes', description: 'Create API routes', agent: 'builder', dependsOn: ['auth', 'model'] },
        ],
      };

      const result = AgentCoordinator.parseSubTasks(output);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3);
      expect(result![0].id).toBe('auth');
      expect(result![0].dependsOn).toEqual([]);
      expect(result![2].dependsOn).toEqual(['auth', 'model']);
    });

    it('should handle alternative key names', () => {
      const output = {
        sub_tasks: [
          { id: 'task-0', task: 'Do something', agentName: 'tester' },
        ],
      };

      const result = AgentCoordinator.parseSubTasks(output);
      expect(result).not.toBeNull();
      expect(result![0].description).toBe('Do something');
      expect(result![0].agentName).toBe('tester');
    });

    it('should return null for invalid input', () => {
      expect(AgentCoordinator.parseSubTasks(null)).toBeNull();
      expect(AgentCoordinator.parseSubTasks('string')).toBeNull();
      expect(AgentCoordinator.parseSubTasks({ noSubtasks: true })).toBeNull();
    });

    it('should auto-generate IDs when missing', () => {
      const output = {
        subtasks: [
          { description: 'First task' },
          { description: 'Second task' },
        ],
      };

      const result = AgentCoordinator.parseSubTasks(output);
      expect(result![0].id).toBe('task-0');
      expect(result![1].id).toBe('task-1');
    });
  });
});
