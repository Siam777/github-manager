import { Command } from 'commander';
import ora from 'ora';
import { AccountManager } from '../../core/account-manager.js';
import { promptSelectAccount } from '../../ui/prompts.js';
import { formatTestResult } from '../../ui/formatters.js';
import { logger } from '../../ui/logger.js';

export function registerAccountUploadKeyCommand(accountCmd: Command): void {
  accountCmd
    .command('upload-key [alias]')
    .aliases(['upload', 'push-key'])
    .description('Upload an account SSH public key to GitHub via GitHub CLI or Personal Access Token')
    .option('-t, --token <token>', 'GitHub Personal Access Token (PAT) with write:public_key scope')
    .option('--title <title>', 'Custom title for the SSH key on GitHub')
    .option('--test', 'Test SSH authentication immediately after upload')
    .option('--json', 'Output result in JSON format')
    .action(async (aliasArg, options) => {
      const manager = new AccountManager();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.warn('No accounts configured yet. Run "omx account add" first.');
        return;
      }

      let alias = aliasArg;
      let targetAccount = alias ? manager.getAccount(alias) : undefined;

      if (!targetAccount) {
        targetAccount = await promptSelectAccount(accounts, 'Select an account to upload its SSH key to GitHub:');
        alias = targetAccount.id;
      }

      const spinner = ora(`Uploading SSH key for '${alias}' (@${targetAccount.username}) to GitHub...`).start();

      try {
        const result = await manager.uploadSshKey(alias, options.token, options.title);

        if (result.success) {
          if (result.alreadyExists) {
            spinner.info(`Key for '${alias}' is already registered on GitHub.`);
          } else {
            spinner.succeed(result.message || `SSH key uploaded successfully to @${targetAccount.username} on GitHub!`);
          }

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          logger.highlight('Account', alias);
          logger.highlight('GitHub User', `@${targetAccount.username}`);
          logger.highlight('Public Key', targetAccount.ssh.publicKeyPath);
          logger.highlight('Method', result.method === 'gh' ? 'GitHub CLI (gh)' : 'GitHub REST API');

          if (options.test) {
            const testSpinner = ora(`Testing SSH authentication for '${alias}'...`).start();
            const testResult = await manager.testAccount(alias);
            if (testResult.authenticated) {
              testSpinner.succeed(`SSH authentication successful!`);
            } else {
              testSpinner.fail(`SSH authentication failed.`);
            }
            console.log('\n' + formatTestResult(testResult));
          }
        } else {
          spinner.fail(`Failed to upload SSH key: ${result.error}`);
          logger.dim('\nTip: You can pass a token with "omx account upload-key [alias] --token <token>"');
          logger.dim('or install & log into GitHub CLI with "gh auth login".');
          process.exit(1);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Error: ${errorMsg}`);
        process.exit(1);
      }
    });
}
