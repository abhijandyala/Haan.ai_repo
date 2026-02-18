import os from 'os';
import { CommandHandler } from './index.js';
import { getConfig } from '../../config/config-manager.js';
import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { haanSubDir } from '../../utils/path-utils.js';

export const doctorCommand: CommandHandler = {
  name: 'doctor',
  description: 'Diagnose setup and check system health',
  usage: '/doctor',
  async execute(_args, context) {
    const lines: string[] = ['═══ HAAN.AI DOCTOR ═══', ''];
    const config = getConfig();
    let issues = 0;

    // Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1));
    if (major >= 20) {
      lines.push(`  [OK] Node.js ${nodeVersion}`);
    } else {
      lines.push(`  [!!] Node.js ${nodeVersion} (requires v20+)`);
      issues++;
    }

    // npm
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
      lines.push(`  [OK] npm ${npmVersion}`);
    } catch {
      lines.push('  [!!] npm not found');
      issues++;
    }

    // Git
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
      lines.push(`  [OK] ${gitVersion}`);
    } catch {
      lines.push('  [!!] git not found');
      issues++;
    }

    // Git repo
    try {
      execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf-8', stdio: 'pipe' });
      lines.push('  [OK] Inside git repository');
    } catch {
      lines.push('  [--] Not a git repository (optional)');
    }

    // ripgrep (used for file-search tool)
    try {
      const rgVersion = execSync('rg --version', { encoding: 'utf-8' }).trim().split('\n')[0];
      lines.push(`  [OK] ${rgVersion}`);
    } catch {
      lines.push('  [--] ripgrep not found (file-search falls back to grep)');
    }

    lines.push('');

    // API Keys
    lines.push('  API Keys:');
    const anthropicKey = config.providers.anthropic.apiKey;
    const openaiKey = config.providers.openai.apiKey;
    const googleKey = config.providers.google.apiKey;

    if (anthropicKey && anthropicKey.length > 10) {
      lines.push(`    [OK] Anthropic  (${anthropicKey.slice(0, 8)}...)`);
    } else {
      lines.push('    [!!] Anthropic  (missing - set ANTHROPIC_API_KEY)');
      issues++;
    }

    if (openaiKey && openaiKey.length > 10) {
      lines.push(`    [OK] OpenAI     (${openaiKey.slice(0, 8)}...)`);
    } else {
      lines.push('    [!!] OpenAI     (missing - set OPENAI_API_KEY)');
      issues++;
    }

    if (googleKey && googleKey.length > 10) {
      lines.push(`    [OK] Google     (${googleKey.slice(0, 8)}...)`);
    } else {
      lines.push('    [!!] Google     (missing - set GOOGLE_AI_API_KEY or GEMINI_API_KEY)');
      issues++;
    }

    lines.push('');

    // Models with provider association
    lines.push('  Models:');
    const modelProviders: Record<string, string> = {};
    for (const [role, model] of Object.entries(config.models)) {
      let provider = 'unknown';
      if (model.startsWith('claude') || model.startsWith('anthropic')) provider = 'Anthropic';
      else if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.includes('codex')) provider = 'OpenAI';
      else if (model.startsWith('gemini')) provider = 'Google';
      modelProviders[role] = provider;

      // Check if the provider has a key
      const hasKey = (provider === 'Anthropic' && !!anthropicKey) ||
                     (provider === 'OpenAI' && !!openaiKey) ||
                     (provider === 'Google' && !!googleKey);
      const status = hasKey ? 'OK' : '!!';
      lines.push(`    [${status}] ${role.padEnd(18)} ${model.padEnd(30)} (${provider})`);
      if (!hasKey) issues++;
    }

    lines.push('');

    // Pipeline config
    lines.push('  Pipeline:');
    lines.push(`    Mode:          ${config.mode}`);
    lines.push(`    Max retries:   ${config.pipeline.maxRetries}`);
    lines.push(`    Max iters:     ${config.pipeline.maxAgentIterations}`);
    lines.push(`    Timeout:       ${config.pipeline.timeout}ms (${(config.pipeline.timeout / 1000).toFixed(0)}s)`);
    lines.push(`    Auto-approve:  ${config.autoApprove}`);

    lines.push('');

    // Config file
    const configPath = path.join(os.homedir(), '.haan', 'config.json');
    if (existsSync(configPath)) {
      lines.push(`  [OK] Config file: ${configPath}`);
    } else {
      lines.push('  [--] No config file (using defaults)');
    }

    // .env file
    if (existsSync('.env')) {
      lines.push('  [OK] .env file found');
    } else {
      lines.push('  [--] No .env file (keys loaded from environment)');
    }

    // .haan directory
    if (existsSync('.haan')) {
      lines.push('  [OK] .haan/ project directory');
    } else {
      lines.push('  [--] No .haan/ directory (run /init to set up)');
    }

    // Log files
    try {
      const logDir = haanSubDir('logs');
      const logFiles = readdirSync(logDir)
        .filter(f => f.startsWith('session-') && f.endsWith('.jsonl'))
        .sort()
        .reverse();
      if (logFiles.length > 0) {
        const latest = logFiles[0];
        const latestStat = statSync(path.join(logDir, latest));
        const sizeKB = (latestStat.size / 1024).toFixed(1);
        lines.push(`  [OK] Logs: ${logFiles.length} session(s), latest: ${latest} (${sizeKB}KB)`);
        lines.push(`       Use /logs to view, /logs --errors for failures`);
      } else {
        lines.push('  [--] No log files yet');
      }
    } catch {
      lines.push('  [--] Log directory not initialized');
    }

    lines.push('');

    // Summary
    if (issues === 0) {
      lines.push('  All checks passed! Ready to use.');
    } else {
      lines.push(`  ${issues} issue${issues > 1 ? 's' : ''} found. Fix the [!!] items above.`);
    }

    context.addMessage('system', lines.join('\n'));
  },
};
