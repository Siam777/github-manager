import { Command } from 'commander';
import pc from 'picocolors';
import { AccountManager } from '../core/account-manager.js';
import { GitService } from '../core/git-service.js';
import { logger } from '../ui/logger.js';

export function registerStatusCommand(program: Command): void {
  const handler = async (options: { json?: boolean }) => {
    const manager = new AccountManager();
    const gitService = new GitService();
    const accounts = manager.listAccounts();

    const globalIdentity = await gitService.getIdentity('global');
    const inRepo = await gitService.isInsideGitRepo();
    let localIdentity;
    let repoRoot: string | undefined;
    let remoteUrl: string | undefined;

    if (inRepo) {
      localIdentity = await gitService.getIdentity('local');
      repoRoot = await gitService.getRepoRoot();
      remoteUrl = await gitService.getRemoteUrl();
    }

    const matchedGlobal = accounts.find(
      (a) => a.email.toLowerCase() === globalIdentity.email?.toLowerCase()
    );
    const matchedLocal = localIdentity?.email
      ? accounts.find((a) => a.email.toLowerCase() === localIdentity?.email?.toLowerCase())
      : undefined;

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            inRepo,
            repoRoot,
            remoteUrl,
            global: {
              ...globalIdentity,
              matchedAccount: matchedGlobal?.id,
            },
            local: inRepo
              ? {
                  ...localIdentity,
                  matchedAccount: matchedLocal?.id,
                }
              : null,
          },
          null,
          2
        )
      );
      return;
    }

    const lines: string[] = [];

    lines.push(pc.bold(pc.cyan('● Global Git Configuration:')));
    lines.push(
      `  Author: ${globalIdentity.name || pc.dim('(not set)')} <${
        globalIdentity.email || pc.dim('(not set)')
      }>`
    );
    if (matchedGlobal) {
      lines.push(`  Profile: ${pc.yellow(matchedGlobal.id)} (@${matchedGlobal.username})`);
    } else {
      lines.push(`  Profile: ${pc.dim('No matching octomux profile')}`);
    }

    lines.push('');

    if (inRepo) {
      lines.push(pc.bold(pc.green('● Current Local Repository:')));
      lines.push(`  Path:   ${repoRoot}`);
      if (remoteUrl) {
        lines.push(`  Remote: ${pc.dim(remoteUrl)}`);
      }
      lines.push(
        `  Author: ${localIdentity?.name || pc.dim('(inherited from global)')} <${
          localIdentity?.email || pc.dim('(inherited from global)')
        }>`
      );
      if (localIdentity?.sshCommand) {
        lines.push(`  SSH:    ${pc.dim(localIdentity.sshCommand)}`);
      }
      if (matchedLocal) {
        lines.push(`  Profile: ${pc.yellow(matchedLocal.id)} (@${matchedLocal.username})`);
      }
    } else {
      lines.push(pc.bold(pc.dim('● Current Directory is not a Git repository.')));
    }

    logger.box(lines.join('\n'), 'Git & Identity Status', inRepo ? 'green' : 'cyan');
  };

  program
    .command('status')
    .alias('current')
    .description('Show active Git identities (global & local repository) and profile match')
    .option('--json', 'Output status as JSON')
    .action(handler);
}
