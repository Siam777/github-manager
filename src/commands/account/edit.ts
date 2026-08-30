import { Command } from 'commander';
import ora from 'ora';
import { AccountManager } from '../../core/account-manager.js';
import { SshService } from '../../core/ssh-service.js';
import { promptEditAccount, promptSelectAccount } from '../../ui/prompts.js';
import { logger } from '../../ui/logger.js';
import { formatPublicKeyGuide, formatTestResult } from '../../ui/formatters.js';
import { UpdateAccountInput } from '../../types/account.js';

export function registerAccountEditCommand(accountCmd: Command): void {
  accountCmd
    .command('edit [alias]')
    .description('Update an existing GitHub account profile')
    .option('--name <name>', 'Update account display name')
    .option('-u, --username <username>', 'Update GitHub username')
    .option('-e, --email <email>', 'Update Git commit email')
    .option('-g, --git-name <name>', 'Update Git author name')
    .option('-k, --key-path <path>', 'Update private SSH key path')
    .option('--generate-key', 'Generate a new SSH key pair for this account')
    .option('--key-type <type>', 'SSH key type (ed25519 or rsa)', 'ed25519')
    .option('--delete-old-key', 'Delete previous SSH key files from disk if replaced')
    .option('--rename <newAlias>', 'Rename account alias identifier')
    .option('--host-alias <alias>', 'Update custom SSH Host alias')
    .option('--signing-key <keyId>', 'Update GPG commit signing key ID')
    .option('--token <token>', 'Update GitHub Personal Access Token (PAT)')
    .option('--global', 'Set this account as the active global Git identity')
    .option('--test', 'Test SSH authentication with GitHub after updating')
    .option('--json', 'Output updated profile in JSON format')
    .action(async (aliasArg, options) => {
      const manager = new AccountManager();
      const sshService = new SshService();
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
      let shouldTest = Boolean(options.test);

      const hasCliFlags = Boolean(
        options.name ||
        options.username ||
        options.email ||
        options.gitName ||
        options.keyPath ||
        options.generateKey ||
        options.deleteOldKey ||
        options.rename ||
        options.hostAlias ||
        options.signingKey !== undefined ||
        options.token !== undefined ||
        options.global
      );

      if (hasCliFlags) {
        updateInput = {
          name: options.name,
          username: options.username,
          email: options.email,
          gitUserName: options.gitName,
          sshKeyPath: options.keyPath,
          generateKey: Boolean(options.generateKey),
          keyType: options.keyType === 'rsa' ? 'rsa' : 'ed25519',
          deleteOldKey: Boolean(options.deleteOldKey),
          renameAlias: options.rename,
          hostAlias: options.hostAlias,
          signingKey: options.signingKey,
          token: options.token,
          setAsGlobal: options.global ? true : undefined,
        };
      } else {
        const promptResult = await promptEditAccount(existing);
        updateInput = promptResult.input;
        shouldTest = options.test !== undefined ? Boolean(options.test) : Boolean(promptResult.shouldTest);
      }

      const keyChanged = Boolean(
        updateInput.generateKey ||
        (updateInput.sshKeyPath && updateInput.sshKeyPath !== existing.ssh.keyPath)
      );

      const spinner = ora(`Updating account '${alias}'...`).start();

      try {
        const updated = await manager.updateAccount(alias, updateInput);
        spinner.succeed(`Account '${updated.id}' updated successfully!`);

        const pubKeyContent = sshService.getPublicKey(updated.ssh.keyPath);

        if (options.json) {
          console.log(JSON.stringify({ ...updated, publicKeyContent: pubKeyContent }, null, 2));
          return;
        }

        logger.highlight('Account Alias', updated.id);
        logger.highlight('Username', `@${updated.username}`);
        logger.highlight('Email', updated.email);
        logger.highlight('Git Author', updated.gitUserName);
        logger.highlight('SSH Host', updated.ssh.hostAlias);
        logger.highlight('SSH Key', updated.ssh.keyPath);
        if (updated.signingKey) {
          logger.highlight('GPG Signing Key', updated.signingKey);
        }
        if (updated.isDefaultGlobal) {
          logger.highlight('Global Default', 'Active');
        }

        if (keyChanged) {
          const guide = formatPublicKeyGuide(updated, pubKeyContent);
          logger.box(guide, 'GitHub SSH Key Updated', 'yellow');
        }

        if (shouldTest) {
          const testSpinner = ora(`Testing SSH authentication for '${updated.id}'...`).start();
          const testResult = await manager.testAccount(updated.id);
          if (testResult.authenticated) {
            testSpinner.succeed(`SSH authentication successful for @${testResult.username}`);
          } else {
            testSpinner.fail(`SSH authentication failed for '${updated.id}'`);
          }
          console.log(formatTestResult(testResult));
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Failed to update account: ${errorMsg}`);
        process.exit(1);
      }
    });
}

