import { Command } from 'commander';
import ora from 'ora';
import { AccountManager } from '../../core/account-manager.js';
import { promptConfirm, promptSelectAccount } from '../../ui/prompts.js';
import { logger } from '../../ui/logger.js';

export function registerAccountRemoveCommand(accountCmd: Command): void {
  accountCmd
    .command('remove [alias]')
    .alias('rm')
    .description('Remove a GitHub account profile')
    .option('-d, --delete-keys', 'Also delete the associated SSH private and public key files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (aliasArg, options) => {
      const manager = new AccountManager();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.warn('No accounts configured to remove.');
        return;
      }

      let alias = aliasArg;
      let targetAccount = alias ? manager.getAccount(alias) : undefined;

      if (!targetAccount) {
        targetAccount = await promptSelectAccount(accounts, 'Select an account to remove:');
        alias = targetAccount.id;
      }

      if (!options.yes) {
        const confirmed = await promptConfirm(
          `Are you sure you want to remove account profile '${alias}' (@${targetAccount.username})?`,
          false
        );
        if (!confirmed) {
          logger.info('Operation aborted.');
          return;
        }
      }

      const spinner = ora(`Removing account '${alias}'...`).start();

      try {
        const removed = manager.removeAccount(alias, Boolean(options.deleteKeys));
        if (removed) {
          spinner.succeed(`Account profile '${alias}' removed successfully.`);
          if (options.deleteKeys) {
            logger.dim(`SSH keys at ${targetAccount.ssh.keyPath} were deleted.`);
          }
        } else {
          spinner.fail(`Account profile '${alias}' was not found.`);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Failed to remove account: ${errorMsg}`);
        process.exit(1);
      }
    });
}
