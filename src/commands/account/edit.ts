import { Command } from 'commander';
import ora from 'ora';
import { AccountManager } from '../../core/account-manager.js';
import { promptEditAccount, promptSelectAccount } from '../../ui/prompts.js';
import { logger } from '../../ui/logger.js';
import { UpdateAccountInput } from '../../types/account.js';

export function registerAccountEditCommand(accountCmd: Command): void {
  accountCmd
    .command('edit [alias]')
    .description('Update an existing GitHub account profile')
    .option('-u, --username <username>', 'Update GitHub username')
    .option('-e, --email <email>', 'Update Git commit email')
    .option('-g, --git-name <name>', 'Update Git author name')
    .option('-k, --key-path <path>', 'Update private SSH key path')
    .option('--json', 'Output updated profile in JSON format')
    .action(async (aliasArg, options) => {
      const manager = new AccountManager();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.warn('No accounts configured yet. Run "omx account add" first.');
        return;
      }

      let alias = aliasArg;
      let existing = alias ? manager.getAccount(alias) : undefined;

      if (!existing) {
        existing = await promptSelectAccount(accounts, 'Select an account to edit:');
        alias = existing.id;
      }

      let updateInput: UpdateAccountInput;

      if (options.username || options.email || options.gitName || options.keyPath) {
        updateInput = {
          username: options.username,
          email: options.email,
          gitUserName: options.gitName,
          sshKeyPath: options.keyPath,
        };
      } else {
        updateInput = await promptEditAccount(existing);
      }

      const spinner = ora(`Updating account '${alias}'...`).start();

      try {
        const updated = await manager.updateAccount(alias, updateInput);
        spinner.succeed(`Account '${alias}' updated successfully!`);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          logger.highlight('Username', updated.username);
          logger.highlight('Email', updated.email);
          logger.highlight('Git Author', updated.gitUserName);
          logger.highlight('SSH Host', updated.ssh.hostAlias);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Failed to update account: ${errorMsg}`);
        process.exit(1);
      }
    });
}
