import { Command } from 'commander';
import { registerAccountAddCommand } from './add.js';
import { registerAccountListCommand } from './list.js';
import { registerAccountEditCommand } from './edit.js';
import { registerAccountRemoveCommand } from './remove.js';
import { registerAccountTestCommand } from './test.js';
import { registerAccountImportCommand } from './import.js';
import { registerAccountUploadKeyCommand } from './upload.js';
import { registerAccountKeyCommand } from './key.js';

export function registerAccountCommands(program: Command): void {
  const accountCmd = program
    .command('account')
    .alias('acc')
    .description('Manage GitHub account profiles and SSH configurations');

  registerAccountAddCommand(accountCmd);
  registerAccountListCommand(accountCmd);
  registerAccountEditCommand(accountCmd);
  registerAccountRemoveCommand(accountCmd);
  registerAccountTestCommand(accountCmd);
  registerAccountImportCommand(accountCmd);
  registerAccountUploadKeyCommand(accountCmd);
  registerAccountKeyCommand(accountCmd);

  // Also expose `omx ls`, `omx import`, `omx key`, `omx upload-key`, and `omx rm` / `omx delete` directly on the root program
  registerAccountListCommand(program);
  registerAccountImportCommand(program);
  registerAccountRemoveCommand(program);
  registerAccountUploadKeyCommand(program);
  registerAccountKeyCommand(program);
}



