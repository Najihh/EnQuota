#!/usr/bin/env node

/**
 * EnQuota - Main Entrypoint
 */

import { runStdioMcpServer } from './mcp/server.js';
import { createCli } from './cli/index.js';

export * from './detector.js';
export * from './session.js';
export * from './providers/index.js';
export * from './mcp/server.js';

async function main() {
  const args = process.argv.slice(2);

  // If --mcp is present or running in piped/stdio non-tty mode without explicit CLI command
  if (args.includes('--mcp') || (!process.stdin.isTTY && !args.includes('--cli') && args.length === 0)) {
    await runStdioMcpServer();
  } else {
    const cli = createCli();
    cli.parse(process.argv);
  }
}

main().catch((err) => {
  console.error('Fatal error in EnQuota:', err);
  process.exit(1);
});
