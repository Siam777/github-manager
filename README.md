# 🐙 octomux (`omx`)

[![npm version](https://img.shields.io/badge/npm-v1.1.1-cb3837.svg?style=flat-square)](https://www.npmjs.com/package/@siamriaz/octomux)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Cross-Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg?style=flat-square)]()
[![Vitest](https://img.shields.io/badge/Tests-Vitest%2031%2F31%20Passing-729B1B.svg?style=flat-square)](https://vitest.dev/)

> **Enterprise-grade, cross-platform GitHub multi-account multiplexer, SSH identity manager, and smart repository clone CLI.**

Seamlessly manage multiple GitHub accounts (Work, Personal, Client, Open Source) with zero SSH collisions and zero commit identity mistakes.

---

## ✨ Features

- 🔑 **Multi-Account & SSH Engine**: Add, edit, list, and switch between unlimited GitHub accounts with automated Ed25519/RSA SSH key generation.
- 🔄 **SSH Key Rotation & Account Updates**: Rotate keys on the fly, replace with discovered or custom keys, rename account aliases, and update GPG signing keys or Personal Access Tokens (PAT).
- 🔍 **Automatic SSH Key Discovery**: Automatically scans `~/.ssh/` for existing keys and imports them with one click.
- 🛡️ **Zero-Data-Loss SSH Sync**: Safely syncs `~/.ssh/config` using isolated block delimiters (`# === OCTOMUX MANAGED HOSTS ===`) with automated backups (`.bak`).
- 🔀 **Local & Global Identity Switcher**: Instantly toggle `user.name`, `user.email`, and `core.sshCommand` globally or per repository.
- 🔗 **Remote Origin Helper**: `omx remote` or `omx origin` binds existing local repositories to dedicated SSH aliases with automated author and SSH key configuration.
- 📦 **Smart Clone**: `omx clone owner/repo` automatically clones using the account's dedicated SSH Host alias and binds repository-local Git identities upon completion.
- 💻 **Cross-Platform Compatibility**: Native support for **Windows** (PowerShell, CMD, Git Bash, OpenSSH), **macOS**, and **Linux** with POSIX path normalization and `chmod 0600` key permission handling.
- 🎨 **Dual-Mode Experience**: Modern interactive TUI wizard with `@clack/prompts` and non-interactive flags (`--json`, `--yes`, `--global`) for CI/CD scripting.

---

## 🚀 Installation

```bash
# Global installation via npm
npm install -g @siamriaz/octomux

# Or run directly via npx without installing
npx @siamriaz/octomux
```

*Both `octomux` and `omx` binary aliases are available upon installation.*

---

## ⚡ Quick Start

### Interactive Command Center
Simply run `omx` without arguments to open the interactive command center:

```bash
omx
```

```
┌  🐙 octomux (omx) — GitHub Identity & SSH Manager
│
◇  What would you like to do?
│  ● 📋 List configured accounts
│  ○ ➕ Add a new GitHub account
│  ○ ✏️  Edit an existing account
│  ○ 🔑 Auto-import existing SSH keys
│  ○ 🔀 Switch Git identity (global / local)
│  ○ 🔗 Add or set remote origin for this repo
│  ○ 📦 Smart clone a repository
│  ○ 🔍 Check active Git & SSH status
│  ○ ⚡ Test SSH connections
│  ○ 🗑️  Uninstall & clean up octomux
│  ○ 🚪 Exit
```

---

## 📖 Command Reference

### Account Management (`omx account` / `omx acc`)

#### 1. Add an Account (with Auto-Detected Keys)
```bash
# Interactive setup wizard (automatically scans ~/.ssh and shows detected keys)
omx account add

# Headless / scriptable setup
omx account add \
  --alias work \
  --username johndoe-corp \
  --email john@company.com \
  --git-name "John Doe" \
  --keygen \
  --global
```

#### 2. Edit & Rotate Account (`omx account edit`)
Update any aspect of an existing GitHub account profile:

```bash
# Interactive modular editor (prompts to choose fields: Profile, SSH Key, Rename, Security, Global)
omx account edit work

# Update GitHub username and commit email
omx account edit work -u new-username -e new-email@company.com

# Rotate SSH key: generate a fresh Ed25519 key pair and test connection immediately
omx account edit work --generate-key --key-type ed25519 --test

# Link an existing private SSH key and delete previous key files from disk
omx account edit work --key-path ~/.ssh/id_custom_ed25519 --delete-old-key

# Rename an account alias (automatically migrates SSH host configs & global references)
omx account edit work --rename enterprise

# Update GPG commit signing key ID and GitHub Personal Access Token (PAT)
omx account edit work --signing-key 3AA5C34371567BD2 --token ghp_yourSecretToken

# Set account as active global Git identity
omx account edit work --global
```

##### Supported Edit Flags:
| Flag | Description |
| :--- | :--- |
| `--name <name>` | Update account display label |
| `-u, --username <username>` | Update GitHub username |
| `-e, --email <email>` | Update Git commit email |
| `-g, --git-name <name>` | Update Git author display name |
| `-k, --key-path <path>` | Path to an existing private SSH key |
| `--generate-key` | Generate a new SSH key pair |
| `--key-type <type>` | SSH key type: `ed25519` (default) or `rsa` |
| `--delete-old-key` | Delete previous SSH key files from disk upon replacement |
| `--rename <newAlias>` | Rename account alias identifier |
| `--host-alias <alias>` | Update custom SSH Host alias |
| `--signing-key <keyId>` | Update GPG commit signing key ID |
| `--token <token>` | Update GitHub Personal Access Token (PAT) |
| `--global` | Set this account as the active global Git identity |
| `--test` | Test SSH authentication with GitHub after updating |
| `--json` | Output updated profile in JSON format |

#### 3. Auto-Import Existing SSH Keys
```bash
# Interactive key auto-discovery & import wizard:
omx account import
# or shorthand:
omx import

# Import a specific existing private key directly:
omx import ~/.ssh/id_rsa_work --alias work --username johndoe --email john@work.com
```

#### 4. List Accounts
```bash
omx account list
# or shorthand:
omx ls
```

#### 5. Remove an Account
```bash
omx account remove work
# Delete associated SSH keys as well:
omx account remove work --delete-keys --yes
```

#### 6. Test SSH Connection
```bash
# Test specific profile
omx account test work

# Test all profiles
omx account test --all
```


---

### Identity Switcher (`omx switch` / `omx use`)

```bash
# Interactive switcher (prompts for account and local/global scope)
omx switch

# Switch global Git configuration
omx switch work --global

# Switch local repository Git configuration & dedicated SSH key
omx switch work --local
```

---

### Status Check (`omx status` / `omx current`)

Inspect active global and local Git identities and match them against configured `octomux` profiles:

```bash
omx status
```

---

### Remote Origin Configuration (`omx remote` / `omx origin`)

Attach or update a Git remote origin for an existing local repository and automatically bind the local author and SSH key:

```bash
# Interactive wizard (prompts for repo URL/slug and account profile)
omx remote

# Set origin to a GitHub repository using a specific account profile:
omx remote owner/repo -a work

# Or with shorthand alias:
omx origin owner/repo -a personal
```

#### What `omx remote` does:
1. Translates the repo slug/URL into `git@github.com-<alias>:owner/repo.git`.
2. Adds or updates `origin` remote (`git remote add` or `git remote set-url`).
3. Automatically sets local repository `user.name`, `user.email`, and `core.sshCommand`.

---

### Smart Clone (`omx clone`)

Clone any repository and automatically bind the local repository author name, email, and SSH key identity:

```bash
# Clone with interactive account picker
omx clone facebook/react

# Clone with explicit account identity
omx clone facebook/react -a work

# Clone into custom target directory
omx clone https://github.com/facebook/react.git my-react -a personal
```

#### What happens behind the scenes:
1. Translates the clone URL to `git@github.com-work:facebook/react.git`.
2. Runs `git clone`.
3. Navigates into the newly cloned repository directory and configures:
   - `git config --local user.name "<gitUserName>"`
   - `git config --local user.email "<email>"`
   - `git config --local core.sshCommand "ssh -i <keyPath> -o IdentitiesOnly=yes"`
4. Guarantees every future `git commit` and `git push` in that repo will use the correct identity.

---

## 🛠️ Architecture & Data Safety

### SSH Configuration Isolation (`~/.ssh/config`)
`octomux` isolates its host definitions inside marked delimiters. Your existing custom SSH entries are never modified or deleted:

```sshconfig
# Existing user configurations are preserved
Host my-vps
    HostName 192.168.1.100
    User root

# === OCTOMUX MANAGED HOSTS: START ===
# This block is automatically managed by octomux (omx).
Host github.com-work
    HostName github.com
    User git
    IdentityFile "C:/Users/User/.ssh/id_ed25519_octomux_work"
    IdentitiesOnly yes

Host github.com-personal
    HostName github.com
    User git
    IdentityFile "C:/Users/User/.ssh/id_ed25519_octomux_personal"
    IdentitiesOnly yes
# === OCTOMUX MANAGED HOSTS: END ===
```

---

## 🧪 Testing

```bash
# Run unit & integration tests
npm test

# Run type check
npm run typecheck

# Build bundle with tsup
npm run build
```

---

## 🧹 Safe Uninstallation & Cleanup

To safely remove `octomux` configurations and clean up your system:

### 1. Using the Built-in Command:
```bash
# Clean ~/.ssh/config and ~/.octomux data (prompts for options)
omx uninstall

# Or completely purge everything including generated SSH keys without prompts:
omx uninstall --delete-keys --yes
```

### 2. Remove the NPM Binary:
```bash
# If installed globally via npm:
npm uninstall -g @siamriaz/octomux

# If linked locally during development:
npm unlink -g octomux
```

---

## 📄 License

MIT © [Octomux Contributors](LICENSE)
