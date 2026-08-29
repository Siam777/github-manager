import Table from 'cli-table3';
import pc from 'picocolors';
import { AccountProfile } from '../types/account.js';

export function renderAccountTable(
  accounts: AccountProfile[],
  activeGlobalAlias?: string,
  activeLocalAlias?: string
): string {
  if (accounts.length === 0) {
    return pc.dim('No accounts configured yet. Run "omx account add" to get started.');
  }

  const table = new Table({
    head: [
      pc.bold('Active'),
      pc.bold('Alias'),
      pc.bold('GitHub User'),
      pc.bold('Git Commit Email'),
      pc.bold('Git Author Name'),
      pc.bold('SSH Host Alias'),
    ],
    style: {
      head: [],
      border: ['dim'],
    },
  });

  for (const acc of accounts) {
    const isGlobal = activeGlobalAlias === acc.id || acc.isDefaultGlobal;
    const isLocal = activeLocalAlias === acc.id;

    let statusTag = '';
    if (isGlobal && isLocal) {
      statusTag = pc.green('★ Global & Local');
    } else if (isLocal) {
      statusTag = pc.cyan('● Local');
    } else if (isGlobal) {
      statusTag = pc.green('★ Global');
    } else {
      statusTag = pc.dim('—');
    }

    table.push([
      statusTag,
      pc.bold(pc.yellow(acc.id)),
      acc.username,
      acc.email,
      acc.gitUserName,
      pc.cyan(acc.ssh.hostAlias),
    ]);
  }

  return table.toString();
}
