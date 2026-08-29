import fs from 'node:fs';
import os from 'node:os';

/**
 * Sets Unix file permissions to 0600 (read/write only by owner) on non-Windows platforms.
 * Safe to call on Windows without throwing.
 */
export function setPrivateKeyPermissions(filePath: string): void {
  if (os.platform() === 'win32') {
    return;
  }
  try {
    if (fs.existsSync(filePath)) {
      fs.chmodSync(filePath, 0o600);
    }
  } catch {
    // Ignore permission errors if file is read-only or in testing environment
  }
}

/**
 * Sets Unix directory permissions to 0700 (rwx only by owner) on non-Windows platforms.
 */
export function setSshDirPermissions(dirPath: string): void {
  if (os.platform() === 'win32') {
    return;
  }
  try {
    if (fs.existsSync(dirPath)) {
      fs.chmodSync(dirPath, 0o700);
    }
  } catch {
    // Ignore permission errors in testing or locked environments
  }
}
