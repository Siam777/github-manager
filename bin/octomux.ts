#!/usr/bin/env node

import { run } from '../src/index.js';
import { logger } from '../src/ui/logger.js';

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error(`An unexpected error occurred: ${message}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(message);
  process.exit(1);
});
