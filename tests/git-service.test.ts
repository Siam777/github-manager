import { describe, it, expect } from 'vitest';
import { GitService } from '../src/core/git-service.js';

describe('GitService', () => {
  const gitService = new GitService();

  it('should parse shorthand owner/repo slugs', () => {
    const parsed = gitService.parseRepoInput('facebook/react');
    expect(parsed).toEqual({
      owner: 'facebook',
      repo: 'react',
      originalUrl: 'facebook/react',
    });
  });

  it('should parse HTTPS GitHub URLs', () => {
    const parsed1 = gitService.parseRepoInput('https://github.com/torvalds/linux.git');
    expect(parsed1).toEqual({
      owner: 'torvalds',
      repo: 'linux',
      originalUrl: 'https://github.com/torvalds/linux.git',
    });

    const parsed2 = gitService.parseRepoInput('https://github.com/vercel/next.js');
    expect(parsed2).toEqual({
      owner: 'vercel',
      repo: 'next.js',
      originalUrl: 'https://github.com/vercel/next.js',
    });
  });

  it('should parse SSH GitHub URLs', () => {
    const parsed = gitService.parseRepoInput('git@github.com:facebook/react.git');
    expect(parsed).toEqual({
      owner: 'facebook',
      repo: 'react',
      originalUrl: 'git@github.com:facebook/react.git',
    });
  });

  it('should format dedicated SSH clone URLs correctly', () => {
    const url = gitService.formatSshCloneUrl('github.com-work', 'my-org', 'my-repo');
    expect(url).toBe('git@github.com-work:my-org/my-repo.git');
  });

  it('should return null for invalid repository inputs', () => {
    expect(gitService.parseRepoInput('invalid-input-without-slash')).toBeNull();
    expect(gitService.parseRepoInput('https://gitlab.com/user/repo')).toBeNull();
  });
});
