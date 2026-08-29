import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigStore } from '../src/core/config-store.js';
import { AccountProfile } from '../src/types/account.js';

describe('ConfigStore', () => {
  let testDir: string;
  let testConfigPath: string;
  let store: ConfigStore;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `octomux-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });
    testConfigPath = path.join(testDir, 'config.json');
    store = new ConfigStore(testConfigPath);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create default configuration if file does not exist', () => {
    const config = store.load();
    expect(config.version).toBe('1.0.0');
    expect(config.accounts).toEqual({});
    expect(fs.existsSync(testConfigPath)).toBe(true);
  });

  it('should save and load accounts correctly', () => {
    const sampleAccount: AccountProfile = {
      id: 'work',
      name: 'Work Profile',
      username: 'johndoe-corp',
      email: 'john@corp.com',
      gitUserName: 'John Doe',
      ssh: {
        keyPath: '/home/user/.ssh/id_ed25519_work',
        publicKeyPath: '/home/user/.ssh/id_ed25519_work.pub',
        hostAlias: 'github.com-work',
        keyType: 'ed25519',
      },
      isDefaultGlobal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.setAccount(sampleAccount);

    const loaded = store.getAccount('work');
    expect(loaded).toBeDefined();
    expect(loaded?.username).toBe('johndoe-corp');
    expect(loaded?.email).toBe('john@corp.com');
  });

  it('should create a backup file (.bak) when saving an existing config', () => {
    store.load();
    const backupPath = `${testConfigPath}.bak`;

    const sampleAccount: AccountProfile = {
      id: 'personal',
      name: 'Personal Profile',
      username: 'johndoe',
      email: 'john@personal.com',
      gitUserName: 'John Doe',
      ssh: {
        keyPath: '/home/user/.ssh/id_ed25519_personal',
        publicKeyPath: '/home/user/.ssh/id_ed25519_personal.pub',
        hostAlias: 'github.com-personal',
        keyType: 'ed25519',
      },
      isDefaultGlobal: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.setAccount(sampleAccount);
    expect(fs.existsSync(backupPath)).toBe(true);
  });

  it('should handle setting active global account', () => {
    const acc1: AccountProfile = {
      id: 'work',
      name: 'Work',
      username: 'johndoe-work',
      email: 'john@work.com',
      gitUserName: 'John',
      ssh: {
        keyPath: '/key',
        publicKeyPath: '/key.pub',
        hostAlias: 'github.com-work',
        keyType: 'ed25519',
      },
      isDefaultGlobal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.setAccount(acc1);
    store.setActiveGlobal('work');

    const active = store.getActiveGlobal();
    expect(active?.id).toBe('work');
    expect(active?.isDefaultGlobal).toBe(true);
  });

  it('should remove account cleanly', () => {
    const acc: AccountProfile = {
      id: 'temp',
      name: 'Temp',
      username: 'tempuser',
      email: 'temp@example.com',
      gitUserName: 'Temp',
      ssh: {
        keyPath: '/key',
        publicKeyPath: '/key.pub',
        hostAlias: 'github.com-temp',
        keyType: 'ed25519',
      },
      isDefaultGlobal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.setAccount(acc);
    expect(store.getAccount('temp')).toBeDefined();

    const removed = store.removeAccount('temp');
    expect(removed).toBe(true);
    expect(store.getAccount('temp')).toBeUndefined();
  });
});
