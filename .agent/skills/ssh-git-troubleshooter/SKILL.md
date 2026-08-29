---
name: ssh-git-troubleshooter
description: >-
  Troubleshooting and diagnostic guide for cross-platform SSH configurations,
  SSH keys (ed25519/rsa), OpenSSH on Windows/macOS/Linux, and Git local/global
  identity resolution in multi-account environments.
---

# SSH & Git Multi-Account Troubleshooting Guide

This skill provides step-by-step diagnostic workflows for debugging SSH host aliasing, key permissions, and Git config inheritance across operating systems.

---

## 1. Cross-Platform SSH Key Verification

### 1.1 Permission Checks (macOS / Linux)
Private keys must have strict read permissions (`0600`) or OpenSSH will reject them:
```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519_*
chmod 644 ~/.ssh/id_ed25519_*.pub
```

### 1.2 Windows Path & SSH Service Nuances
- **Path formatting in `~/.ssh/config`**: OpenSSH on Windows requires POSIX-style forward slashes:
  ```sshconfig
  # Correct:
  IdentityFile C:/Users/Username/.ssh/id_ed25519_work
  # or relative to HOME:
  IdentityFile ~/.ssh/id_ed25519_work
  ```
- **Windows OpenSSH vs Git Bash SSH**:
  - Check which SSH client Git is using: `git config --get core.sshCommand`
  - Ensure Windows OpenSSH agent service (`ssh-agent`) is running if agent forwarding is required:
    ```powershell
    Get-Service ssh-agent | Set-Service -StartupType Automatic
    Start-Service ssh-agent
    ```

---

## 2. Testing SSH Connections to GitHub Host Aliases

To test an SSH host alias without interactive shell prompts:
```bash
ssh -T -o StrictHostKeyChecking=accept-new git@github.com-<alias>
```

**Expected Successful Output**:
```
Hi <username>! You've successfully authenticated, but GitHub does not provide shell access.
```

If it returns `Permission denied (publickey)`:
1. Verify `~/.ssh/config` has `IdentitiesOnly yes` for the host block.
2. Run in verbose mode: `ssh -vT git@github.com-<alias>`.
3. Check that the public key matches the public key uploaded to GitHub settings (`https://github.com/settings/keys`).

---

## 3. Git Identity Diagnostics

### 3.1 Check Active Git Author in Current Directory
```bash
# Check local vs global config
git config --local user.name
git config --local user.email
git config --global user.name
git config --global user.email

# Trace where config value is loaded from
git config --show-origin --get user.email
```

### 3.2 Check Remote URL Host Alias
```bash
git remote -v
# Ensure origin is mapped to the host alias, e.g.:
# git@github.com-work:owner/repo.git (NOT git@github.com:owner/repo.git)
```
