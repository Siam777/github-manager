import { execa } from 'execa';

/**
 * Copies plain text to system clipboard across Windows, macOS, and Linux without external runtime dependencies.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      const proc = execa('clip.exe');
      proc.stdin?.write(text);
      proc.stdin?.end();
      await proc;
      return true;
    } else if (platform === 'darwin') {
      const proc = execa('pbcopy');
      proc.stdin?.write(text);
      proc.stdin?.end();
      await proc;
      return true;
    } else {
      // Linux (Wayland or X11)
      try {
        const proc = execa('wl-copy');
        proc.stdin?.write(text);
        proc.stdin?.end();
        await proc;
        return true;
      } catch {
        const proc = execa('xclip', ['-selection', 'clipboard']);
        proc.stdin?.write(text);
        proc.stdin?.end();
        await proc;
        return true;
      }
    }
  } catch {
    return false;
  }
}
