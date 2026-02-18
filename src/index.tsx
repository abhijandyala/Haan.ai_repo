#!/usr/bin/env node
import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { loadConfig, updateConfig } from './config/config-manager.js';
import { setProjectRoot } from './utils/path-utils.js';
import { initLogger } from './utils/logger.js';
import App from './app.js';
import PongGame from './ui/games/PongGame.js';
import { HaanMcpServer } from './mcp/server.js';
import { HaanApiServer } from './api/server.js';

const headerGradient = gradient(['#06b6d4', '#8b5cf6', '#ec4899']);

function showBanner() {
  try {
    const art = figlet.textSync('haan.ai', { font: 'ANSI Shadow', horizontalLayout: 'fitted' });
    console.log(headerGradient(art));
  } catch {
    console.log(headerGradient('  haan.ai'));
  }
  console.log(chalk.hex('#6B7280')('  Autonomous Coding Agent v1.0\n'));
}

const program = new Command();

program
  .name('haan')
  .description('haan.ai - Full Autonomous Coding Agent')
  .version('1.0.0')
  .argument('[task...]', 'Task to run (non-interactive mode)')
  .option('-m, --mode <mode>', 'Operating mode: auto or human', 'human')
  .option('-d, --dir <directory>', 'Project directory', process.cwd())
  .option('-y, --yes', 'Auto-approve all pipeline stages (no confirmation prompts)', false)
  .option('--dangerously-skip-permissions', 'Skip all safety checks and tool permission gates', false)
  .option('--mcp', 'Start as MCP server (JSON-RPC over stdio)', false)
  .option('--server', 'Start as REST API server (headless mode)', false)
  .option('--port <port>', 'Port for REST API server (default: 3333)', '3333')
  .option('--dashboard', 'Start API server and open web dashboard in browser', false)
  .option('--debug', 'Enable debug logging', false)
  .action(async (taskArgs: string[], options) => {
    // Set project root
    const projectDir = options.dir || process.cwd();
    setProjectRoot(projectDir);

    // Initialize logger
    initLogger(projectDir, options.debug ? 'debug' : 'info');

    // Load config
    const config = loadConfig();

    // Override mode from CLI flag
    if (options.mode) {
      config.mode = options.mode as 'auto' | 'human';
    }

    // --yes → auto mode + auto-approve
    if (options.yes) {
      config.mode = 'auto';
      config.autoApprove = true;
    }

    // --dangerously-skip-permissions → skip safety, auto mode, auto-approve
    if (options.dangerouslySkipPermissions) {
      config.dangerouslySkipPermissions = true;
      config.autoApprove = true;
      config.mode = 'auto';
    }

    // Save config changes
    updateConfig(config);

    // MCP server mode — JSON-RPC over stdio, no UI
    if (options.mcp) {
      const mcpServer = new HaanMcpServer();
      await mcpServer.start();
      return;
    }

    // REST API / headless server mode
    if (options.server) {
      const port = parseInt(options.port, 10) || 3333;
      const apiServer = new HaanApiServer(port);
      await apiServer.start();
      return;
    }

    // Dashboard mode — start API server + open browser
    if (options.dashboard) {
      const port = parseInt(options.port, 10) || 3333;
      const apiServer = new HaanApiServer(port);
      await apiServer.start();
      // Try to open browser
      const { exec } = await import('child_process');
      const url = `http://localhost:${port}`;
      const cmd = process.platform === 'darwin' ? `open ${url}` :
                  process.platform === 'win32' ? `start ${url}` : `xdg-open ${url}`;
      exec(cmd, () => {});
      console.log(`Dashboard: ${url}`);
      return;
    }

    // If task provided as args, run non-interactively
    const inlineTask = taskArgs.join(' ').trim();

    if (inlineTask === 'pong') {
        if (!process.stdin.isTTY) {
            console.error(chalk.red('Error: Pong requires an interactive terminal (TTY).'));
            process.exit(1);
        }
        // Render the Pong Game
        const { waitUntilExit } = render(React.createElement(PongGame));
        await waitUntilExit();
        process.exit(0);
        return;
    }

    // Check if stdin supports raw mode (needed for Ink)
    const isRawModeSupported = process.stdin.isTTY === true;

    if (!isRawModeSupported && !inlineTask) {
      // Non-interactive mode - show banner and info
      showBanner();
      console.log(chalk.hex('#F87171')('  Non-interactive environment detected (no TTY).'));
      console.log(chalk.hex('#6B7280')('  Run haan.ai directly in a terminal for the full interactive experience.\n'));
      console.log(chalk.hex('#818CF8')('  Usage:'));
      console.log(chalk.hex('#6B7280')('    haan                              Start interactive mode'));
      console.log(chalk.hex('#6B7280')('    haan "Build a REST API"           Run a task directly'));
      console.log(chalk.hex('#6B7280')('    haan --mode auto "Fix the bugs"   Full auto mode'));
      console.log(chalk.hex('#6B7280')('    haan -y "Add auth"                Auto-approve all stages'));
      console.log(chalk.hex('#6B7280')('    haan --dangerously-skip-permissions "Refactor everything"'));
      console.log(chalk.hex('#6B7280')('    haan --dir /path/to/project'));
      console.log();
      console.log(chalk.hex('#FBBF24')('  API Keys:'));
      console.log(chalk.hex('#6B7280')('    Set via environment variables or ~/.haan/.env:'));
      console.log(chalk.hex('#34D399')('      ANTHROPIC_API_KEY') + chalk.hex('#6B7280')('=sk-ant-...'));
      console.log(chalk.hex('#34D399')('      OPENAI_API_KEY') + chalk.hex('#6B7280')('=sk-...'));
      console.log(chalk.hex('#34D399')('      GOOGLE_API_KEY') + chalk.hex('#6B7280')('=AI...'));
      console.log();
      console.log(chalk.hex('#34D399')('  Config: ') + chalk.hex('#6B7280')(JSON.stringify({
        mode: config.mode,
        models: config.models,
        hasAnthropicKey: !!config.providers.anthropic.apiKey,
        hasOpenAIKey: !!config.providers.openai.apiKey,
        hasGoogleKey: !!config.providers.google.apiKey,
      }, null, 2)));
      process.exit(0);
      return;
    }

    showBanner();

    // Show active flags
    if (config.dangerouslySkipPermissions) {
      console.log(chalk.hex('#F87171').bold('  ⚠ --dangerously-skip-permissions enabled'));
      console.log(chalk.hex('#6B7280')('  All safety checks and approval gates are bypassed.\n'));
    } else if (config.autoApprove) {
      console.log(chalk.hex('#FBBF24')('  ⚡ Auto-approve mode enabled (--yes)\n'));
    }

    // Show key status
    const keys = {
      anthropic: !!config.providers.anthropic.apiKey,
      openai: !!config.providers.openai.apiKey,
      google: !!config.providers.google.apiKey,
    };
    const keyStatus = Object.entries(keys)
      .map(([name, has]) => has ? chalk.hex('#34D399')() : chalk.hex('#4B5563')())
      .join('  ');
    console.log();

    // Render the Ink app
    const { waitUntilExit } = render(
      React.createElement(App, { initialTask: inlineTask || undefined }),
      { exitOnCtrlC: true },
    );

    waitUntilExit().then(() => {
      process.exit(0);
    });
  });

program.parse(process.argv);
