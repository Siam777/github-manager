import { Command } from 'commander';
import ora from 'ora';
import * as p from '@clack/prompts';
import { AccountManager } from '../../core/account-manager.js';
import { SshService } from '../../core/ssh-service.js';
import { promptAddAccount } from '../../ui/prompts.js';
import { logger } from '../../ui/logger.js';
import { formatPublicKeyGuide } from '../../ui/formatters.js';
import { CreateAccountInput } from '../../types/account.js';

export function registerAccountAddCommand(accountCmd: Command): void {
  accountCmd
    .command('add')
    .description('Add and configure a new GitHub account profile')
    .option('-a, --alias <id>', 'Account alias identifier (e.g. work, personal)')
    .option('-u, --username <username>', 'GitHub username')
    .option('-e, --email <email>', 'Git commit email')
    .option('-g, --git-name <name>', 'Git author name (defaults to username)')
    .option('-k, --key-path <path>', 'Path to existing private SSH key')
    .option('--key-type <type>', 'SSH key type (ed25519 or rsa)', 'ed25519')
    .option('--no-keygen', 'Do not generate a new SSH key')
    .option('--global', 'Set as default global Git identity')
    .option('--upload-key', 'Automatically upload generated or configured SSH key to GitHub')
    .option('-b, --browser', 'Use 1-click browser helper to open GitHub & copy key')
    .option('-t, --token <token>', 'GitHub Personal Access Token with write:public_key scope for key upload')
    .option('--overwrite-key', 'Overwrite existing SSH key file if found on disk')
    .option('--json', 'Output result in JSON format')
    .action(async (options) => {
      const manager = new AccountManager();
      const sshService = new SshService();

      let input: CreateAccountInput;
      const isHeadless = Boolean(options.alias && options.username && options.email);

      // If key required flags are provided, run in headless mode; otherwise launch interactive wizard
      if (isHeadless) {
        input = {
          id: options.alias,
          username: options.username,
          email: options.email,
          gitUserName: options.gitName || options.username,
          sshKeyPath: options.keyPath,
          generateKey: options.keygen !== false && !options.keyPath,
          keyType: options.keyType === 'rsa' ? 'rsa' : 'ed25519',
          token: options.token,
          useOAuth: Boolean(options.browser),
          useBrowserAssisted: Boolean(options.browser),
          uploadKey: Boolean(options.uploadKey || options.browser || options.token),
          overwriteKey: Boolean(options.overwriteKey),
          setAsGlobal: Boolean(options.global),
        };
      } else {
        input = await promptAddAccount();
      }


      const spinner = ora('Configuring GitHub account & SSH host...').start();

      try {
        const profile = await manager.addAccount(input);
        spinner.succeed(`Account '${profile.id}' (@${profile.username}) added successfully!`);

        const pubKeyContent = sshService.getPublicKey(profile.ssh.keyPath);

        // Attempt automatic upload if requested
        const shouldAttemptUpload = Boolean(
          input.uploadKey !== false &&
          (options.uploadKey ||
           options.browser ||
           options.token ||
           input.token ||
           input.useOAuth ||
           input.useBrowserAssisted ||
           input.uploadKey)
        );

        let uploadSuccess = false;

        if (shouldAttemptUpload) {
          const uploadSpinner = ora(`Uploading SSH key for '@${profile.username}' to GitHub...`).start();
          const uploadResult = await manager.uploadSshKey(
            profile.id,
            options.token || input.token,
            undefined,
            input.useOAuth,
            input.useBrowserAssisted || Boolean(options.browser),
            (userCode, verificationUri) => {
              uploadSpinner.stop();
              logger.box(
                `🔑 One-time Code: ${userCode}\n🌐 Verification URL: ${verificationUri}`,
                'GitHub Browser Authorization',
                'cyan'
              );
              uploadSpinner.text = 'Opening browser and waiting for approval on GitHub...';
              uploadSpinner.start();
            }
          );

          if (uploadResult.success) {
            if (uploadResult.method === 'browser-assisted') {
              uploadSpinner.succeed('Browser opened to GitHub SSH Settings!');
              const lines = [
                `Account:   ${profile.id} (@${profile.username})`,
                `Title:     octomux (${profile.id})`,
                `Key:       ${uploadResult.copiedToClipboard ? '✔ [Copied to clipboard - Press Ctrl+V in browser]' : profile.ssh.publicKeyPath}`,
                '',
                '👉 Step 1: In the opened browser window, paste the key into the "Key" field.',
                '👉 Step 2: Click the green "Add SSH key" button on GitHub.',
              ];
              logger.box(lines.join('\n'), '1-Click GitHub SSH Setup', 'cyan');

              if (!isHeadless && !options.json) {
                await p.text({
                  message: 'Press Enter once you have clicked "Add SSH key" on GitHub to verify...',
                });
                const testSpinner = ora(`Verifying SSH authentication with GitHub...`).start();
                const testResult = await manager.testAccount(profile.id);
                if (testResult.authenticated) {
                  testSpinner.succeed(`Authentication verified! Hi @${profile.username}, you are ready!`);
                  uploadSuccess = true;
                } else {
                  testSpinner.info(`You can verify connection anytime with "omx test ${profile.id}".`);
                }
              }
            } else {
              uploadSuccess = true;
              if (uploadResult.alreadyExists) {
                uploadSpinner.info(`SSH key is already registered on @${profile.username}'s GitHub account.`);
              } else {
                uploadSpinner.succeed(`Public SSH key automatically added to GitHub (@${profile.username})!`);
              }
            }
          } else {
            uploadSpinner.warn(`Auto-upload skipped: ${uploadResult.error}`);
          }
        }

        if (options.json) {
          console.log(JSON.stringify({ ...profile, publicKeyContent: pubKeyContent }, null, 2));
          return;
        }



        if (uploadSuccess) {
          logger.highlight('Account Alias', profile.id);
          logger.highlight('Username', `@${profile.username}`);
          logger.highlight('SSH Host', profile.ssh.hostAlias);
          logger.highlight('SSH Key', profile.ssh.keyPath);
          logger.success('Your GitHub account is fully authenticated and ready for git operations!');
        } else {
          const guide = formatPublicKeyGuide(profile, pubKeyContent);
          logger.box(guide, 'GitHub SSH Setup Required', 'green');
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Failed to add account: ${errorMsg}`);
        process.exit(1);
      }
    });

}
