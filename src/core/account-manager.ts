import fs from 'node:fs';
import { ConfigStore } from './config-store.js';
import { SshService } from './ssh-service.js';
import { GitService } from './git-service.js';
import { getDefaultKeyPath } from '../platform/paths.js';
import {
  AccountProfile,
  AccountProfileSchema,
  CreateAccountInput,
  CreateAccountInputSchema,
  UpdateAccountInput,
  UpdateAccountInputSchema,
} from '../types/account.js';
import { SshHostConfig, SshTestResult } from '../types/ssh.js';

export class AccountManager {
  private readonly configStore: ConfigStore;
  private readonly sshService: SshService;
  private readonly gitService: GitService;

  constructor(configStore?: ConfigStore, sshService?: SshService, gitService?: GitService) {
    this.configStore = configStore ?? new ConfigStore();
    this.sshService = sshService ?? new SshService();
    this.gitService = gitService ?? new GitService();
  }

  /**
   * Adds a new GitHub account profile, sets up SSH key and configures SSH hosts.
   */
  public async addAccount(input: CreateAccountInput): Promise<AccountProfile> {
    const validatedInput = CreateAccountInputSchema.parse(input);
    const existing = this.configStore.getAccount(validatedInput.id);

    if (existing) {
      throw new Error(`An account with alias '${validatedInput.id}' already exists.`);
    }

    const hostAlias = validatedInput.hostAlias || `github.com-${validatedInput.id}`;
    let privateKeyPath = validatedInput.sshKeyPath;
    let publicKeyPath = '';

    if (validatedInput.generateKey || !privateKeyPath) {
      const defaultKeyPath = getDefaultKeyPath(validatedInput.id, validatedInput.keyType);
      const keyGenResult = await this.sshService.generateKeyPair(
        validatedInput.email,
        defaultKeyPath,
        validatedInput.keyType,
        `octomux-${validatedInput.id}`
      );
      privateKeyPath = keyGenResult.privateKeyPath;
      publicKeyPath = keyGenResult.publicKeyPath;
    } else {
      if (!fs.existsSync(privateKeyPath)) {
        throw new Error(`Specified private SSH key does not exist at: ${privateKeyPath}`);
      }
      publicKeyPath = `${privateKeyPath}.pub`;
      if (!fs.existsSync(publicKeyPath)) {
        publicKeyPath = privateKeyPath;
      }
    }

    const profile: AccountProfile = AccountProfileSchema.parse({
      id: validatedInput.id,
      name: validatedInput.name || validatedInput.username,
      username: validatedInput.username,
      email: validatedInput.email,
      gitUserName: validatedInput.gitUserName || validatedInput.username,
      ssh: {
        keyPath: privateKeyPath,
        publicKeyPath,
        hostAlias,
        keyType: validatedInput.keyType,
      },
      token: validatedInput.token,
      isDefaultGlobal: validatedInput.setAsGlobal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.configStore.setAccount(profile);
    this.syncAllSshHosts();

    if (validatedInput.setAsGlobal) {
      await this.gitService.setGlobalIdentity(profile.gitUserName, profile.email);
    }

    return profile;
  }

  /**
   * Updates an existing account profile.
   */
  public async updateAccount(alias: string, input: UpdateAccountInput): Promise<AccountProfile> {
    const validatedInput = UpdateAccountInputSchema.parse(input);
    const existing = this.configStore.getAccount(alias);

    if (!existing) {
      throw new Error(`Account profile '${alias}' does not exist.`);
    }

    let privateKeyPath = existing.ssh.keyPath;
    let publicKeyPath = existing.ssh.publicKeyPath;

    if (validatedInput.sshKeyPath && validatedInput.sshKeyPath !== existing.ssh.keyPath) {
      if (!fs.existsSync(validatedInput.sshKeyPath)) {
        throw new Error(`Specified SSH key does not exist at: ${validatedInput.sshKeyPath}`);
      }
      privateKeyPath = validatedInput.sshKeyPath;
      publicKeyPath = fs.existsSync(`${privateKeyPath}.pub`) ? `${privateKeyPath}.pub` : privateKeyPath;
    }

    const updated: AccountProfile = AccountProfileSchema.parse({
      ...existing,
      name: validatedInput.name ?? existing.name,
      username: validatedInput.username ?? existing.username,
      email: validatedInput.email ?? existing.email,
      gitUserName: validatedInput.gitUserName ?? existing.gitUserName,
      token: validatedInput.token !== undefined ? validatedInput.token : existing.token,
      ssh: {
        ...existing.ssh,
        keyPath: privateKeyPath,
        publicKeyPath,
        hostAlias: validatedInput.hostAlias ?? existing.ssh.hostAlias,
      },
      updatedAt: new Date().toISOString(),
    });

    this.configStore.setAccount(updated);
    this.syncAllSshHosts();

    return updated;
  }

  /**
   * Removes an account profile and optionally deletes its SSH keys.
   */
  public removeAccount(alias: string, deleteSshKey: boolean = false): boolean {
    const existing = this.configStore.getAccount(alias);
    if (!existing) {
      return false;
    }

    if (deleteSshKey) {
      try {
        if (fs.existsSync(existing.ssh.keyPath)) {
          fs.unlinkSync(existing.ssh.keyPath);
        }
        if (fs.existsSync(existing.ssh.publicKeyPath)) {
          fs.unlinkSync(existing.ssh.publicKeyPath);
        }
      } catch {
        // Ignore file delete errors
      }
    }

    const removed = this.configStore.removeAccount(alias);
    this.syncAllSshHosts();
    return removed;
  }

  /**
   * Returns a list of all configured account profiles.
   */
  public listAccounts(): AccountProfile[] {
    const accounts = this.configStore.getAccounts();
    return Object.values(accounts).sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Gets an account profile by alias.
   */
  public getAccount(alias: string): AccountProfile | undefined {
    return this.configStore.getAccount(alias);
  }

  /**
   * Switches the global Git user to the specified account.
   */
  public async switchGlobal(alias: string): Promise<AccountProfile> {
    const account = this.configStore.getAccount(alias);
    if (!account) {
      throw new Error(`Account profile '${alias}' not found.`);
    }

    await this.gitService.setGlobalIdentity(account.gitUserName, account.email);
    this.configStore.setActiveGlobal(alias);
    return account;
  }

  /**
   * Switches the local Git user in the current repository to the specified account.
   */
  public async switchLocal(alias: string, cwd?: string): Promise<AccountProfile> {
    const account = this.configStore.getAccount(alias);
    if (!account) {
      throw new Error(`Account profile '${alias}' not found.`);
    }

    await this.gitService.setLocalIdentity(
      account.gitUserName,
      account.email,
      account.ssh.keyPath,
      cwd
    );
    return account;
  }

  /**
   * Re-syncs all accounts into ~/.ssh/config.
   */
  public syncAllSshHosts(): void {
    const accounts = this.listAccounts();
    const hostConfigs: SshHostConfig[] = accounts.map((acc) => ({
      host: acc.ssh.hostAlias,
      hostName: 'github.com',
      user: 'git',
      identityFile: acc.ssh.keyPath,
      identitiesOnly: true,
    }));

    this.sshService.syncSshConfig(hostConfigs);
  }

  /**
   * Tests SSH connectivity for a specific account.
   */
  public async testAccount(alias: string): Promise<SshTestResult> {
    const account = this.configStore.getAccount(alias);
    if (!account) {
      throw new Error(`Account profile '${alias}' not found.`);
    }

    return this.sshService.testConnection(account.ssh.hostAlias, account.username);
  }
}
