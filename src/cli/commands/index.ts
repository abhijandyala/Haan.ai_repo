export interface CommandHandler {
  name: string;
  description: string;
  usage: string;
  execute(args: string, context: CommandContext): Promise<void>;
}

export interface CommandContext {
  addMessage: (role: string, content: string, agent?: string) => void;
  runPipeline: (task: string, stages?: string[]) => Promise<void>;
  getConfig: () => unknown;
  setConfig: (key: string, value: string) => void;
  setMode: (mode: 'auto' | 'human') => void;
  setView: (view: 'pipeline' | 'pong' | 'snake') => void;
  clearMessages: () => void;
}

const commands = new Map<string, CommandHandler>();

export function registerCommand(handler: CommandHandler) {
  commands.set(handler.name, handler);
}

export function getCommand(name: string): CommandHandler | undefined {
  return commands.get(name);
}

export function getAllCommands(): CommandHandler[] {
  return Array.from(commands.values());
}

// Import and register all commands
import { planCommand } from './plan.js';
import { buildCommand } from './build.js';
import { testCommand } from './test.js';
import { debugCommand } from './debug.js';
import { reviewCommand } from './review.js';
import { statusCommand } from './status.js';
import { configCommand } from './config.js';
import { modeCommand } from './mode.js';
import { memoryCommand } from './memory.js';
import { clearCommand } from './clear.js';
import { helpCommand } from './help.js';
import { costCommand } from './cost.js';
import { todoCommand } from './todo.js';
import { initCommand } from './init.js';
import { undoCommand } from './undo.js';
import { modelCommand } from './model.js';
import { doctorCommand } from './doctor.js';
import { compactCommand } from './compact.js';
import { logsCommand } from './logs.js';
import { pongCommand } from './pong.js';
import { snakeCommand } from './snake.js';
import { resumeCommand } from './resume.js';

export function registerAllCommands() {
  [
    planCommand, buildCommand, testCommand, debugCommand, reviewCommand,
    statusCommand, configCommand, modeCommand, memoryCommand,
    clearCommand, helpCommand, costCommand, todoCommand, initCommand, undoCommand,
    modelCommand, doctorCommand, compactCommand, logsCommand, pongCommand, snakeCommand, resumeCommand,
  ].forEach(cmd => registerCommand(cmd));
}
