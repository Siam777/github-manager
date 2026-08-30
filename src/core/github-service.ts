import os from 'node:os';
import { execa } from 'execa';

export const DEFAULT_GITHUB_CLIENT_ID = process.env.OCTOMUX_GITHUB_CLIENT_ID || '178c6fc77800e28f3070';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface UploadKeyResult {
  success: boolean;
  method: 'gh' | 'api' | 'oauth' | 'manual';
  alreadyExists?: boolean;
  keyId?: number;
  token?: string;
  authenticatedUser?: string;
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
  useOAuth?: boolean;
  onDeviceCode?: (userCode: string, verificationUri: string) => void;
}

export async function openBrowser(url: string): Promise<boolean> {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      await execa('cmd', ['/c', 'start', '', url]);
    } else if (platform === 'darwin') {
      await execa('open', [url]);
    } else {
      await execa('xdg-open', [url]);
    }
    return true;
  } catch {
    return false;
  }
}

export class GitHubService {
  private readonly clientId: string;

  constructor(customClientId?: string) {
    this.clientId = customClientId ?? DEFAULT_GITHUB_CLIENT_ID;
  }

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
   * Fetches user profile for a token to verify the authenticated username.
   */
  public async fetchAuthenticatedUser(token: string): Promise<{ login: string; name?: string; email?: string }> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'octomux-cli',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch user profile: ${res.statusText}`);
    }

    return (await res.json()) as { login: string; name?: string; email?: string };
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
          token,
          message: 'Public key successfully registered on GitHub via REST API.',
        };
      }

      if (response.status === 422) {
        return {
          success: true,
          method: 'api',
          alreadyExists: true,
          token,
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
   * Initiates GitHub OAuth Device Flow.
   */
  public async startDeviceFlow(
    scopes: string = 'read:user admin:public_key'
  ): Promise<DeviceCodeResponse> {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        scope: scopes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate GitHub device authorization (${response.status}): ${await response.text()}`);
    }

    return (await response.json()) as DeviceCodeResponse;
  }

  /**
   * Polls GitHub for device token authorization.
   */
  public async pollDeviceToken(
    deviceCode: string,
    intervalSeconds: number = 5,
    expiresInSeconds: number = 900
  ): Promise<string> {
    const deadline = Date.now() + expiresInSeconds * 1000;
    let pollInterval = Math.max(intervalSeconds, 0) * 1000;


    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      if (!res.ok) {
        throw new Error(`OAuth polling failed (${res.status}): ${await res.text()}`);
      }

      const data = (await res.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
        interval?: number;
      };

      if (data.access_token) {
        return data.access_token;
      }

      if (data.error === 'authorization_pending') {
        continue;
      }

      if (data.error === 'slow_down') {
        pollInterval += (data.interval || 5) * 1000;
        continue;
      }

      if (data.error === 'expired_token') {
        throw new Error('Device code expired. Please try again.');
      }

      if (data.error === 'access_denied') {
        throw new Error('Login was cancelled or denied on GitHub.');
      }

      throw new Error(`OAuth authorization error: ${data.error_description || data.error}`);
    }

    throw new Error('Device authorization timed out. Please try again.');
  }

  /**
   * Complete 1-click OAuth flow: requests code, opens browser, polls, verifies user, and uploads key.
   */
  public async uploadViaOAuth(
    publicKeyContent: string,
    title: string,
    targetUsername?: string,
    onDeviceCode?: (userCode: string, verificationUri: string) => void
  ): Promise<UploadKeyResult> {
    try {
      const deviceAuth = await this.startDeviceFlow();

      if (onDeviceCode) {
        onDeviceCode(deviceAuth.user_code, deviceAuth.verification_uri);
      }

      // Auto-launch browser
      await openBrowser(deviceAuth.verification_uri);

      const token = await this.pollDeviceToken(
        deviceAuth.device_code,
        deviceAuth.interval,
        deviceAuth.expires_in
      );

      // Verify authenticated user
      let authenticatedUser: string | undefined;
      try {
        const userProfile = await this.fetchAuthenticatedUser(token);
        authenticatedUser = userProfile.login;

        if (targetUsername && authenticatedUser.toLowerCase() !== targetUsername.toLowerCase()) {
          // Note: Account authorized belongs to a different username
        }
      } catch {
        // Ignore user fetch errors
      }


      const uploadResult = await this.uploadViaApi(publicKeyContent, title, token);

      return {
        ...uploadResult,
        method: 'oauth',
        token,
        authenticatedUser,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        method: 'oauth',
        error: errorMsg,
      };
    }
  }

  /**
   * Automatically uploads key using best available method (OAuth browser, PAT token, or gh CLI).
   */
  public async autoUploadKey(options: GitHubUploadOptions): Promise<UploadKeyResult> {
    const title = this.generateKeyTitle(options.accountAlias, options.customTitle);

    // 1. If explicit token provided or stored on account, use API
    if (options.token && options.token.trim()) {
      return this.uploadViaApi(options.publicKeyContent, title, options.token);
    }

    // 2. If OAuth requested explicitly or no other method available
    if (options.useOAuth) {
      return this.uploadViaOAuth(
        options.publicKeyContent,
        title,
        options.username,
        options.onDeviceCode
      );
    }

    // 3. Check if GitHub CLI is available and authenticated for this username
    const ghStatus = await this.isGhCliAuthenticated(options.username);
    if (ghStatus.available) {
      return this.uploadViaGhCli(options.publicKeyPath, title);
    }

    // 4. Default fallback: run OAuth Device Flow with browser opening
    return this.uploadViaOAuth(
      options.publicKeyContent,
      title,
      options.username,
      options.onDeviceCode
    );
  }
}

