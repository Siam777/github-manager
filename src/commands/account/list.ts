import { Command } from 'commander';
import { AccountManager } from '../../core/account-manager.js';
import { GitService } from '../../core/git-service.js';
import { renderAccountTable } from '../../ui/table.js';

export function registerAccountListCommand(programOrAccountCmd: Command): void {
  const handler = async (options: { json?: boolean }) => {
    const manager = new AccountManager();
    const gitService = new GitService();

    const accounts = manager.listAccounts();

    if (options.json) {
      console.log(JSON.stringify(accounts, null, 2));
      return;
    }

    const activeGlobal = manager.getAccount(manager.listAccounts().find((a) => a.isDefaultGlobal)?.id || '');
    let activeLocalAlias: string | undefined;

    const isRepo = await gitService.isInsideGitRepo();
    if (isRepo) {
      const localIdentity = await gitService.getIdentity('local');
      if (localIdentity.email) {
        const match = accounts.find((a) => a.email.toLowerCase() === localIdentity.email?.toLowerCase());
        if (match) {
          activeLocalAlias = match.id;
        }
      }
    }

    console.log(renderAccountTable(accounts, activeGlobal?.id, activeLocalAlias));
  };

  programOrAccountCmd
    .command('list')
    .alias('ls')
    .description('List all configured GitHub accounts')
    .option('--json', 'Output list as JSON')
    .action(handler);
}
