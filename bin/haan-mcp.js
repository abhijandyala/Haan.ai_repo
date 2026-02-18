#!/usr/bin/env node
// Start Haan.ai in MCP server mode
process.argv.push('--mcp');
import '../dist/index.js';
