import fs from 'fs';
import path from 'path';
import { CommandHandler } from './index.js';
import { getProjectRoot, haanDir } from '../../utils/path-utils.js';

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
  createdAt: number;
}

function todoPath(): string {
  return path.join(haanDir(), 'todo.json');
}

function loadTodos(): TodoItem[] {
  const p = todoPath();
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTodos(todos: TodoItem[]): void {
  fs.writeFileSync(todoPath(), JSON.stringify(todos, null, 2));
}

export const todoCommand: CommandHandler = {
  name: 'todo',
  description: 'Manage your task/todo list (add, done, remove, list)',
  usage: '/todo [add <text> | done <id> | rm <id> | clear]',
  async execute(args, context) {
    const parts = args.trim().split(/\s+/);
    const sub = parts[0]?.toLowerCase() || '';
    const todos = loadTodos();

    if (!sub || sub === 'list') {
      if (todos.length === 0) {
        context.addMessage('system', '**Todo list is empty.** Use `/todo add <task>` to add items.');
        return;
      }
      const lines = ['**Todo List**\n'];
      for (const t of todos) {
        const check = t.done ? '\u2714' : '\u25CB';
        const style = t.done ? '~~' : '';
        lines.push(`  ${check} **#${t.id}** ${style}${t.text}${style}`);
      }
      const done = todos.filter(t => t.done).length;
      lines.push(`\n${done}/${todos.length} completed`);
      context.addMessage('system', lines.join('\n'));
      return;
    }

    if (sub === 'add') {
      const text = parts.slice(1).join(' ').trim();
      if (!text) {
        context.addMessage('system', 'Usage: `/todo add <task description>`');
        return;
      }
      const nextId = todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1;
      todos.push({ id: nextId, text, done: false, createdAt: Date.now() });
      saveTodos(todos);
      context.addMessage('system', `\u2795 Added **#${nextId}**: ${text}`);
      return;
    }

    if (sub === 'done' || sub === 'check') {
      const id = parseInt(parts[1]);
      if (isNaN(id)) {
        context.addMessage('system', 'Usage: `/todo done <id>`');
        return;
      }
      const item = todos.find(t => t.id === id);
      if (!item) {
        context.addMessage('system', `No todo with id **#${id}**`);
        return;
      }
      item.done = !item.done;
      saveTodos(todos);
      context.addMessage('system', item.done
        ? `\u2714 Completed **#${id}**: ${item.text}`
        : `\u25CB Reopened **#${id}**: ${item.text}`);
      return;
    }

    if (sub === 'rm' || sub === 'remove' || sub === 'delete') {
      const id = parseInt(parts[1]);
      if (isNaN(id)) {
        context.addMessage('system', 'Usage: `/todo rm <id>`');
        return;
      }
      const idx = todos.findIndex(t => t.id === id);
      if (idx === -1) {
        context.addMessage('system', `No todo with id **#${id}**`);
        return;
      }
      const removed = todos.splice(idx, 1)[0];
      saveTodos(todos);
      context.addMessage('system', `\u{1F5D1} Removed **#${removed.id}**: ${removed.text}`);
      return;
    }

    if (sub === 'clear') {
      saveTodos([]);
      context.addMessage('system', `\u{1F5D1} Cleared all ${todos.length} todos`);
      return;
    }

    // Shorthand: /todo some text → treat as /todo add some text
    const text = args.trim();
    const nextId = todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1;
    todos.push({ id: nextId, text, done: false, createdAt: Date.now() });
    saveTodos(todos);
    context.addMessage('system', `\u2795 Added **#${nextId}**: ${text}`);
  },
};
