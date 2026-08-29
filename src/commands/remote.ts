import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { AccountManager } from '../core/account-manager.js';
import { GitService } from '../core/git-service.js';
import { promptConfirm, promptSelectAccount, handleCancel } from '../ui/prompts.js';
import { logger } from '../ui/logger.js';
import { AccountProfile } from '../types/account.js';

export function registerRemoteCommand(program: Command): void {
  program
    .command('remote [repo]')
    .alias('origin')
    .description('Add or update Git remote origin and automatically bind local identity')
    .option('-a, --account <alias>', 'Account profile to bind with this remote')
    .option('-r, --remote <name>', 'Remote name', 'origin')
    .option('--init', 'Initialize a new Git repository if not already one')
    .option('--json', 'Output result in JSON format')
    .action(async (repoArg: string | undefined, options) => {
      const manager = new AccountManager();
      const gitService = new GitService();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.error('No accounts configured in octomux yet. Run "omx account add" first.');
        process.exit(1);
      }

      let inRepo = await gitService.isInsideGitRepo();
      if (!inRepo) {
        if (options.init) {
          await gitService.initRepo();
          logger.success('Initialized new Git repository in current directory.');
          inRepo = true;
        } else {
          const shouldInit = await promptConfirm(
            'Current directory is not a Git repository. Initialize git repository now?',
            true
          );
          if (shouldInit) {
            await gitService.initRepo();
            logger.success('Initialized new Git repository in current directory.');
            inRepo = true;
          } else {
            logger.error('Operation aborted: Not a Git repository.');
            process.exit(1);
          }
        }
      }

      let repoInput = repoArg;
      if (!repoInput) {
        const input = await p.text({
          message: 'Enter GitHub repository (e.g. owner/repo, https://github.com/owner/repo, or git@...):',
          placeholder: 'username/repo-name',
          validate: (val) => (!val || !val.trim() ? 'Repository is required' : undefined),
        });
        handleCancel(input);
        repoInput = input as string;
      }

      const parsedRepo = gitService.parseRepoInput(repoInput);
      if (!parsedRepo) {
        logger.error(
          `Invalid repository format: "${repoInput}".\nSupported formats:\n  - owner/repo\n  - https://github.com/owner/repo.git\n  - git@github.com:owner/repo.git`
        );
        process.exit(1);
      }

      // Resolve account
      let account: AccountProfile | undefined;
      if (options.account) {
        account = manager.getAccount(options.account);
        if (!account) {
          logger.error(`Account profile '${options.account}' not found.`);
          process.exit(1);
        }
      } else if (accounts.length === 1 && accounts[0]) {
        account = accounts[0];
      } else {
        account = await promptSelectAccount(
          accounts,
          `Select the account profile for remote '${options.remote}':`
        );
      }

      const sshRemoteUrl = gitService.formatSshCloneUrl(
        account.ssh.hostAlias,
        parsedRepo.owner,
        parsedRepo.repo
      );

      const remoteName = options.remote || 'origin';
      const existingUrl = await gitService.getRemoteUrl(remoteName);

      if (existingUrl) {
        await gitService.setRemoteUrl(remoteName, sshRemoteUrl);
        logger.success(`Updated existing remote '${remoteName}' URL.`);
      } else {
        await gitService.addRemoteUrl(remoteName, sshRemoteUrl);
        logger.success(`Added remote '${remoteName}'.`);
      }

      // Automatically configure local repository author & SSH key
      await gitService.setLocalIdentity(
        account.gitUserName,
        account.email,
        account.ssh.keyPath
      );

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: true,
              remote: remoteName,
              url: sshRemoteUrl,
              account: account.id,
              gitUserName: account.gitUserName,
              email: account.email,
              sshKey: account.ssh.keyPath,
            },
            null,
            2
          )
        );
        return;
      }

      const summaryLines = [
        pc.bold(pc.green(`Remote '${remoteName}' configured successfully!`)),
        '',
        `  ${pc.bold('Remote URL:')}  ${pc.cyan(sshRemoteUrl)}`,
        `  ${pc.bold('Account:')}     ${pc.yellow(account.id)} (@${account.username})`,
        `  ${pc.bold('Author:')}      ${account.gitUserName} <${account.email}>`,
        `  ${pc.bold('SSH Host:')}    ${pc.cyan(account.ssh.hostAlias)}`,
        '',
        pc.dim('You can now push with: git push -u ' + remoteName + ' main'),
      ];

      logger.box(summaryLines.join('\n'), 'Remote Origin Configured', 'green');
    });
}
