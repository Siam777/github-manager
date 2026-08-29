import * as p from '@clack/prompts';
import pc from 'picocolors';
import { SshService } from '../core/ssh-service.js';
import { AccountProfile, CreateAccountInput, SshKeyType, UpdateAccountInput } from '../types/account.js';

export function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
}

export async function promptAddAccount(): Promise<CreateAccountInput> {
  p.intro(pc.bold(pc.cyan('octomux (omx) — Add New GitHub Account')));

  const id = await p.text({
    message: 'Enter an alias ID for this account (e.g. work, personal, opensource):',
    placeholder: 'work',
    validate: (val) => {
      if (!val || !val.trim()) return 'Alias ID is required';
      if (!/^[a-z0-9-_]+$/i.test(val)) return 'Alias must contain only alphanumeric characters, dashes, or underscores';
      return undefined;
    },
  });
  handleCancel(id);

  const username = await p.text({
    message: 'Enter GitHub username (e.g. octocat):',
    placeholder: 'octocat',
    validate: (val) => (!val || !val.trim() ? 'GitHub username is required' : undefined),
  });
  handleCancel(username);

  const email = await p.text({
    message: 'Enter Git commit email (e.g. user@example.com):',
    placeholder: 'user@example.com',
    validate: (val) => {
      if (!val || !val.trim()) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Invalid email address';
      return undefined;
    },
  });
  handleCancel(email);

  const gitUserName = await p.text({
    message: 'Enter Git author name (used in commit history):',
    placeholder: username as string,
    initialValue: username as string,
  });
  handleCancel(gitUserName);

  // Scan ~/.ssh for existing SSH keys
  const sshService = new SshService();
  const existingKeys = sshService.scanExistingSshKeys();

  const keyOptions: Array<{ value: string; label: string }> = [];

  // Add detected existing keys first
  for (const k of existingKeys) {
    const commentStr = k.comment ? ` (${k.comment})` : '';
    keyOptions.push({
      value: `existing:${k.privateKeyPath}`,
      label: `🔑 Use detected key: ${k.name} [${k.keyType}]${commentStr}`,
    });
  }

  // Generation options
  keyOptions.push(
    { value: 'generate_ed25519', label: '➕ Generate new Ed25519 key (Recommended)' },
    { value: 'generate_rsa', label: '➕ Generate new RSA 4096-bit key' },
    { value: 'manual', label: '📁 Specify a custom private key path...' }
  );

  const keyChoice = await p.select({
    message: 'SSH Key configuration:',
    options: keyOptions,
  });
  handleCancel(keyChoice);

  let generateKey = true;
  let keyType: SshKeyType = 'ed25519';
  let sshKeyPath: string | undefined;

  const keyChoiceStr = keyChoice as string;
  if (keyChoiceStr.startsWith('existing:')) {
    generateKey = false;
    sshKeyPath = keyChoiceStr.replace('existing:', '');
    keyType = sshKeyPath.includes('rsa') ? 'rsa' : 'ed25519';
  } else if (keyChoiceStr === 'generate_ed25519') {
    generateKey = true;
    keyType = 'ed25519';
  } else if (keyChoiceStr === 'generate_rsa') {
    generateKey = true;
    keyType = 'rsa';
  } else {
    generateKey = false;
    const pathInput = await p.text({
      message: 'Enter path to existing private SSH key:',
      placeholder: '~/.ssh/id_rsa',
      validate: (val) => (!val || !val.trim() ? 'Private key path is required' : undefined),
    });
    handleCancel(pathInput);
    sshKeyPath = pathInput as string;
  }

  const setAsGlobal = await p.confirm({
    message: 'Set this account as the active global Git identity now?',
    initialValue: false,
  });
  handleCancel(setAsGlobal);

  return {
    id: (id as string).trim(),
    name: (username as string).trim(),
    username: (username as string).trim(),
    email: (email as string).trim(),
    gitUserName: ((gitUserName as string) || (username as string)).trim(),
    generateKey,
    keyType,
    sshKeyPath,
    setAsGlobal: Boolean(setAsGlobal),
  };
}

export async function promptSelectAccount(
  accounts: AccountProfile[],
  message: string = 'Select an account profile:'
): Promise<AccountProfile> {
  if (accounts.length === 0) {
    throw new Error('No accounts available. Please add an account first with "omx account add".');
  }

  const selected = await p.select({
    message,
    options: accounts.map((acc) => ({
      value: acc.id,
      label: `${pc.bold(acc.id)} (@${acc.username} - ${acc.email})`,
    })),
  });
  handleCancel(selected);

  const found = accounts.find((a) => a.id === selected);
  if (!found) {
    throw new Error('Selected account not found.');
  }
  return found;
}

export async function promptEditAccount(existing: AccountProfile): Promise<UpdateAccountInput> {
  p.intro(pc.bold(pc.cyan(`Edit Account: ${existing.id}`)));

  const username = await p.text({
    message: 'GitHub username:',
    initialValue: existing.username,
  });
  handleCancel(username);

  const email = await p.text({
    message: 'Git commit email:',
    initialValue: existing.email,
  });
  handleCancel(email);

  const gitUserName = await p.text({
    message: 'Git author name:',
    initialValue: existing.gitUserName,
  });
  handleCancel(gitUserName);

  return {
    username: username as string,
    email: email as string,
    gitUserName: gitUserName as string,
  };
}

export async function promptConfirm(message: string, initialValue: boolean = false): Promise<boolean> {
  const result = await p.confirm({
    message,
    initialValue,
  });
  handleCancel(result);
  return Boolean(result);
}
