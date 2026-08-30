import { Command } from 'commander';
import ora from 'ora';
import { AccountManager } from '../../core/account-manager.js';
import { promptSelectAccount } from '../../ui/prompts.js';
import { formatTestResult } from '../../ui/formatters.js';
import { logger } from '../../ui/logger.js';

import * as p from '@clack/prompts';

export function registerAccountUploadKeyCommand(accountCmd: Command): void {
  accountCmd
    .command('upload-key [alias]')
    .aliases(['upload', 'push-key'])
    .description('Upload an account SSH public key to GitHub via 1-Click Browser, GitHub CLI, or PAT Token')
    .option('-b, --browser', 'Use 1-click browser helper to open GitHub & copy key')
    .option('--oauth', 'Use GitHub OAuth Device Flow (one-time code)')
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
          Boolean(options.oauth),
          Boolean(options.browser || !options.token && !options.oauth),
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
          if (result.method === 'browser-assisted') {
            spinner.succeed('Browser opened to GitHub SSH Settings!');
            const lines = [
              `Account:   ${targetAccount.id} (@${targetAccount.username})`,
              `Title:     octomux (${targetAccount.id})`,
              `Key:       ${result.copiedToClipboard ? '✔ [Copied to clipboard - Press Ctrl+V in browser]' : targetAccount.ssh.publicKeyPath}`,
              '',
              '👉 Step 1: In the opened browser window, paste the key into the "Key" field.',
              '👉 Step 2: Click the green "Add SSH key" button on GitHub.',
            ];
            logger.box(lines.join('\n'), '1-Click GitHub SSH Setup', 'cyan');

            if (!options.json) {
              await p.text({
                message: 'Press Enter once you have clicked "Add SSH key" on GitHub to verify...',
              });
              const testSpinner = ora(`Testing SSH authentication for '${alias}'...`).start();
              const testResult = await manager.testAccount(alias);
              if (testResult.authenticated) {
                testSpinner.succeed(`SSH authentication verified! Hi @${targetAccount.username}, you are ready!`);
              } else {
                testSpinner.info(`You can verify connection anytime with "omx test ${alias}".`);
              }
            }
          } else {
            if (result.alreadyExists) {
              spinner.info(`Key for '${alias}' is already registered on GitHub.`);
            } else {
              spinner.succeed(result.message || `SSH key uploaded successfully to @${targetAccount.username} on GitHub!`);
            }
          }

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          if (result.method !== 'browser-assisted') {
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
          }
        } else {
          spinner.fail(`Failed to upload SSH key: ${result.error}`);
          logger.dim('\nTip: You can authenticate via 1-click browser helper with "--browser"');
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

