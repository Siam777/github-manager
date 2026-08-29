import pc from 'picocolors';
import { AccountProfile } from '../types/account.js';
import { SshTestResult } from '../types/ssh.js';

export function formatPublicKeyGuide(account: AccountProfile, publicKeyContent?: string): string {
  const lines = [
    pc.bold(pc.green('Account configured successfully!')),
    '',
    `${pc.bold('Next Step:')} Add your SSH Public Key to your GitHub Account:`,
    pc.cyan('https://github.com/settings/ssh/new'),
    '',
    `${pc.bold('Public Key Path:')} ${pc.dim(account.ssh.publicKeyPath)}`,
  ];

  if (publicKeyContent) {
    lines.push('');
    lines.push(pc.bold('Public Key Content:'));
    lines.push(pc.yellow(publicKeyContent));
  }

  return lines.join('\n');
}

export function formatTestResult(result: SshTestResult): string {
  if (result.authenticated) {
    return [
      pc.green(`✔ SSH connection to ${pc.bold(result.hostAlias)} succeeded!`),
      pc.dim(`  GitHub greeting: Hi ${result.username}! You've successfully authenticated.`),
    ].join('\n');
  }

  return [
    pc.red(`✖ SSH connection to ${pc.bold(result.hostAlias)} failed.`),
    pc.yellow(`  Error output: ${result.error || 'Authentication rejected.'}`),
    pc.dim(`  Tip: Make sure you added your public key at https://github.com/settings/keys`),
  ].join('\n');
}

export function formatCloneSummary(
  repoName: string,
  targetDir: string,
  account: AccountProfile
): string {
  return [
    pc.bold(pc.green(`Repository cloned and configured successfully!`)),
    '',
    `  ${pc.bold('Repository:')} ${pc.cyan(repoName)}`,
    `  ${pc.bold('Location:')}   ${targetDir}`,
    `  ${pc.bold('Account:')}    ${pc.yellow(account.id)} (@${account.username})`,
    `  ${pc.bold('Author:')}     ${account.gitUserName} <${account.email}>`,
    `  ${pc.bold('SSH Host:')}   ${pc.cyan(account.ssh.hostAlias)}`,
  ].join('\n');
}
