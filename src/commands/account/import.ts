import path from 'node:path';
import { Command } from 'commander';
import * as p from '@clack/prompts';
import ora from 'ora';
import pc from 'picocolors';
import { AccountManager } from '../../core/account-manager.js';
import { SshService } from '../../core/ssh-service.js';
import { handleCancel } from '../../ui/prompts.js';
import { logger } from '../../ui/logger.js';
import { formatPublicKeyGuide } from '../../ui/formatters.js';

export function registerAccountImportCommand(accountCmd: Command): void {
  accountCmd
    .command('import [keyPath]')
    .description('Automatically discover or import an existing SSH key as an octomux account')
    .option('-a, --alias <id>', 'Account alias identifier')
    .option('-u, --username <username>', 'GitHub username')
    .option('-e, --email <email>', 'Git commit email')
    .option('-g, --git-name <name>', 'Git author name')
    .option('--global', 'Set as default global Git identity')
    .action(async (keyPathArg, options) => {
      const manager = new AccountManager();
      const sshService = new SshService();

      let targetKeyPath = keyPathArg;
      let initialEmail = options.email || '';
      let initialUsername = options.username || '';

      if (!targetKeyPath) {
        p.intro(pc.bold(pc.cyan('octomux (omx) — Auto-Import Existing SSH Key')));

        const discovered = sshService.scanExistingSshKeys();
        if (discovered.length === 0) {
          logger.warn('No existing SSH keys found in ~/.ssh. Use "omx account add" to generate one.');
          return;
        }

        const selectedKey = await p.select({
          message: 'Select an existing SSH key to import:',
          options: discovered.map((k) => {
            const comment = k.comment ? ` (${k.comment})` : '';
            return {
              value: k.privateKeyPath,
              label: `${pc.bold(k.name)} [${k.keyType}]${comment}`,
            };
          }),
        });
        handleCancel(selectedKey);
        targetKeyPath = selectedKey as string;

        // Try extracting comment from key
        const match = discovered.find((k) => k.privateKeyPath === targetKeyPath);
        if (match?.comment) {
          if (match.comment.includes('@')) {
            initialEmail = match.comment;
          } else {
            initialUsername = match.comment;
          }
        }
      }

      const basename = path.basename(targetKeyPath).replace(/^id_(ed25519|rsa|ecdsa)_?/, '') || 'profile';
      const defaultAlias = options.alias || (basename !== 'profile' ? basename : 'imported');

      const alias = options.alias || (await p.text({
        message: 'Account alias ID (e.g. work, personal):',
        initialValue: defaultAlias,
        validate: (val) => {
          const s = val ? val.trim() : '';
          if (!s) return 'Alias is required';
          if (manager.getAccount(s)) {
            return `An account with alias '${s}' already exists. Use 'omx edit ${s}' or choose a different alias.`;
          }
          return undefined;
        },
      }));
      handleCancel(alias);

      const username = options.username || (await p.text({
        message: 'GitHub username:',
        initialValue: initialUsername,
        validate: (val) => (!val || !val.trim() ? 'Username is required' : undefined),
      }));
      handleCancel(username);

      const email = options.email || (await p.text({
        message: 'Git commit email:',
        initialValue: initialEmail,
        validate: (val) => {
          if (!val || !val.trim()) return 'Email is required';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Invalid email address';
          return undefined;
        },
      }));
      handleCancel(email);

      const gitUserName = options.gitName || (await p.text({
        message: 'Git author name:',
        initialValue: username as string,
      }));
      handleCancel(gitUserName);

      const setAsGlobal = options.global !== undefined
        ? Boolean(options.global)
        : await p.confirm({
            message: 'Set as active global Git identity?',
            initialValue: false,
          });
      handleCancel(setAsGlobal);

      const spinner = ora('Importing key and configuring SSH host...').start();

      try {
        const profile = await manager.addAccount({
          id: (alias as string).trim(),
          username: (username as string).trim(),
          email: (email as string).trim(),
          gitUserName: ((gitUserName as string) || (username as string)).trim(),
          sshKeyPath: targetKeyPath,
          generateKey: false,
          setAsGlobal: Boolean(setAsGlobal),
        });

        spinner.succeed(`Account '${profile.id}' imported successfully with key: ${path.basename(targetKeyPath)}`);

        const pubKeyContent = sshService.getPublicKey(profile.ssh.keyPath);
        const guide = formatPublicKeyGuide(profile, pubKeyContent);
        logger.box(guide, 'Account Imported', 'green');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.fail(`Failed to import account: ${errorMsg}`);
        process.exit(1);
      }
    });
}
