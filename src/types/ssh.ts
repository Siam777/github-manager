export interface SshHostConfig {
  host: string;
  hostName: string;
  user: string;
  identityFile: string;
  identitiesOnly?: boolean;
  extraOptions?: Record<string, string>;
}

export interface SshTestResult {
  accountAlias: string;
  hostAlias: string;
  username: string;
  authenticated: boolean;
  rawOutput: string;
  error?: string;
}

export interface KeyPairResult {
  privateKeyPath: string;
  publicKeyPath: string;
  publicKeyContent: string;
}

export interface DiscoveredSshKey {
  name: string;
  privateKeyPath: string;
  publicKeyPath?: string;
  keyType: 'ed25519' | 'rsa' | 'ecdsa' | 'unknown';
  comment?: string;
  isOctomuxManaged: boolean;
}
