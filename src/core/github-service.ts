import os from 'node:os';
import { execa } from 'execa';

export interface UploadKeyResult {
  success: boolean;
  method: 'gh' | 'api' | 'manual';
  alreadyExists?: boolean;
  keyId?: number;
  message?: string;
  error?: string;
}

export interface GitHubUploadOptions {
  publicKeyPath: string;
  publicKeyContent: string;
  accountAlias: string;
  username?: string;
  token?: string;
  customTitle?: string;
}

export class GitHubService {
  /**
   * Generates a descriptive key title for GitHub (e.g. "octomux (work) - My-PC").
   */
  public generateKeyTitle(alias: string, customTitle?: string): string {
    if (customTitle && customTitle.trim()) {
      return customTitle.trim();
    }
    const hostname = os.hostname() || 'workstation';
    return `octomux (${alias}) - ${hostname}`;
  }

  /**
   * Checks whether GitHub CLI (`gh`) is installed and authenticated.
   */
  public async isGhCliAuthenticated(targetUsername?: string): Promise<{
    available: boolean;
    authenticatedUser?: string;
  }> {
    try {
      const { stdout, stderr } = await execa('gh', ['auth', 'status']);
      const combined = `${stdout} ${stderr}`.toLowerCase();
      const isLoggedIn = combined.includes('logged in to github.com') || combined.includes('logged in to');

      let authenticatedUser: string | undefined;
      const match =
        combined.match(/account\s+([a-zA-Z0-9-_]+)/i) ||
        combined.match(/as\s+([a-zA-Z0-9-_]+)/i) ||
        combined.match(/logged in to github\.com as\s+([a-zA-Z0-9-_]+)/i);

      if (match && match[1]) {
        authenticatedUser = match[1];
      }

      if (isLoggedIn) {
        if (targetUsername && authenticatedUser) {
          const matchesUser = authenticatedUser.toLowerCase() === targetUsername.toLowerCase();
          return { available: matchesUser, authenticatedUser };
        }
        return { available: true, authenticatedUser };
      }
      return { available: false };
    } catch {
      return { available: false };
    }
  }

  /**
   * Uploads an SSH key using GitHub CLI (`gh ssh-key add`).
   */
  public async uploadViaGhCli(publicKeyPath: string, title: string): Promise<UploadKeyResult> {
    try {
      await execa('gh', ['ssh-key', 'add', publicKeyPath, '--title', title, '--type', 'authentication']);

      return {
        success: true,
        method: 'gh',
        message: 'Public key successfully added to GitHub via GitHub CLI.',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (
        errorMsg.includes('already exists') ||
        errorMsg.includes('key is already in use') ||
        errorMsg.includes('422')
      ) {
        return {
          success: true,
          method: 'gh',
          alreadyExists: true,
          message: 'Key is already registered on your GitHub account.',
        };
      }
      return {
        success: false,
        method: 'gh',
        error: errorMsg,
      };
    }
  }

  /**
   * Uploads an SSH key directly to GitHub REST API using a Personal Access Token (PAT).
   */
  public async uploadViaApi(
    publicKeyContent: string,
    title: string,
    token: string
  ): Promise<UploadKeyResult> {
    try {
      const cleanKey = publicKeyContent.trim();
      const response = await fetch('https://api.github.com/user/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'octomux-cli',
        },
        body: JSON.stringify({
          title,
          key: cleanKey,
        }),
      });

      if (response.status === 201) {
        const data = (await response.json()) as { id: number; key: string };
        return {
          success: true,
          method: 'api',
          keyId: data.id,
          message: 'Public key successfully registered on GitHub via REST API.',
        };
      }

      if (response.status === 422) {
        return {
          success: true,
          method: 'api',
          alreadyExists: true,
          message: 'Key is already registered on your GitHub account.',
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          method: 'api',
          error:
            'GitHub authentication failed. Ensure your token is valid and has the "admin:public_key" or "write:public_key" scope.',
        };
      }

      const errorText = await response.text();
      return {
        success: false,
        method: 'api',
        error: `GitHub API returned HTTP ${response.status}: ${errorText}`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        method: 'api',
        error: `Failed to connect to GitHub API: ${errorMsg}`,
      };
    }
  }

  /**
   * Automatically uploads key using best available method (PAT token or gh CLI).
   */
  public async autoUploadKey(options: GitHubUploadOptions): Promise<UploadKeyResult> {
    const title = this.generateKeyTitle(options.accountAlias, options.customTitle);

    // 1. If explicit token provided or stored on account, use API
    if (options.token && options.token.trim()) {
      return this.uploadViaApi(options.publicKeyContent, title, options.token);
    }

    // 2. Check if GitHub CLI is available and authenticated
    const ghStatus = await this.isGhCliAuthenticated(options.username);
    if (ghStatus.available) {
      return this.uploadViaGhCli(options.publicKeyPath, title);
    }

    return {
      success: false,
      method: 'manual',
      error:
        'No GitHub token provided and GitHub CLI (gh) is not authenticated for this user. Please add key manually or supply a token.',
    };
  }
}
