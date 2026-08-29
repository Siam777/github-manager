# Project Guidelines & Rules: `octomux` (`omx`)

This project implements `octomux`, a professional-grade, cross-platform GitHub multi-account and SSH identity management CLI.

---

## 1. Architectural Principles

- **Layered / Domain-Driven Design**:
  - `src/commands/`: CLI command entry points, argument/flag parsing, high-level workflow orchestration.
  - `src/core/`: Domain business logic (Account Manager, SSH Service, Git Service, Config Store).
  - `src/platform/`: OS-specific abstractions (Path handling, file permissions, shell environment).
  - `src/ui/`: Formatting, interactive prompts (`@clack/prompts`), colored logging (`picocolors`), and spinners (`ora`).
  - `src/types/`: Strict TypeScript interfaces and Zod validation schemas.

- **Zero-Data-Loss Guarantee**:
  - All modifications to `~/.ssh/config` MUST preserve existing user entries.
  - All file write operations to configuration and SSH files MUST be atomic and create automated backup copies (`.bak`).
  - Use delimiter blocks (`# === OCTOMUX MANAGED HOSTS: START ===` / `END`) for SSH configuration isolation.

- **Cross-Platform Compatibility**:
  - Support Windows (PowerShell, CMD, Git Bash, OpenSSH), macOS, and Linux seamlessly.
  - In `~/.ssh/config`, always normalize file paths to POSIX `/` forward slashes.
  - Set `chmod 0600` on generated private SSH keys on Unix-like operating systems.

---

## 2. TypeScript & Code Standards

- **Strict TypeScript**: `noImplicitAny: true`, `strict: true`. Never use `any` — use precise interfaces, generics, or `unknown` with type guards.
- **Runtime Validation**: Use `zod` to validate all configuration files loaded from disk.
- **Graceful Error Handling**: Never dump unhandled raw stack traces to the end-user. Wrap errors with descriptive actionable error messages.
- **Dual-Mode Execution**:
  - Interactive mode with rich prompts when executed in a TTY without arguments.
  - Non-interactive / headless mode with CLI flags (`--json`, `--quiet`, `--yes`) for CI/CD and scripts.

---

## 3. Testing & Verification

- Every core service (`AccountManager`, `SshService`, `GitService`, `ConfigStore`) must have comprehensive unit tests using `vitest`.
- Mock file systems and child processes cleanly to test Windows, macOS, and Linux edge cases without modifying actual system files during test runs.
