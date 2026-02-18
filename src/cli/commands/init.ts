import fs from 'fs';
import path from 'path';
import { CommandHandler } from './index.js';
import { getProjectRoot, haanDir } from '../../utils/path-utils.js';

export const initCommand: CommandHandler = {
  name: 'init',
  description: 'Initialize haan.ai in the current project (creates .haan/ config)',
  usage: '/init',
  async execute(_args, context) {
    const root = getProjectRoot();
    const dir = haanDir();
    const lines: string[] = ['**Initializing haan.ai**\n'];

    // Create .haan directory
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      lines.push('\u2714 Created `.haan/` directory');
    } else {
      lines.push('\u2714 `.haan/` directory exists');
    }

    // Create config if missing
    const configPath = path.join(dir, 'config.json');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({
        mode: 'human',
        pipeline: { maxRetries: 3, maxAgentIterations: 25, timeout: 300000 },
      }, null, 2));
      lines.push('\u2714 Created `config.json`');
    } else {
      lines.push('\u2714 `config.json` exists');
    }

    // Create memory dir
    const memDir = path.join(dir, 'memory');
    if (!fs.existsSync(memDir)) {
      fs.mkdirSync(memDir, { recursive: true });
      lines.push('\u2714 Created `memory/` directory');
    }

    // Create logs dir
    const logDir = path.join(dir, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      lines.push('\u2714 Created `logs/` directory');
    }

    // Detect project type
    const detections: string[] = [];
    if (fs.existsSync(path.join(root, 'package.json'))) detections.push('Node.js');
    if (fs.existsSync(path.join(root, 'tsconfig.json'))) detections.push('TypeScript');
    if (fs.existsSync(path.join(root, 'requirements.txt')) || fs.existsSync(path.join(root, 'pyproject.toml'))) detections.push('Python');
    if (fs.existsSync(path.join(root, 'go.mod'))) detections.push('Go');
    if (fs.existsSync(path.join(root, 'Cargo.toml'))) detections.push('Rust');
    if (fs.existsSync(path.join(root, 'pom.xml')) || fs.existsSync(path.join(root, 'build.gradle'))) detections.push('Java');

    if (detections.length > 0) {
      lines.push(`\nDetected: **${detections.join(', ')}** project`);
    }

    // Check API keys
    lines.push('\n**API Key Status:**');
    lines.push(process.env.ANTHROPIC_API_KEY ? '\u2714 `ANTHROPIC_API_KEY` set' : '\u25CB `ANTHROPIC_API_KEY` missing');
    lines.push(process.env.OPENAI_API_KEY ? '\u2714 `OPENAI_API_KEY` set' : '\u25CB `OPENAI_API_KEY` missing');
    lines.push((process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY)
      ? '\u2714 `GOOGLE_API_KEY` set'
      : '\u25CB `GOOGLE_API_KEY` missing');

    lines.push('\nReady. Type a task or `/help` for commands.');
    context.addMessage('system', lines.join('\n'));
  },
};
