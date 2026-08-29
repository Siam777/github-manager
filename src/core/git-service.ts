import { execa } from 'execa';
import { toPosixPath } from '../platform/paths.js';

export interface GitIdentity {
  name?: string;
  email?: string;
  signingKey?: string;
  sshCommand?: string;
}

export interface ParsedRepoInfo {
  owner: string;
  repo: string;
  originalUrl: string;
}

export class GitService {
  /**
   * Checks if git is installed and available in PATH.
   */
  public async isGitInstalled(): Promise<boolean> {
    try {
      const { exitCode } = await execa('git', ['--version']);
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the given directory (or current working directory) is inside a Git repository.
   */
  public async isInsideGitRepo(cwd?: string): Promise<boolean> {
    try {
      const { stdout } = await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Gets the root directory of the current Git repository.
   */
  public async getRepoRoot(cwd?: string): Promise<string | undefined> {
    try {
      const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { cwd });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Reads Git identity (user.name, user.email, core.sshCommand) for a given scope.
   */
  public async getIdentity(scope: 'global' | 'local', cwd?: string): Promise<GitIdentity> {
    const flag = scope === 'global' ? '--global' : '--local';
    const identity: GitIdentity = {};

    try {
      const { stdout: name } = await execa('git', ['config', flag, '--get', 'user.name'], { cwd, reject: false });
      if (name.trim()) identity.name = name.trim();
    } catch {
      // Ignore unset configs
    }

    try {
      const { stdout: email } = await execa('git', ['config', flag, '--get', 'user.email'], { cwd, reject: false });
      if (email.trim()) identity.email = email.trim();
    } catch {
      // Ignore unset configs
    }

    try {
      const { stdout: sshCmd } = await execa('git', ['config', flag, '--get', 'core.sshCommand'], { cwd, reject: false });
      if (sshCmd.trim()) identity.sshCommand = sshCmd.trim();
    } catch {
      // Ignore unset configs
    }

    return identity;
  }

  /**
   * Sets global Git identity.
   */
  public async setGlobalIdentity(name: string, email: string): Promise<void> {
    await execa('git', ['config', '--global', 'user.name', name]);
    await execa('git', ['config', '--global', 'user.email', email]);
  }

  /**
   * Sets local Git identity and dedicated SSH command in a repository.
   */
  public async setLocalIdentity(
    name: string,
    email: string,
    sshKeyPath?: string,
    cwd?: string
  ): Promise<void> {
    const isRepo = await this.isInsideGitRepo(cwd);
    if (!isRepo) {
      throw new Error(`Current directory is not inside a Git repository.`);
    }

    await execa('git', ['config', '--local', 'user.name', name], { cwd });
    await execa('git', ['config', '--local', 'user.email', email], { cwd });

    if (sshKeyPath) {
      const posixKey = toPosixPath(sshKeyPath);
      const sshCommand = `ssh -i "${posixKey}" -o IdentitiesOnly=yes`;
      await execa('git', ['config', '--local', 'core.sshCommand', sshCommand], { cwd });
    }
  }

  /**
   * Parses GitHub URLs, SSH strings, or owner/repo shorthand slugs.
   */
  public parseRepoInput(input: string): ParsedRepoInfo | null {
    const trimmed = input.trim();

    // 1. Shorthand: owner/repo
    const slugMatch = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(trimmed);
    if (slugMatch && slugMatch[1] && slugMatch[2]) {
      const repo = slugMatch[2].replace(/\.git$/, '');
      return { owner: slugMatch[1], repo, originalUrl: trimmed };
    }

    // 2. HTTPS URL: https://github.com/owner/repo(.git)
    const httpsMatch = /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?(?:\/)?$/.exec(trimmed);
    if (httpsMatch && httpsMatch[1] && httpsMatch[2]) {
      return { owner: httpsMatch[1], repo: httpsMatch[2], originalUrl: trimmed };
    }

    // 3. SSH URL: git@github.com:owner/repo.git or git@github.com-alias:owner/repo.git
    const sshMatch = /^git@([a-zA-Z0-9_.-]+):([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/.exec(trimmed);
    if (sshMatch && sshMatch[2] && sshMatch[3]) {
      return { owner: sshMatch[2], repo: sshMatch[3], originalUrl: trimmed };
    }

    return null;
  }

  /**
   * Constructs an SSH clone URL using a specific SSH host alias.
   */
  public formatSshCloneUrl(hostAlias: string, owner: string, repo: string): string {
    return `git@${hostAlias}:${owner}/${repo}.git`;
  }

  /**
   * Executes git clone with real-time output streaming or promise resolution.
   */
  public async clone(cloneUrl: string, targetDir?: string, extraArgs: string[] = []): Promise<string> {
    const args = ['clone', cloneUrl];
    if (targetDir) {
      args.push(targetDir);
    }
    args.push(...extraArgs);

    await execa('git', args, { stdio: 'inherit' });

    // Determine target directory name
    if (targetDir) {
      return targetDir;
    }

    // Extract repo name from URL (e.g. git@github.com-work:facebook/react.git -> react)
    const match = /\/([^/]+?)(\.git)?$/.exec(cloneUrl);
    return match && match[1] ? match[1] : 'repository';
  }

  /**
   * Gets the current remote URL for a repository (origin by default).
   */
  public async getRemoteUrl(remote: string = 'origin', cwd?: string): Promise<string | undefined> {
    try {
      const { stdout } = await execa('git', ['remote', 'get-url', remote], { cwd });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Sets the remote URL for a repository (or adds it if not existing).
   */
  public async setRemoteUrl(remote: string, url: string, cwd?: string): Promise<void> {
    await execa('git', ['remote', 'set-url', remote, url], { cwd });
  }

  /**
   * Adds a new remote to the repository.
   */
  public async addRemoteUrl(remote: string, url: string, cwd?: string): Promise<void> {
    await execa('git', ['remote', 'add', remote, url], { cwd });
  }

  /**
   * Initializes a new Git repository if not already initialized.
   */
  public async initRepo(cwd?: string): Promise<void> {
    await execa('git', ['init'], { cwd });
  }
}
