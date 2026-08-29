# `octomux` (`omx`) — Enterprise-Grade Cross-Platform GitHub Manager CLI

> **The ultimate GitHub multi-account multiplexer, SSH identity manager, and smart repository cloning tool.**

---

## 1. Project Identity & Command Naming

- **Package Name**: `octomux` (or `@octomux/cli`)
- **Primary Binary Command**: `octomux`
- **Short Alias Command**: `omx`
- **Tagline**: Seamlessly multiplex GitHub accounts, SSH keys, and Git identities across repositories and platforms.

---

## 2. Core Value Proposition & Architecture

Developers managing multiple GitHub profiles (Personal, Work, Client, Open Source) face continuous friction with SSH collisions, leaked personal emails in enterprise commits, and tedious manual `~/.ssh/config` edits.

`octomux` solves this at the root by combining:
1. **Centralized Profile Store**: Stores account metadata, SSH keys, GPG signing keys, and optional Personal Access Tokens (PAT).
2. **Safe SSH Engine**: Automatically synchronizes and updates `~/.ssh/config` with dedicated Host aliases (`Host github.com-<alias>`) without destroying existing user configs.
3. **Identity Switcher**: Instantly toggles global or repository-local `user.name`, `user.email`, and `core.sshCommand`.
4. **Smart Clone**: `omx clone <repo-url-or-slug>` clones with the chosen profile's SSH host and automatically binds local repository Git credentials upon clone completion.

```
┌─────────────────────────────────────────────────────────────┐
│                      octomux CLI (omx)                      │
├──────────────────────────────┬──────────────────────────────┤
│ Interactive TUI Mode         │ Scriptable Headless Mode     │
│ (@clack/prompts, picocolors) │ (--json, --yes, --quiet)     │
└──────────────┬───────────────┴──────────────┬───────────────┘
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Domain Services Layer                    │
├──────────────────┬──────────────────┬───────────────────────┤
│ Account Service  │ SSH Config Engine│ Git Identity Service  │
│ (CRUD, Profiles) │ (AST Parser/Gen) │ (Local/Global Config) │
└────────┬─────────┴────────┬─────────┴───────────┬───────────┘
         ▼                  ▼                     ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ Storage Adapter │ │ Platform Adapter│ │ Native Git / SSH    │
│ (~/.octomux/    │ │ (Win / macOS /  │ │ Execution Engine    │
│  config.json)   │ │  Linux paths)   │ │ (execa / node:child)│
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

---

## 3. Professional-Grade Standards & Quality Pillars

To ensure `octomux` is a top-tier, production-ready npm package:

### 3.1 Robustness & Data Safety
- **Atomic Writes & Backups**: Config files (`~/.octomux/config.json`) and SSH configs (`~/.ssh/config`) are updated atomically with automatic backup creation (`~/.ssh/config.bak`) and rollback on failure.
- **AST/Block Delimited Parsing**: Uses structured section markers (`# === OCTOMUX MANAGED HOSTS: START ===`) to ensure user-defined SSH configs are never altered or deleted.
- **Cross-Platform Path Normalization**:
  - Windows: Automatic POSIX path conversion (`C:/Users/...`) in SSH config, handling OpenSSH for Windows vs Git for Windows.
  - Linux / macOS: Strict file permissions (`0600` for private keys, `0700` for `~/.ssh`).

### 3.2 Developer Experience (DX) & Dual-Mode CLI
- **Interactive TUI**: Sleek visual prompts with spinners (`ora`), formatted tables (`cli-table3`), and clean selection menus (`@clack/prompts`).
- **Headless Automation**: Every command fully supports CLI flags for CI/CD, dotfiles scripts, and automation (`--json` output, `--quiet`, `--yes`).
- **Comprehensive Shell Completions**: Auto-completion scripts for Bash, Zsh, PowerShell, and Fish.

### 3.3 Security
- **Strict Key Permissions**: Automatically sets `chmod 0600` on generated/imported private keys.
- **Safe Token Handling**: Personal Access Tokens (optional) are stored securely and never logged in console outputs or crash reports.

### 3.4 Code Quality & Testing
- **100% Strict TypeScript**: Zero `any` policy, complete type definitions, and runtime schema validation with `zod`.
- **High Test Coverage**: Vitest unit tests for domain logic, cross-platform path parsers, and SSH config serializers.
- **Automated CI/CD**: GitHub Actions workflow for linting, testing on Windows/Ubuntu/macOS runners, and automated npm publishing with provenance.

---

## 4. Complete CLI Command Specification

### 4.1 Account Management (`omx account` / `omx acc`)

```bash
# Add a new account (Interactive Wizard)
omx account add

# Add a new account (Headless / Flags)
omx account add \
  --alias work \
  --username johndoe-corp \
  --email john@company.com \
  --git-name "John Doe" \
  --keygen \
  --global

# List all configured accounts with SSH and Git status
omx account list # (or `omx ls`)

# Update an existing account profile
omx account edit [alias]

# Remove an account profile (with optional SSH key cleanup)
omx account remove [alias]

# Test SSH & GitHub API connectivity for an account
omx account test [alias]
```

### 4.2 Git Identity Configuration (`omx switch` & `omx status`)

```bash
# Show current Git status (active global & local identities + active SSH key)
omx status # (or `omx current`)

# Switch global Git configuration to an account
omx switch --global [alias]
# Executes:
#   git config --global user.name "<gitUserName>"
#   git config --global user.email "<email>"

# Switch local Git configuration in current repository
omx switch --local [alias]
# Executes:
#   git config --local user.name "<gitUserName>"
#   git config --local user.email "<email>"
#   git config --local core.sshCommand "ssh -i <keyPath> -o IdentitiesOnly=yes"
```

### 4.3 Smart Clone (`omx clone`)

```bash
# Clone via repository slug (Interactive account picker if -a omitted)
omx clone facebook/react

# Clone with explicit account identity
omx clone facebook/react -a work

# Clone into custom target directory
omx clone git@github.com:facebook/react.git my-react-dir -a personal

# Clone HTTPS URL (automatically converts to dedicated SSH Host)
omx clone https://github.com/facebook/react.git -a work
```

#### What `omx clone` does behind the scenes:
1. Resolves the target account profile (`work` -> `Host github.com-work`, `Key ~/.ssh/id_ed25519_work`).
2. Converts clone URL to `git@github.com-work:owner/repo.git`.
3. Runs `git clone`.
4. Navigates into the newly cloned directory and immediately executes:
   - `git config --local user.name "<gitUserName>"`
   - `git config --local user.email "<email>"`
   - `git config --local core.sshCommand "ssh -i <keyPath> -o IdentitiesOnly=yes"`
5. Displays a success card with the configured repository identity.

---

## 5. Implementation Roadmap & Milestones

| Milestone | Deliverables | Target Timeline |
| :--- | :--- | :--- |
| **M1: Core Scaffolding & Config Store** | - TypeScript, tsup, ESLint, Vitest setup<br>- `~/.octomux/config.json` schema & Zod validation<br>- Cross-platform OS path resolver (Win/Mac/Linux) | Day 1-2 |
| **M2: SSH Engine & Account CRUD** | - SSH key generator (`ed25519`, `rsa`)<br>- AST/Section-based `~/.ssh/config` parser & sync engine<br>- `omx account add/edit/list/remove/test` | Day 3-5 |
| **M3: Git Identity & Smart Clone** | - `omx switch --global` & `omx switch --local`<br>- `omx status / current` reader<br>- `omx clone` pipeline with post-clone local config hook | Day 6-7 |
| **M4: Interactive TUI & DX Polish** | - `@clack/prompts` interactive flow<br>- Formatted `cli-table3` & `boxen` output<br>- Comprehensive help menus and error boundary | Day 8-9 |
| **M5: Tests, Documentation & Release** | - Vitest unit & mock integration tests<br>- GitHub Actions CI pipeline (multi-OS matrix)<br>- README, shell completion scripts, npm publish prep | Day 10 |

---

## 6. Directory Structure

```
octomux/
├── .agent/
│   └── skills/
│       ├── npm-package-release/
│       │   └── SKILL.md
│       └── ssh-git-troubleshooter/
│           └── SKILL.md
├── bin/
│   └── octomux.ts           # Executable entry point (#!/usr/bin/env node)
├── src/
│   ├── commands/            # CLI Command handlers
│   │   ├── account/
│   │   │   ├── add.ts
│   │   │   ├── edit.ts
│   │   │   ├── list.ts
│   │   │   ├── remove.ts
│   │   │   └── test.ts
│   │   ├── clone.ts
│   │   ├── status.ts
│   │   └── switch.ts
│   ├── core/                # Domain Business Logic
│   │   ├── account-manager.ts
│   │   ├── config-store.ts
│   │   ├── git-service.ts
│   │   └── ssh-service.ts
│   ├── platform/            # OS-specific adapters (Windows, macOS, Linux)
│   │   ├── paths.ts
│   │   └── permissions.ts
│   ├── types/               # Type definitions & Zod schemas
│   │   ├── config.ts
│   │   └── account.ts
│   ├── ui/                  # UI, formatting, tables & prompts
│   │   ├── formatters.ts
│   │   ├── logger.ts
│   │   └── prompts.ts
│   └── index.ts             # CLI Program bootstrap (Commander setup)
├── tests/                   # Vitest unit & integration tests
│   ├── account-manager.test.ts
│   ├── config-store.test.ts
│   ├── git-service.test.ts
│   └── ssh-service.test.ts
├── .github/
│   └── workflows/
│       ├── ci.yml           # Multi-OS CI tests (Windows, Ubuntu, macOS)
│       └── release.yml      # Automated NPM publishing
├── GEMINI.md                # Project development rules & guidelines
├── planning.md              # Project architecture & specification
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```
