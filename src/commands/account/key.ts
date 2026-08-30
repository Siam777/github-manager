import { Command } from 'commander';
import { AccountManager } from '../../core/account-manager.js';
import { SshService } from '../../core/ssh-service.js';
import { promptSelectAccount } from '../../ui/prompts.js';
import { formatPublicKeyGuide } from '../../ui/formatters.js';
import { logger } from '../../ui/logger.js';

export function registerAccountKeyCommand(accountCmd: Command): void {
  accountCmd
    .command('key [alias]')
    .aliases(['get-key', 'pubkey', 'show-key'])
    .description('View, inspect, or output the public SSH key for an account')
    .option('-r, --raw', 'Print only the raw public key string (useful for clipboard piping)')
    .option('--json', 'Output details in JSON format')
    .action(async (aliasArg, options) => {
      const manager = new AccountManager();
      const sshService = new SshService();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.warn('No accounts configured yet. Run "omx account add" first.');
        return;
      }

      let alias = aliasArg;
      let targetAccount = alias ? manager.getAccount(alias) : undefined;

      if (!targetAccount) {
        targetAccount = await promptSelectAccount(accounts, 'Select an account to view its public SSH key:');
        alias = targetAccount.id;
      }

      const pubKeyContent = sshService.getPublicKey(targetAccount.ssh.keyPath);

      if (!pubKeyContent) {
        logger.error(`Public SSH key file not found for account '${alias}' at '${targetAccount.ssh.publicKeyPath}'.`);
        process.exit(1);
      }

      if (options.raw) {
        process.stdout.write(pubKeyContent + '\n');
        return;
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              alias: targetAccount.id,
              username: targetAccount.username,
              email: targetAccount.email,
              keyType: targetAccount.ssh.keyType,
              privateKeyPath: targetAccount.ssh.keyPath,
              publicKeyPath: targetAccount.ssh.publicKeyPath,
              publicKeyContent: pubKeyContent,
            },
            null,
            2
          )
        );
        return;
      }

      const guide = formatPublicKeyGuide(targetAccount, pubKeyContent);
      logger.box(guide, `SSH Key Info: ${targetAccount.id} (@${targetAccount.username})`, 'cyan');
    });
}
