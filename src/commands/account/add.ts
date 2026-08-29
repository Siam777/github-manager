import { Command } from 'commander';
import ora from 'ora';
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
    .option('--json', 'Output result in JSON format')
    .action(async (options) => {
      const manager = new AccountManager();
      const sshService = new SshService();

      let input: CreateAccountInput;

      // If key required flags are provided, run in headless mode; otherwise launch interactive wizard
      if (options.alias && options.username && options.email) {
        input = {
          id: options.alias,
          username: options.username,
          email: options.email,
          gitUserName: options.gitName || options.username,
          sshKeyPath: options.keyPath,
          generateKey: options.keygen !== false && !options.keyPath,
          keyType: options.keyType === 'rsa' ? 'rsa' : 'ed25519',
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

        if (options.json) {
          console.log(JSON.stringify({ ...profile, publicKeyContent: pubKeyContent }, null, 2));
          return;
        }

        const guide = formatPublicKeyGuide(profile, pubKeyContent);
        logger.box(guide, 'GitHub SSH Setup Required', 'green');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Failed to add account: ${errorMsg}`);
        process.exit(1);
      }
    });
}
