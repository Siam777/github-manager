import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SshService, OCTOMUX_BLOCK_START, OCTOMUX_BLOCK_END } from '../src/core/ssh-service.js';
import { SshHostConfig } from '../src/types/ssh.js';

describe('SshService', () => {
  let testDir: string;
  let testSshConfigPath: string;
  let service: SshService;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `octomux-ssh-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });
    testSshConfigPath = path.join(testDir, 'config');
    service = new SshService(testSshConfigPath, testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should format host entries with forward slashes for cross-platform compatibility', () => {
    const hosts: SshHostConfig[] = [
      {
        host: 'github.com-work',
        hostName: 'github.com',
        user: 'git',
        identityFile: 'C:\\Users\\User\\.ssh\\id_ed25519_octomux_work',
        identitiesOnly: true,
      },
    ];

    const formatted = service.formatHostEntries(hosts);
    expect(formatted).toContain(OCTOMUX_BLOCK_START);
    expect(formatted).toContain(OCTOMUX_BLOCK_END);
    expect(formatted).toContain('Host github.com-work');
    expect(formatted).toContain('IdentityFile "C:/Users/User/.ssh/id_ed25519_octomux_work"');
    expect(formatted).not.toContain('\\');
  });

  it('should sync SSH config without overwriting existing user configurations', () => {
    const userCustomConfig = `
Host my-custom-vps
    HostName 192.168.1.100
    User root
    IdentityFile ~/.ssh/vps_key
`.trim();

    fs.writeFileSync(testSshConfigPath, userCustomConfig, 'utf-8');

    const hosts: SshHostConfig[] = [
      {
        host: 'github.com-personal',
        hostName: 'github.com',
        user: 'git',
        identityFile: '/path/to/personal/key',
      },
    ];

    service.syncSshConfig(hosts);

    const updatedConfig = fs.readFileSync(testSshConfigPath, 'utf-8');
    expect(updatedConfig).toContain('Host my-custom-vps');
    expect(updatedConfig).toContain('Host github.com-personal');
    expect(updatedConfig).toContain(OCTOMUX_BLOCK_START);
    expect(updatedConfig).toContain(OCTOMUX_BLOCK_END);
  });

  it('should safely replace the managed block when synced multiple times', () => {
    const hosts1: SshHostConfig[] = [
      {
        host: 'github.com-first',
        hostName: 'github.com',
        user: 'git',
        identityFile: '/path/to/first',
      },
    ];

    service.syncSshConfig(hosts1);
    let content = fs.readFileSync(testSshConfigPath, 'utf-8');
    expect(content).toContain('Host github.com-first');

    const hosts2: SshHostConfig[] = [
      {
        host: 'github.com-second',
        hostName: 'github.com',
        user: 'git',
        identityFile: '/path/to/second',
      },
    ];

    service.syncSshConfig(hosts2);
    content = fs.readFileSync(testSshConfigPath, 'utf-8');
    expect(content).not.toContain('Host github.com-first');
    expect(content).toContain('Host github.com-second');

    // Ensure start/end blocks appear exactly once
    const startMatches = content.match(new RegExp(OCTOMUX_BLOCK_START, 'g'));
    const endMatches = content.match(new RegExp(OCTOMUX_BLOCK_END, 'g'));
    expect(startMatches?.length).toBe(1);
    expect(endMatches?.length).toBe(1);
  });

  it('should scan and discover existing SSH keys with comments', () => {
    const key1Private = path.join(testDir, 'id_ed25519');
    const key1Public = path.join(testDir, 'id_ed25519.pub');
    fs.writeFileSync(key1Private, 'PRIVATE KEY CONTENT');
    fs.writeFileSync(key1Public, 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 user@company.com');

    const key2Private = path.join(testDir, 'id_rsa_personal');
    const key2Public = path.join(testDir, 'id_rsa_personal.pub');
    fs.writeFileSync(key2Private, 'PRIVATE KEY CONTENT');
    fs.writeFileSync(key2Public, 'ssh-rsa AAAAB3NzaC1yc2E personal-github');

    const discovered = service.scanExistingSshKeys();
    expect(discovered.length).toBe(2);

    const ed25519Match = discovered.find((k) => k.name === 'id_ed25519');
    expect(ed25519Match).toBeDefined();
    expect(ed25519Match?.keyType).toBe('ed25519');
    expect(ed25519Match?.comment).toBe('user@company.com');

    const rsaMatch = discovered.find((k) => k.name === 'id_rsa_personal');
    expect(rsaMatch).toBeDefined();
    expect(rsaMatch?.keyType).toBe('rsa');
    expect(rsaMatch?.comment).toBe('personal-github');
  });
});
