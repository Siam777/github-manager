import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccountManager } from '../src/core/account-manager.js';
import { ConfigStore } from '../src/core/config-store.js';
import { SshService } from '../src/core/ssh-service.js';
import { GitService } from '../src/core/git-service.js';

describe('AccountManager', () => {
  let testDir: string;
  let configStore: ConfigStore;
  let sshService: SshService;
  let gitService: GitService;
  let manager: AccountManager;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `octomux-acc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });

    const testConfigPath = path.join(testDir, 'config.json');
    const testSshPath = path.join(testDir, 'ssh_config');

    configStore = new ConfigStore(testConfigPath);
    sshService = new SshService(testSshPath, testDir);
    gitService = new GitService();

    manager = new AccountManager(configStore, sshService, gitService);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should add an account and link an existing SSH key', async () => {
    // Create a mock private and public key
    const mockKeyPath = path.join(testDir, 'id_ed25519_test');
    fs.writeFileSync(mockKeyPath, 'PRIVATE KEY CONTENT');
    fs.writeFileSync(`${mockKeyPath}.pub`, 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 test@test.com');

    const profile = await manager.addAccount({
      id: 'work',
      username: 'john-work',
      email: 'john@work.com',
      gitUserName: 'John Work',
      sshKeyPath: mockKeyPath,
      generateKey: false,
    });

    expect(profile.id).toBe('work');
    expect(profile.username).toBe('john-work');
    expect(profile.ssh.hostAlias).toBe('github.com-work');
    expect(profile.ssh.keyPath).toBe(mockKeyPath);

    const saved = manager.getAccount('work');
    expect(saved).toBeDefined();
    expect(saved?.email).toBe('john@work.com');
  });

  it('should reject duplicate alias IDs', async () => {
    const mockKeyPath = path.join(testDir, 'id_ed25519_test');
    fs.writeFileSync(mockKeyPath, 'KEY');

    await manager.addAccount({
      id: 'work',
      username: 'john-work',
      email: 'john@work.com',
      sshKeyPath: mockKeyPath,
      generateKey: false,
    });

    await expect(
      manager.addAccount({
        id: 'work',
        username: 'another-user',
        email: 'another@work.com',
        sshKeyPath: mockKeyPath,
        generateKey: false,
      })
    ).rejects.toThrow(/already exists/i);
  });

  it('should update an existing account profile', async () => {
    const mockKeyPath = path.join(testDir, 'id_ed25519_test');
    fs.writeFileSync(mockKeyPath, 'KEY');

    await manager.addAccount({
      id: 'personal',
      username: 'johndoe',
      email: 'john@personal.com',
      sshKeyPath: mockKeyPath,
      generateKey: false,
    });

    const updated = await manager.updateAccount('personal', {
      email: 'newemail@personal.com',
      gitUserName: 'Johnathan Doe',
    });

    expect(updated.email).toBe('newemail@personal.com');
    expect(updated.gitUserName).toBe('Johnathan Doe');
    expect(updated.username).toBe('johndoe');
  });

  it('should remove account and sync SSH config', async () => {
    const mockKeyPath = path.join(testDir, 'id_ed25519_test');
    fs.writeFileSync(mockKeyPath, 'KEY');

    await manager.addAccount({
      id: 'client',
      username: 'client-user',
      email: 'client@company.com',
      sshKeyPath: mockKeyPath,
      generateKey: false,
    });

    expect(manager.getAccount('client')).toBeDefined();

    const removed = manager.removeAccount('client', false);
    expect(removed).toBe(true);
    expect(manager.getAccount('client')).toBeUndefined();
  });

  it('should rename an account alias and update host alias', async () => {
    const mockKeyPath = path.join(testDir, 'id_ed25519_test');
    fs.writeFileSync(mockKeyPath, 'KEY');

    await manager.addAccount({
      id: 'oldalias',
      username: 'user1',
      email: 'user1@example.com',
      sshKeyPath: mockKeyPath,
      generateKey: false,
    });

    const updated = await manager.updateAccount('oldalias', {
      renameAlias: 'newalias',
      username: 'user1-updated',
    });

    expect(updated.id).toBe('newalias');
    expect(updated.username).toBe('user1-updated');
    expect(updated.ssh.hostAlias).toBe('github.com-newalias');

    expect(manager.getAccount('oldalias')).toBeUndefined();
    expect(manager.getAccount('newalias')).toBeDefined();
  });

  it('should reject renaming to an existing account alias', async () => {
    const mockKeyPath = path.join(testDir, 'id_ed25519_test');
    fs.writeFileSync(mockKeyPath, 'KEY');

    await manager.addAccount({
      id: 'acc1',
      username: 'user1',
      email: 'user1@example.com',
      sshKeyPath: mockKeyPath,
      generateKey: false,
    });

    await manager.addAccount({
      id: 'acc2',
      username: 'user2',
      email: 'user2@example.com',
      sshKeyPath: mockKeyPath,
      generateKey: false,
    });

    await expect(
      manager.updateAccount('acc1', {
        renameAlias: 'acc2',
      })
    ).rejects.toThrow(/already exists/i);
  });

  it('should switch SSH key and delete old key when deleteOldKey is true', async () => {
    const oldKeyPath = path.join(testDir, 'id_old_key');
    const oldPubKeyPath = `${oldKeyPath}.pub`;
    fs.writeFileSync(oldKeyPath, 'OLD PRIVATE KEY');
    fs.writeFileSync(oldPubKeyPath, 'OLD PUBLIC KEY');

    const newKeyPath = path.join(testDir, 'id_new_key');
    const newPubKeyPath = `${newKeyPath}.pub`;
    fs.writeFileSync(newKeyPath, 'NEW PRIVATE KEY');
    fs.writeFileSync(newPubKeyPath, 'NEW PUBLIC KEY');

    await manager.addAccount({
      id: 'keytest',
      username: 'keyuser',
      email: 'keyuser@example.com',
      sshKeyPath: oldKeyPath,
      generateKey: false,
    });

    expect(fs.existsSync(oldKeyPath)).toBe(true);

    const updated = await manager.updateAccount('keytest', {
      sshKeyPath: newKeyPath,
      deleteOldKey: true,
    });

    expect(updated.ssh.keyPath).toBe(newKeyPath);
    expect(fs.existsSync(oldKeyPath)).toBe(false);
    expect(fs.existsSync(oldPubKeyPath)).toBe(false);
    expect(fs.existsSync(newKeyPath)).toBe(true);
  });

  it('should update signing key, token, and global default status', async () => {
    const mockKeyPath = path.join(testDir, 'id_ed25519_test');
    fs.writeFileSync(mockKeyPath, 'KEY');

    await manager.addAccount({
      id: 'secaccount',
      username: 'secuser',
      email: 'secuser@example.com',
      sshKeyPath: mockKeyPath,
      generateKey: false,
      setAsGlobal: false,
    });

    const updated = await manager.updateAccount('secaccount', {
      signingKey: 'GPGKEY12345',
      token: 'ghp_secrettoken123',
      setAsGlobal: true,
    });

    expect(updated.signingKey).toBe('GPGKEY12345');
    expect(updated.token).toBe('ghp_secrettoken123');
    expect(updated.isDefaultGlobal).toBe(true);
    expect(configStore.getActiveGlobal()?.id).toBe('secaccount');
  });
});

