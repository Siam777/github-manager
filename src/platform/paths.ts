import os from 'node:os';
import path from 'node:path';

/**
 * Returns the user's home directory across Windows, macOS, and Linux.
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Returns the octomux configuration directory path (~/.octomux).
 */
export function getOctomuxDir(): string {
  return path.join(getHomeDir(), '.octomux');
}

/**
 * Returns the path to octomux configuration JSON file (~/.octomux/config.json).
 */
export function getConfigFilePath(): string {
  return path.join(getOctomuxDir(), 'config.json');
}

/**
 * Returns the user's .ssh directory path (~/.ssh).
 */
export function getSshDir(): string {
  return path.join(getHomeDir(), '.ssh');
}

/**
 * Returns the path to the user's SSH config file (~/.ssh/config).
 */
export function getSshConfigPath(): string {
  return path.join(getSshDir(), 'config');
}

/**
 * Returns the default private key path for an account alias.
 * e.g., ~/.ssh/id_ed25519_octomux_work
 */
export function getDefaultKeyPath(alias: string, keyType: 'ed25519' | 'rsa' = 'ed25519'): string {
  const filename = `id_${keyType}_octomux_${alias}`;
  return path.join(getSshDir(), filename);
}

/**
 * Converts a filesystem path to a POSIX path with forward slashes (required by OpenSSH config on all OSes).
 */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
