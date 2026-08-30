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
});
