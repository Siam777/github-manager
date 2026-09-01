import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubService } from '../src/core/github-service.js';

describe('GitHubService', () => {
  let service: GitHubService;

  beforeEach(() => {
    service = new GitHubService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate a descriptive key title with alias and hostname', () => {
    const title = service.generateKeyTitle('work');
    expect(title).toContain('octomux (work)');

    const custom = service.generateKeyTitle('work', 'My Custom MacBook Key');
    expect(custom).toBe('My Custom MacBook Key');
  });

  it('should handle successful key upload via REST API (201 Created)', async () => {
    const mockResponse = { id: 98765432, key: 'ssh-ed25519 AAAAC3NzaC...' };

    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await service.uploadViaApi('ssh-ed25519 AAAAC3NzaC...', 'octomux (work)', 'ghp_fakeToken123');

    expect(result.success).toBe(true);
    expect(result.method).toBe('api');
    expect(result.keyId).toBe(98765432);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/user/keys',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_fakeToken123',
        }),
      })
    );
  });

  it('should gracefully handle already registered key (422 Unprocessable)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 422,
      json: async () => ({ message: 'Key is already in use' }),
    } as unknown as Response);

    const result = await service.uploadViaApi('ssh-ed25519 AAAAC3NzaC...', 'octomux (work)', 'ghp_fakeToken123');

    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(true);
    expect(result.message).toContain('already registered');
  });

  it('should handle authentication and scope failures (401/403)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      text: async () => 'Bad credentials',
    } as unknown as Response);

    const result = await service.uploadViaApi('ssh-ed25519 AAAAC3NzaC...', 'octomux (work)', 'ghp_invalidToken');

    expect(result.success).toBe(false);
    expect(result.error).toContain('authentication failed');
  });

  it('should automatically use token over gh CLI when token is provided', async () => {
    const apiSpy = vi.spyOn(service, 'uploadViaApi').mockResolvedValue({
      success: true,
      method: 'api',
      keyId: 1111,
    });

    const result = await service.autoUploadKey({
      publicKeyPath: '/path/to/key.pub',
      publicKeyContent: 'ssh-ed25519 AAAAC3NzaC...',
      accountAlias: 'work',
      token: 'ghp_myToken',
    });

    expect(result.success).toBe(true);
    expect(apiSpy).toHaveBeenCalled();
  });

  it('should start device flow and return device code details', async () => {
    const mockDeviceAuth = {
      device_code: 'mock-device-code',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDeviceAuth,
    } as unknown as Response);

    const result = await service.startDeviceFlow();
    expect(result.device_code).toBe('mock-device-code');
    expect(result.user_code).toBe('ABCD-1234');
    expect(result.verification_uri).toBe('https://github.com/login/device');
  });

  it('should poll and receive OAuth access token', async () => {
    // 1st call returns authorization_pending, 2nd call returns access_token
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'authorization_pending' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gho_oauthToken123' }),
      } as unknown as Response);

    const token = await service.pollDeviceToken('mock-device-code', 0, 10);
    expect(token).toBe('gho_oauthToken123');
  });

  it('should execute full uploadViaOAuth flow and verify user', async () => {
    vi.spyOn(service, 'startDeviceFlow').mockResolvedValue({
      device_code: 'dev-123',
      user_code: 'USER-CODE',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 0,
    });

    vi.spyOn(service, 'pollDeviceToken').mockResolvedValue('gho_token999');
    vi.spyOn(service, 'fetchAuthenticatedUser').mockResolvedValue({ login: 'octocat' });

    vi.spyOn(service, 'uploadViaApi').mockResolvedValue({
      success: true,
      method: 'api',
      keyId: 7777,
    });

    let capturedCode = '';
    const result = await service.uploadViaOAuth(
      'ssh-ed25519 AAA...',
      'octomux (work)',
      'octocat',
      (code) => {
        capturedCode = code;
      }
    );

    expect(capturedCode).toBe('USER-CODE');
    expect(result.success).toBe(true);
    expect(result.method).toBe('oauth');
    expect(result.token).toBe('gho_token999');
    expect(result.authenticatedUser).toBe('octocat');
  });

  it('should support openBrowserAssistant to open browser and copy key', async () => {
    const result = await service.openBrowserAssistant('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...');
    expect(result.success).toBe(true);
    expect(result.method).toBe('browser-assisted');
  });
});


