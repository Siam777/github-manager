import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { registerAccountCommands } from './commands/account/index.js';
import { registerSwitchCommand } from './commands/switch.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCloneCommand } from './commands/clone.js';
import { registerRemoteCommand } from './commands/remote.js';
import { registerUninstallCommand } from './commands/uninstall.js';
import { handleCancel } from './ui/prompts.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('octomux')
    .description('Enterprise-grade cross-platform GitHub multi-account & SSH identity manager')
    .version('1.0.0', '-v, --version', 'Output the current version of octomux');

  // Register commands
  registerAccountCommands(program);
  registerSwitchCommand(program);
  registerStatusCommand(program);
  registerCloneCommand(program);
  registerRemoteCommand(program);
  registerUninstallCommand(program);

  // Interactive root handler if no arguments provided
  program.action(async () => {
    p.intro(pc.bold(pc.cyan('🐙 octomux (omx) — GitHub Identity & SSH Manager')));

    const action = await p.select({
      message: 'What would you like to do?',
      options: [
        { value: 'list', label: '📋 List configured accounts' },
        { value: 'add', label: '➕ Add a new GitHub account' },
        { value: 'import', label: '🔑 Auto-import existing SSH keys' },
        { value: 'switch', label: '🔀 Switch Git identity (global / local)' },
        { value: 'remote', label: '🔗 Add or set remote origin for this repo' },
        { value: 'clone', label: '📦 Smart clone a repository' },
        { value: 'status', label: '🔍 Check active Git & SSH status' },
        { value: 'test', label: '⚡ Test SSH connections' },
        { value: 'uninstall', label: '🗑️  Uninstall & clean up octomux' },
        { value: 'exit', label: '🚪 Exit' },
      ],
    });
    handleCancel(action);

    if (action === 'exit') {
      p.outro('Goodbye!');
      process.exit(0);
    }

    switch (action) {
      case 'list':
        await program.parseAsync(['node', 'octomux', 'account', 'list']);
        break;
      case 'add':
        await program.parseAsync(['node', 'octomux', 'account', 'add']);
        break;
      case 'import':
        await program.parseAsync(['node', 'octomux', 'account', 'import']);
        break;
      case 'switch':
        await program.parseAsync(['node', 'octomux', 'switch']);
        break;
      case 'remote': {
        const repo = await p.text({
          message: 'Enter GitHub repository (e.g. owner/repo, https://github.com/...):',
          validate: (val) => (!val || !val.trim() ? 'Repository is required' : undefined),
        });
        handleCancel(repo);
        await program.parseAsync(['node', 'octomux', 'remote', repo as string]);
        break;
      }
      case 'clone': {
        const repo = await p.text({
          message: 'Enter repository slug or URL (e.g. owner/repo):',
          validate: (val) => (!val || !val.trim() ? 'Repository is required' : undefined),
        });
        handleCancel(repo);
        await program.parseAsync(['node', 'octomux', 'clone', repo as string]);
        break;
      }
      case 'status':
        await program.parseAsync(['node', 'octomux', 'status']);
        break;
      case 'test':
        await program.parseAsync(['node', 'octomux', 'account', 'test']);
        break;
      case 'uninstall':
        await program.parseAsync(['node', 'octomux', 'uninstall']);
        break;
    }
  });

  return program;
}

export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
