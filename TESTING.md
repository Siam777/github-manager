# 🧪 Testing & Verification Guide: `octomux` (`omx`)

This guide provides automated scripts and manual test cases to verify `octomux` on your machine.

---

## ⚡ 1-Click Automated Build & Local Install

### On Windows (PowerShell):
```powershell
.\build-and-test.ps1
```

### On Linux / macOS / Git Bash:
```bash
chmod +x build-and-test.sh
./build-and-test.sh
```

---

## 📋 Manual Verification Scenarios

### Scenario 1: Interactive Dashboard
Run without arguments to verify the `@clack/prompts` interface:
```bash
omx
```
Navigate using arrow keys and press Enter to select an action.

---

### Scenario 2: Add a New GitHub Profile
```bash
omx account add --alias work --username octocat --email octocat@github.com --git-name "Mona Lisa" --keygen --global
```
**Expected Outcome**:
- Generates an Ed25519 SSH key at `~/.ssh/id_ed25519_octomux_work`.
- Updates `~/.ssh/config` with host alias `Host github.com-work`.
- Sets global git config `user.name` and `user.email`.
- Displays the public key formatted card with a link to add it to GitHub.

---

### Scenario 3: List Configured Accounts
```bash
omx ls
# or with JSON output:
omx ls --json
```
**Expected Outcome**:
Displays a formatted table showing the alias, GitHub user, email, author name, and active status.

---

### Scenario 4: Check Active Status
```bash
omx status
```
**Expected Outcome**:
Displays a card with current global Git author details, current directory repository status, and matches against your configured `octomux` accounts.

---

### Scenario 5: Switch Git Identity
```bash
# Switch global Git identity
omx switch work --global

# Switch current repository's local Git identity & SSH key
omx switch work --local
```

---

### Scenario 6: Smart Clone
```bash
# Clone a repository using the 'work' profile
omx clone facebook/react -a work
```
**Expected Outcome**:
- Translates URL to `git@github.com-work:facebook/react.git`.
- Clones into `./react`.
- Automatically sets local repository `user.name`, `user.email`, and `core.sshCommand`.

---

## 🧹 Safe Uninstallation & Cleanup

### Automated 1-Click Uninstall:
- **Windows (PowerShell)**:
  ```powershell
  .\uninstall.ps1
  ```
- **Linux / macOS / Git Bash**:
  ```bash
  chmod +x uninstall.sh
  ./uninstall.sh
  ```

### Or using the CLI:
```bash
omx uninstall
npm unlink -g octomux
```
