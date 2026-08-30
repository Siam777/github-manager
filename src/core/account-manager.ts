import fs from 'node:fs';
import path from 'node:path';
import { ConfigStore } from './config-store.js';
import { SshService } from './ssh-service.js';

import { GitService } from './git-service.js';
import { GitHubService, UploadKeyResult } from './github-service.js';
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
  private readonly githubService: GitHubService;

  constructor(
    configStore?: ConfigStore,
    sshService?: SshService,
    gitService?: GitService,
    githubService?: GitHubService
  ) {
    this.configStore = configStore ?? new ConfigStore();
    this.sshService = sshService ?? new SshService();
    this.gitService = gitService ?? new GitService();
    this.githubService = githubService ?? new GitHubService();
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

    const targetId = validatedInput.renameAlias && validatedInput.renameAlias !== alias
      ? validatedInput.renameAlias
      : alias;

    if (targetId !== alias) {
      const alreadyTaken = this.configStore.getAccount(targetId);
      if (alreadyTaken) {
        throw new Error(`Cannot rename alias to '${targetId}': An account with this alias already exists.`);
      }
    }

    const oldPrivateKeyPath = existing.ssh.keyPath;
    const oldPublicKeyPath = existing.ssh.publicKeyPath;
    const keyType = validatedInput.keyType ?? existing.ssh.keyType ?? 'ed25519';

    let privateKeyPath = existing.ssh.keyPath;
    let publicKeyPath = existing.ssh.publicKeyPath;
    let newKeyGenerated = false;

    if (validatedInput.generateKey) {
      let targetKeyPath = path.join(this.sshService.getSshDir(), `id_${keyType}_octomux_${targetId}`);
      if (fs.existsSync(targetKeyPath)) {
        targetKeyPath = path.join(this.sshService.getSshDir(), `id_${keyType}_octomux_${targetId}_${Date.now()}`);
      }

      const keyGenResult = await this.sshService.generateKeyPair(
        validatedInput.email ?? existing.email,
        targetKeyPath,
        keyType,
        `octomux-${targetId}`
      );
      privateKeyPath = keyGenResult.privateKeyPath;
      publicKeyPath = keyGenResult.publicKeyPath;
      newKeyGenerated = true;
    } else if (validatedInput.sshKeyPath && validatedInput.sshKeyPath !== existing.ssh.keyPath) {
      if (!fs.existsSync(validatedInput.sshKeyPath)) {
        throw new Error(`Specified SSH key does not exist at: ${validatedInput.sshKeyPath}`);
      }
      privateKeyPath = validatedInput.sshKeyPath;
      publicKeyPath = fs.existsSync(`${privateKeyPath}.pub`) ? `${privateKeyPath}.pub` : privateKeyPath;
    }

    // Safely cleanup old SSH keys if requested and key has changed
    if (validatedInput.deleteOldKey && (newKeyGenerated || privateKeyPath !== oldPrivateKeyPath)) {
      try {
        if (fs.existsSync(oldPrivateKeyPath) && oldPrivateKeyPath !== privateKeyPath) {
          fs.unlinkSync(oldPrivateKeyPath);
        }
        if (fs.existsSync(oldPublicKeyPath) && oldPublicKeyPath !== publicKeyPath) {
          fs.unlinkSync(oldPublicKeyPath);
        }
      } catch {
        // Ignore deletion errors
      }
    }

    // Determine host alias: if alias renamed and old hostAlias was default github.com-<old>, update to github.com-<new>
    let hostAlias = validatedInput.hostAlias ?? existing.ssh.hostAlias;
    if (targetId !== alias && !validatedInput.hostAlias && existing.ssh.hostAlias === `github.com-${alias}`) {
      hostAlias = `github.com-${targetId}`;
    }

    const setAsGlobal = validatedInput.setAsGlobal !== undefined
      ? validatedInput.setAsGlobal
      : existing.isDefaultGlobal;

    const updated: AccountProfile = AccountProfileSchema.parse({
      id: targetId,
      name: validatedInput.name ?? (targetId !== alias && existing.name === alias ? targetId : existing.name),
      username: validatedInput.username ?? existing.username,
      email: validatedInput.email ?? existing.email,
      gitUserName: validatedInput.gitUserName ?? existing.gitUserName,
      signingKey: validatedInput.signingKey !== undefined
        ? (validatedInput.signingKey.trim() ? validatedInput.signingKey.trim() : undefined)
        : existing.signingKey,
      token: validatedInput.token !== undefined
        ? (validatedInput.token.trim() ? validatedInput.token.trim() : undefined)
        : existing.token,
      ssh: {
        keyPath: privateKeyPath,
        publicKeyPath,
        hostAlias,
        keyType,
      },
      isDefaultGlobal: setAsGlobal,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });

    if (targetId !== alias) {
      this.configStore.removeAccount(alias);
    }

    this.configStore.setAccount(updated);
    this.syncAllSshHosts();

    const activeGlobal = this.configStore.getActiveGlobal();
    const isCurrentlyActiveGlobal = activeGlobal?.id === alias || activeGlobal?.id === targetId || setAsGlobal;

    if (isCurrentlyActiveGlobal) {
      if (setAsGlobal || validatedInput.email || validatedInput.gitUserName) {
        await this.gitService.setGlobalIdentity(updated.gitUserName, updated.email);
      }
      this.configStore.setActiveGlobal(targetId);
    }

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

  /**
   * Automatically uploads an account's public SSH key to GitHub using OAuth Browser, GitHub CLI, or Personal Access Token.
   */
  public async uploadSshKey(
    alias: string,
    customToken?: string,
    customTitle?: string,
    useOAuth?: boolean,
    onDeviceCode?: (userCode: string, verificationUri: string) => void
  ): Promise<UploadKeyResult> {
    const account = this.configStore.getAccount(alias);
    if (!account) {
      throw new Error(`Account profile '${alias}' not found.`);
    }

    const publicKeyContent = this.sshService.getPublicKey(account.ssh.keyPath);
    if (!publicKeyContent) {
      throw new Error(`Public key not found for account '${alias}' at '${account.ssh.publicKeyPath}'.`);
    }

    const result = await this.githubService.autoUploadKey({
      publicKeyPath: account.ssh.publicKeyPath,
      publicKeyContent,
      accountAlias: account.id,
      username: account.username,
      token: customToken || account.token,
      customTitle,
      useOAuth,
      onDeviceCode,
    });

    // If OAuth or API returned a token, optionally persist it to the account profile
    if (result.success && result.token && !account.token) {
      account.token = result.token;
      this.configStore.setAccount(account);
    }

    return result;
  }
}


