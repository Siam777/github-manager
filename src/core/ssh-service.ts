import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { getSshConfigPath, getSshDir, toPosixPath } from '../platform/paths.js';
import { setPrivateKeyPermissions, setSshDirPermissions } from '../platform/permissions.js';
import { DiscoveredSshKey, KeyPairResult, SshHostConfig, SshTestResult } from '../types/ssh.js';
import { SshKeyType } from '../types/account.js';

export const OCTOMUX_BLOCK_START = '# === OCTOMUX MANAGED HOSTS: START ===';
export const OCTOMUX_BLOCK_END = '# === OCTOMUX MANAGED HOSTS: END ===';

export class SshService {
  private readonly sshConfigPath: string;
  private readonly sshDir: string;

  constructor(customSshConfigPath?: string, customSshDir?: string) {
    this.sshConfigPath = customSshConfigPath ?? getSshConfigPath();
    this.sshDir = customSshDir ?? getSshDir();
  }

  public getSshConfigPath(): string {
    return this.sshConfigPath;
  }

  public getSshDir(): string {
    return this.sshDir;
  }

  /**
   * Scans ~/.ssh directory for existing private SSH keys created by the user or system.
   */
  public scanExistingSshKeys(): DiscoveredSshKey[] {
    if (!fs.existsSync(this.sshDir)) {
      return [];
    }

    const ignoredFiles = new Set([
      'config',
      'config.bak',
      'known_hosts',
      'known_hosts.old',
      'authorized_keys',
    ]);

    const discovered: DiscoveredSshKey[] = [];
    const entries = fs.readdirSync(this.sshDir);

    for (const filename of entries) {
      if (filename.endsWith('.pub') || filename.endsWith('.tmp') || filename.endsWith('.bak')) {
        continue;
      }
      if (ignoredFiles.has(filename.toLowerCase())) {
        continue;
      }

      const privatePath = path.join(this.sshDir, filename);
      const stat = fs.statSync(privatePath);
      if (!stat.isFile()) {
        continue;
      }

      const pubPath = `${privatePath}.pub`;
      const hasPub = fs.existsSync(pubPath);

      let keyType: 'ed25519' | 'rsa' | 'ecdsa' | 'unknown' = 'unknown';
      let comment: string | undefined;

      if (hasPub) {
        try {
          const pubContent = fs.readFileSync(pubPath, 'utf-8').trim();
          const parts = pubContent.split(/\s+/);
          if (parts.length >= 1 && parts[0]) {
            if (parts[0].includes('ed25519')) keyType = 'ed25519';
            else if (parts[0].includes('rsa')) keyType = 'rsa';
            else if (parts[0].includes('ecdsa')) keyType = 'ecdsa';
          }
          if (parts.length >= 3) {
            comment = parts.slice(2).join(' ');
          }
        } catch {
          // Ignore read errors
        }
      } else {
        if (filename.includes('ed25519')) keyType = 'ed25519';
        else if (filename.includes('rsa')) keyType = 'rsa';
        else if (filename.includes('ecdsa')) keyType = 'ecdsa';
      }

      discovered.push({
        name: filename,
        privateKeyPath: privatePath,
        publicKeyPath: hasPub ? pubPath : undefined,
        keyType,
        comment,
        isOctomuxManaged: filename.includes('_octomux_'),
      });
    }

    return discovered;
  }

  /**
   * Generates a new SSH key pair using ssh-keygen.
   */
  public async generateKeyPair(
    email: string,
    targetKeyPath: string,
    keyType: SshKeyType = 'ed25519',
    comment?: string
  ): Promise<KeyPairResult> {
    const parentDir = path.dirname(targetKeyPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
      setSshDirPermissions(parentDir);
    }

    // If key already exists, throw an error to prevent accidental overwrite
    if (fs.existsSync(targetKeyPath)) {
      throw new Error(`SSH Key already exists at: ${targetKeyPath}`);
    }

    const keyComment = comment || `octomux-${email}`;
    const args = ['-t', keyType, '-C', keyComment, '-f', targetKeyPath, '-N', ''];

    if (keyType === 'rsa') {
      args.push('-b', '4096');
    }

    try {
      await execa('ssh-keygen', args);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to generate SSH key with ssh-keygen: ${errorMsg}`);
    }

    // Set strict permissions
    setPrivateKeyPermissions(targetKeyPath);

    const publicKeyPath = `${targetKeyPath}.pub`;
    let publicKeyContent = '';
    if (fs.existsSync(publicKeyPath)) {
      publicKeyContent = fs.readFileSync(publicKeyPath, 'utf-8').trim();
    }

    return {
      privateKeyPath: targetKeyPath,
      publicKeyPath,
      publicKeyContent,
    };
  }

  /**
   * Reads an existing public key associated with a private key.
   */
  public getPublicKey(privateKeyPath: string): string | undefined {
    const pubPath = `${privateKeyPath}.pub`;
    if (fs.existsSync(pubPath)) {
      return fs.readFileSync(pubPath, 'utf-8').trim();
    }
    return undefined;
  }

  /**
   * Generates formatted SSH config block content for an array of host entries.
   */
  public formatHostEntries(hosts: SshHostConfig[]): string {
    const lines: string[] = [
      OCTOMUX_BLOCK_START,
      '# This block is automatically managed by octomux (omx).',
      '# Manual changes inside this block will be overwritten.',
      '',
    ];

    for (const host of hosts) {
      // Normalize identity file path with forward slashes for cross-platform OpenSSH compatibility
      const posixKeyPath = toPosixPath(host.identityFile);

      lines.push(`Host ${host.host}`);
      lines.push(`    HostName ${host.hostName}`);
      lines.push(`    User ${host.user}`);
      lines.push(`    IdentityFile "${posixKeyPath}"`);
      lines.push(`    IdentitiesOnly ${host.identitiesOnly !== false ? 'yes' : 'no'}`);

      if (host.extraOptions) {
        for (const [key, val] of Object.entries(host.extraOptions)) {
          lines.push(`    ${key} ${val}`);
        }
      }
      lines.push('');
    }

    lines.push(OCTOMUX_BLOCK_END);
    return lines.join('\n');
  }

  /**
   * Safely synchronizes octomux host entries into ~/.ssh/config.
   * Preserves all user configurations outside of the octomux delimiters.
   */
  public syncSshConfig(hosts: SshHostConfig[]): void {
    const dir = path.dirname(this.sshConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      setSshDirPermissions(dir);
    }

    let existingContent = '';
    if (fs.existsSync(this.sshConfigPath)) {
      existingContent = fs.readFileSync(this.sshConfigPath, 'utf-8');

      // Backup existing SSH config
      try {
        fs.copyFileSync(this.sshConfigPath, `${this.sshConfigPath}.bak`);
      } catch {
        // Ignore backup failure
      }
    }

    const newBlock = this.formatHostEntries(hosts);

    let updatedContent = '';
    const startIndex = existingContent.indexOf(OCTOMUX_BLOCK_START);
    const endIndex = existingContent.indexOf(OCTOMUX_BLOCK_END);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const before = existingContent.slice(0, startIndex).trimEnd();
      const after = existingContent.slice(endIndex + OCTOMUX_BLOCK_END.length).trimStart();

      const parts: string[] = [];
      if (before.length > 0) parts.push(before);
      parts.push(newBlock);
      if (after.length > 0) parts.push(after);

      updatedContent = parts.join('\n\n') + '\n';
    } else {
      // Append to the end of file
      const trimmed = existingContent.trim();
      updatedContent = trimmed ? `${trimmed}\n\n${newBlock}\n` : `${newBlock}\n`;
    }

    // Atomic write
    const tempFile = `${this.sshConfigPath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, updatedContent, 'utf-8');
    setPrivateKeyPermissions(tempFile);
    fs.renameSync(tempFile, this.sshConfigPath);
    setPrivateKeyPermissions(this.sshConfigPath);
  }

  /**
   * Tests SSH connection to a GitHub host alias.
   * Note: GitHub returns exit code 1 with success greeting on SSH -T.
   */
  public async testConnection(hostAlias: string, username: string = 'User'): Promise<SshTestResult> {
    try {
      const { stdout, stderr } = await execa(
        'ssh',
        [
          '-T',
          '-o',
          'BatchMode=yes',
          '-o',
          'StrictHostKeyChecking=accept-new',
          '-o',
          'ConnectTimeout=8',
          `git@${hostAlias}`,
        ],
        { reject: false }
      );

      const output = `${stdout}\n${stderr}`.trim();
      // GitHub standard greeting: "Hi <username>! You've successfully authenticated..."
      const isAuthenticated =
        output.includes('successfully authenticated') ||
        output.toLowerCase().includes(`hi ${username.toLowerCase()}`);

      return {
        accountAlias: hostAlias.replace(/^github\.com-/, ''),
        hostAlias,
        username,
        authenticated: isAuthenticated,
        rawOutput: output,
        error: isAuthenticated ? undefined : output,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        accountAlias: hostAlias.replace(/^github\.com-/, ''),
        hostAlias,
        username,
        authenticated: false,
        rawOutput: '',
        error: errorMsg,
      };
    }
  }
}
