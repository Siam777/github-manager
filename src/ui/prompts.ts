import fs from 'node:fs';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { ConfigStore } from '../core/config-store.js';
import { SshService } from '../core/ssh-service.js';
import { GitHubService } from '../core/github-service.js';
import { getDefaultKeyPath } from '../platform/paths.js';
import { AccountProfile, CreateAccountInput, SshKeyType, UpdateAccountInput } from '../types/account.js';

export function safeString(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

export function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
}

export async function promptAddAccount(): Promise<CreateAccountInput> {
  p.intro(pc.bold(pc.cyan('octomux (omx) — Add New GitHub Account')));

  const configStore = new ConfigStore();
  const existingAccounts = configStore.getAccounts();

  const id = await p.text({
    message: 'Enter an alias ID for this account (e.g. work, personal, opensource):',
    placeholder: 'work',
    validate: (val) => {
      const s = safeString(val);
      if (!s) return 'Alias ID is required';
      if (!/^[a-z0-9-_]+$/i.test(s)) return 'Alias must contain only alphanumeric characters, dashes, or underscores';
      if (existingAccounts[s]) {
        return `An account with alias '${s}' already exists. Use 'omx edit ${s}' to update it, or choose a different alias.`;
      }
      return undefined;
    },
  });
  handleCancel(id);

  const username = await p.text({
    message: 'Enter GitHub username (e.g. octocat):',
    placeholder: 'octocat',
    validate: (val) => (!safeString(val) ? 'GitHub username is required' : undefined),
  });
  handleCancel(username);

  const email = await p.text({
    message: 'Enter Git commit email (e.g. user@example.com):',
    placeholder: 'user@example.com',
    validate: (val) => {
      const s = safeString(val);
      if (!s) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Invalid email address';
      return undefined;
    },
  });
  handleCancel(email);

  const gitUserName = await p.text({
    message: 'Enter Git author name (used in commit history):',
    placeholder: safeString(username),
    initialValue: safeString(username),
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
  let overwriteKey = false;

  const keyChoiceStr = String(keyChoice);
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
      validate: (val) => (!safeString(val) ? 'Private key path is required' : undefined),
    });
    handleCancel(pathInput);
    sshKeyPath = safeString(pathInput);
  }

  if (generateKey) {
    const defaultPath = getDefaultKeyPath(safeString(id), keyType);
    if (fs.existsSync(defaultPath)) {
      const collisionChoice = await p.select({
        message: `An SSH key file already exists on disk for alias '${safeString(id)}':`,
        options: [
          { value: 'reuse', label: `🔑 Reuse existing key file (${defaultPath})` },
          { value: 'overwrite', label: '♻️ Overwrite and generate a fresh key' },
        ],
      });
      handleCancel(collisionChoice);
      if (collisionChoice === 'reuse') {
        generateKey = false;
        sshKeyPath = defaultPath;
      } else {
        overwriteKey = true;
      }
    }
  }

  const setAsGlobal = await p.confirm({
    message: 'Set this account as the active global Git identity now?',
    initialValue: false,
  });
  handleCancel(setAsGlobal);


  const uploadKeyConfirm = await p.confirm({
    message: 'Automatically upload this SSH key to your GitHub account?',
    initialValue: true,
  });
  handleCancel(uploadKeyConfirm);

  let token: string | undefined;
  let useBrowserAssisted = false;
  let uploadKey = Boolean(uploadKeyConfirm);

  if (uploadKey) {
    const ghService = new GitHubService();
    const ghStatus = await ghService.isGhCliAuthenticated(safeString(username));

    const authOptions: Array<{ value: string; label: string }> = [];

    if (ghStatus.available) {
      authOptions.push({
        value: 'gh',
        label: `⚡ Use GitHub CLI (gh) (Active: @${ghStatus.authenticatedUser || safeString(username)}) [Instant & 100% Automated]`,
      });
      authOptions.push({
        value: 'browser',
        label: '🌐 Browser Assisted (Copies key to clipboard & opens GitHub in browser)',
      });
    } else {
      authOptions.push({
        value: 'browser',
        label: '🌐 Browser Assisted (Copies key to clipboard & opens GitHub in browser) [Recommended]',
      });
      authOptions.push({
        value: 'gh',
        label: '⚡ Use GitHub CLI (gh)',
      });
    }

    authOptions.push(
      { value: 'pat', label: '🔑 Enter Personal Access Token (PAT)' },
      { value: 'skip', label: '📋 Skip upload (Configure manually later)' }
    );

    const authChoice = await p.select({
      message: 'Select how you want to upload your SSH key to GitHub:',
      options: authOptions,
    });
    handleCancel(authChoice);

    if (authChoice === 'gh') {
      useBrowserAssisted = false;
      uploadKey = true;
    } else if (authChoice === 'browser') {
      useBrowserAssisted = true;
      uploadKey = true;
    } else if (authChoice === 'pat') {
      useBrowserAssisted = false;
      p.note(
        'Generate a token with "write:public_key" scope in 1-click:\n👉 https://github.com/settings/tokens/new?scopes=admin:public_key,write:public_key&description=octomux',
        'Quick Token Generator'
      );
      const tokenInput = await p.text({
        message: 'Enter GitHub Personal Access Token (PAT):',
        placeholder: 'ghp_...',
        validate: (val) => (!safeString(val) ? 'Token cannot be empty (or select Skip)' : undefined),
      });
      handleCancel(tokenInput);
      token = safeString(tokenInput) || undefined;
      uploadKey = Boolean(token);
    } else {
      uploadKey = false;
      useBrowserAssisted = false;
      token = undefined;
    }
  }

  return {
    id: safeString(id),
    name: safeString(username),
    username: safeString(username),
    email: safeString(email),
    gitUserName: safeString(gitUserName) || safeString(username),
    generateKey,
    keyType,
    sshKeyPath,
    token,
    useBrowserAssisted,
    uploadKey,
    overwriteKey,
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

export interface PromptEditAccountResult {
  input: UpdateAccountInput;
  shouldTest?: boolean;
}

export async function promptEditAccount(existing: AccountProfile): Promise<PromptEditAccountResult> {
  p.intro(pc.bold(pc.cyan(`octomux (omx) — Edit Account: ${existing.id}`)));

  const action = await p.select({
    message: 'Select what you would like to update:',
    options: [
      { value: 'profile', label: '👤 Update Profile (Username, Email, Git Author Name, Display Name)' },
      { value: 'ssh', label: '🔑 Rotate / Change SSH Key (Generate new, Pick detected, Custom path)' },
      { value: 'rename', label: '🏷️  Rename Account Alias' },
      { value: 'security', label: '🛡️  Update GitHub Token / GPG Signing Key' },
      { value: 'global', label: '🌐 Set / Unset as Default Global Git Identity' },
      { value: 'full', label: '📝 Full Walkthrough (Edit all configuration fields)' },
    ],
  });
  handleCancel(action);

  const input: UpdateAccountInput = {};
  let shouldTest = false;

  if (action === 'profile' || action === 'full') {
    const name = await p.text({
      message: 'Account display label:',
      initialValue: existing.name || existing.username,
    });
    handleCancel(name);
    input.name = safeString(name);

    const username = await p.text({
      message: 'GitHub username:',
      initialValue: existing.username,
      validate: (val) => (!safeString(val) ? 'GitHub username cannot be empty' : undefined),
    });
    handleCancel(username);
    input.username = safeString(username);

    const email = await p.text({
      message: 'Git commit email:',
      initialValue: existing.email,
      validate: (val) => {
        const s = safeString(val);
        if (!s) return 'Email cannot be empty';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Invalid email address format';
        return undefined;
      },
    });
    handleCancel(email);
    input.email = safeString(email);

    const gitUserName = await p.text({
      message: 'Git author name:',
      initialValue: existing.gitUserName,
      validate: (val) => (!safeString(val) ? 'Git author name cannot be empty' : undefined),
    });
    handleCancel(gitUserName);
    input.gitUserName = safeString(gitUserName);
  }

  if (action === 'ssh' || action === 'full') {
    const sshService = new SshService();
    const existingKeys = sshService.scanExistingSshKeys();

    const keyOptions: Array<{ value: string; label: string }> = [
      { value: 'keep', label: `🔒 Keep current key (${existing.ssh.keyPath})` },
      { value: 'generate_ed25519', label: '➕ Generate new Ed25519 key (Recommended)' },
      { value: 'generate_rsa', label: '➕ Generate new RSA 4096-bit key' },
    ];

    for (const k of existingKeys) {
      if (k.privateKeyPath !== existing.ssh.keyPath) {
        const commentStr = k.comment ? ` (${k.comment})` : '';
        keyOptions.push({
          value: `existing:${k.privateKeyPath}`,
          label: `🔑 Use detected key: ${k.name} [${k.keyType}]${commentStr}`,
        });
      }
    }

    keyOptions.push({ value: 'manual', label: '📁 Specify a custom private key path...' });

    const keyChoice = await p.select({
      message: 'SSH Key configuration:',
      options: keyOptions,
    });
    handleCancel(keyChoice);

    const keyChoiceStr = String(keyChoice);
    if (keyChoiceStr === 'generate_ed25519') {
      input.generateKey = true;
      input.keyType = 'ed25519';
      shouldTest = true;
    } else if (keyChoiceStr === 'generate_rsa') {
      input.generateKey = true;
      input.keyType = 'rsa';
      shouldTest = true;
    } else if (keyChoiceStr.startsWith('existing:')) {
      input.sshKeyPath = keyChoiceStr.replace('existing:', '');
      input.generateKey = false;
      shouldTest = true;
    } else if (keyChoiceStr === 'manual') {
      const customPath = await p.text({
        message: 'Enter path to existing private SSH key:',
        placeholder: '~/.ssh/id_ed25519_custom',
        validate: (val) => (!safeString(val) ? 'Private key path is required' : undefined),
      });
      handleCancel(customPath);
      input.sshKeyPath = safeString(customPath);
      input.generateKey = false;
      shouldTest = true;
    }

    if (input.generateKey || (input.sshKeyPath && input.sshKeyPath !== existing.ssh.keyPath)) {
      const deleteOld = await p.confirm({
        message: `Delete previous SSH key file (${existing.ssh.keyPath}) from disk?`,
        initialValue: false,
      });
      handleCancel(deleteOld);
      input.deleteOldKey = Boolean(deleteOld);
    }
  }

  if (action === 'rename' || action === 'full') {
    const rename = await p.text({
      message: 'Account alias ID:',
      initialValue: existing.id,
      validate: (val) => {
        const s = safeString(val);
        if (!s) return 'Alias is required';
        if (!/^[a-z0-9-_]+$/i.test(s)) return 'Alias must contain only letters, numbers, dashes, or underscores';
        return undefined;
      },
    });
    handleCancel(rename);
    const renameStr = safeString(rename);
    if (renameStr && renameStr !== existing.id) {
      input.renameAlias = renameStr;
    }
  }

  if (action === 'security' || action === 'full') {
    const token = await p.text({
      message: 'GitHub Personal Access Token (PAT) (leave empty to unset or skip):',
      initialValue: existing.token || '',
    });
    handleCancel(token);
    input.token = safeString(token);

    const signingKey = await p.text({
      message: 'GPG Signing Key ID (optional, leave empty to unset or skip):',
      initialValue: existing.signingKey || '',
    });
    handleCancel(signingKey);
    input.signingKey = safeString(signingKey);
  }

  if (action === 'global' || action === 'full') {
    const setGlobal = await p.confirm({
      message: 'Set this account as the active global Git identity?',
      initialValue: existing.isDefaultGlobal,
    });
    handleCancel(setGlobal);
    input.setAsGlobal = Boolean(setGlobal);
  }

  const testConfirm = await p.confirm({
    message: 'Test SSH authentication with GitHub after saving?',
    initialValue: shouldTest,
  });
  handleCancel(testConfirm);
  shouldTest = Boolean(testConfirm);

  return {
    input,
    shouldTest,
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

