import { Command } from 'commander';
import ora from 'ora';
import { AccountManager } from '../../core/account-manager.js';
import { promptSelectAccount } from '../../ui/prompts.js';
import { formatTestResult } from '../../ui/formatters.js';
import { logger } from '../../ui/logger.js';

export function registerAccountTestCommand(accountCmd: Command): void {
  accountCmd
    .command('test [alias]')
    .description('Test SSH connectivity and authentication for an account')
    .option('--all', 'Test all configured accounts')
    .option('--json', 'Output results in JSON format')
    .action(async (aliasArg, options) => {
      const manager = new AccountManager();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.warn('No accounts configured yet. Run "omx account add" first.');
        return;
      }

      if (options.all) {
        const results = [];
        for (const acc of accounts) {
          const spinner = ora(`Testing SSH connection for '${acc.id}' (${acc.ssh.hostAlias})...`).start();
          const result = await manager.testAccount(acc.id);
          if (result.authenticated) {
            spinner.succeed(`Account '${acc.id}' authenticated successfully.`);
          } else {
            spinner.fail(`Account '${acc.id}' authentication failed.`);
          }
          results.push(result);
        }

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          for (const res of results) {
            console.log('\n' + formatTestResult(res));
          }
        }
        return;
      }

      let alias = aliasArg;
      if (!alias) {
        const selected = await promptSelectAccount(accounts, 'Select an account to test SSH connection:');
        alias = selected.id;
      }

      const targetAccount = manager.getAccount(alias);
      if (!targetAccount) {
        logger.error(`Account profile '${alias}' does not exist.`);
        process.exit(1);
      }

      const spinner = ora(`Testing SSH connection to ${targetAccount.ssh.hostAlias}...`).start();
      const result = await manager.testAccount(alias);

      if (result.authenticated) {
        spinner.succeed(`SSH Authentication successful!`);
      } else {
        spinner.fail(`SSH Authentication failed.`);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n' + formatTestResult(result));
      }
    });
}
