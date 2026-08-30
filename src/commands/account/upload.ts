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
    .description('Upload an account SSH public key to GitHub via 1-Click Browser, GitHub CLI, or PAT Token')
    .option('-b, --browser', 'Use 1-click browser OAuth login to authorize and upload')
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

      const spinner = ora(`Preparing SSH key upload for '${alias}' (@${targetAccount.username})...`).start();

      try {
        const result = await manager.uploadSshKey(
          alias,
          options.token,
          options.title,
          Boolean(options.browser),
          (userCode, verificationUri) => {
            spinner.stop();
            logger.box(
              `🔑 One-time Code: ${userCode}\n🌐 Verification URL: ${verificationUri}`,
              'GitHub Browser Authorization',
              'cyan'
            );

            spinner.text = `Opening browser and waiting for approval on GitHub...`;
            spinner.start();
          }
        );

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
          const methodLabel =
            result.method === 'gh'
              ? 'GitHub CLI (gh)'
              : result.method === 'oauth'
              ? 'OAuth Browser Authorization'
              : 'GitHub REST API';
          logger.highlight('Method', methodLabel);

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
          logger.dim('\nTip: You can authenticate via 1-click browser login with "--browser"');
          logger.dim('or pass a token with "--token <token>".');
          process.exit(1);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Error: ${errorMsg}`);
        process.exit(1);
      }
    });
}

