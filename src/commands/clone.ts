import path from 'node:path';
import fs from 'node:fs';
import { Command } from 'commander';
import ora from 'ora';
import { AccountManager } from '../core/account-manager.js';
import { GitService } from '../core/git-service.js';
import { promptSelectAccount } from '../ui/prompts.js';
import { formatCloneSummary } from '../ui/formatters.js';
import { logger } from '../ui/logger.js';
import { AccountProfile } from '../types/account.js';

export function registerCloneCommand(program: Command): void {
  program
    .command('clone <repo> [directory]')
    .description('Smart clone a GitHub repository and automatically configure local identity')
    .option('-a, --account <alias>', 'Account profile to clone and bind with')
    .option('--json', 'Output clone result as JSON')
    .allowUnknownOption(false)
    .action(async (repoInput: string, directoryArg: string | undefined, options) => {
      const manager = new AccountManager();
      const gitService = new GitService();
      const accounts = manager.listAccounts();

      if (accounts.length === 0) {
        logger.error('No accounts configured in octomux yet. Please run "omx account add" first.');
        process.exit(1);
      }

      // Parse repository input
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
          `Select the account to clone ${parsedRepo.owner}/${parsedRepo.repo}:`
        );
      }

      const sshCloneUrl = gitService.formatSshCloneUrl(
        account.ssh.hostAlias,
        parsedRepo.owner,
        parsedRepo.repo
      );

      logger.info(`Cloning with profile ${account.id} using SSH host: ${account.ssh.hostAlias}`);

      try {
        const clonedDirName = await gitService.clone(sshCloneUrl, directoryArg);
        const resolvedPath = path.resolve(process.cwd(), clonedDirName);

        // Verify the directory exists
        if (fs.existsSync(resolvedPath)) {
          const spinner = ora('Binding local Git author & SSH key configuration...').start();
          await gitService.setLocalIdentity(
            account.gitUserName,
            account.email,
            account.ssh.keyPath,
            resolvedPath
          );
          spinner.succeed('Local Git identity configured!');

          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  success: true,
                  repository: `${parsedRepo.owner}/${parsedRepo.repo}`,
                  path: resolvedPath,
                  account: account.id,
                  gitUserName: account.gitUserName,
                  email: account.email,
                  sshKey: account.ssh.keyPath,
                },
                null,
                2
              )
            );
          } else {
            const summary = formatCloneSummary(
              `${parsedRepo.owner}/${parsedRepo.repo}`,
              resolvedPath,
              account
            );
            logger.box(summary, 'Smart Clone Complete', 'green');
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Git clone failed: ${errorMsg}`);
        process.exit(1);
      }
    });
}
