import { Command } from 'commander';
import * as p from '@clack/prompts';
import { AccountManager } from '../core/account-manager.js';
import { GitService } from '../core/git-service.js';
import { promptSelectAccount, handleCancel } from '../ui/prompts.js';
import { logger } from '../ui/logger.js';

export function registerSwitchCommand(program: Command): void {
  program
    .command('switch [alias]')
    .alias('use')
    .description('Switch active Git identity locally in current repository or globally')
    .option('-g, --global', 'Apply switch to global Git configuration')
    .option('-l, --local', 'Apply switch to local repository Git configuration')
    .action(async (aliasArg, options) => {
      const manager = new AccountManager();
      const gitService = new GitService();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.warn('No accounts configured yet. Run "omx account add" first.');
        return;
      }

      let targetAccount = aliasArg ? manager.getAccount(aliasArg) : undefined;
      if (!targetAccount) {
        targetAccount = await promptSelectAccount(accounts, 'Select account to switch to:');
      }

      let isGlobal = Boolean(options.global);
      let isLocal = Boolean(options.local);

      const inRepo = await gitService.isInsideGitRepo();

      // If user didn't specify --global or --local
      if (!isGlobal && !isLocal) {
        if (inRepo) {
          const scope = await p.select({
            message: `Where do you want to apply account '${targetAccount.id}'?`,
            options: [
              { value: 'local', label: 'Local Repository (Current folder only, with dedicated SSH key)' },
              { value: 'global', label: 'Global (System-wide default Git user)' },
              { value: 'both', label: 'Both Local Repository & Global' },
            ],
          });
          handleCancel(scope);

          if (scope === 'local' || scope === 'both') isLocal = true;
          if (scope === 'global' || scope === 'both') isGlobal = true;
        } else {
          isGlobal = true;
        }
      }

      if (isGlobal) {
        await manager.switchGlobal(targetAccount.id);
        logger.success(`Global Git identity switched to: ${targetAccount.gitUserName} <${targetAccount.email}>`);
      }

      if (isLocal) {
        if (!inRepo) {
          logger.error('Cannot apply local config: Current directory is not inside a Git repository.');
          process.exit(1);
        }
        await manager.switchLocal(targetAccount.id);
        logger.success(`Local repository Git identity switched to: ${targetAccount.gitUserName} <${targetAccount.email}>`);
        logger.dim(`SSH Key bound: ${targetAccount.ssh.keyPath}`);
      }
    });
}
