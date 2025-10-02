# Installation Guide

Comprehensive installation guide for **prjct-cli** across different platforms and package managers.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation Methods](#installation-methods)
  - [Homebrew (macOS/Linux)](#homebrew-macoslinux)
  - [Bun](#bun)
  - [npm/Node.js](#npmnode js)
  - [Quick Install Script](#quick-install-script)
- [Post-Installation](#post-installation)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## Quick Start

**Choose your preferred method:**

| Method | Command | Best For |
|--------|---------|----------|
| **Homebrew** | `brew tap jlopezlira/prjct && brew install prjct` | macOS users |
| **Bun** | `curl -fsSL https://prjct.dev/install-bun.sh \| bash` | Speed enthusiasts |
| **npm** | `npm install -g @prjct/cli` | Node.js developers |
| **Script** | `curl -fsSL https://prjct.app/install.sh \| bash` | Cross-platform |

---

## Installation Methods

### Homebrew (macOS/Linux)

**Recommended for macOS users** - Provides automatic updates, clean uninstall, and system integration.

#### Prerequisites

- macOS 10.15+ or Linux
- Homebrew installed ([installation guide](https://brew.sh))

#### Installation

```bash
# Add prjct tap
brew tap jlopezlira/prjct

# Install prjct
brew install prjct

# Verify installation
prjct --version
```

#### Updating

```bash
brew upgrade prjct
```

#### Uninstalling

```bash
brew uninstall prjct
brew untap jlopezlira/prjct
```

#### Benefits

✅ Automatic dependency management
✅ Easy updates via `brew upgrade`
✅ Clean uninstall
✅ System PATH configuration handled automatically
✅ MCP setup runs automatically

---

### Bun

**Lightning-fast installation** - 10x faster than npm with modern JavaScript runtime.

#### Prerequisites

- Bun 1.0+ ([installation guide](https://bun.sh))
- Git

#### Installation

```bash
curl -fsSL https://prjct.dev/install-bun.sh | bash
```

The script will:
1. Check for Bun (offers to install if missing)
2. Clone the repository to `~/.prjct-cli`
3. Install dependencies with Bun
4. Run setup and MCP configuration
5. Add to PATH

#### Manual Installation

```bash
# Clone repository
git clone https://github.com/jlopezlira/prjct-cli.git ~/.prjct-cli
cd ~/.prjct-cli

# Install dependencies
bun install --production

# Run setup
chmod +x scripts/setup.sh
./scripts/setup.sh

# Add to PATH (choose your shell)
echo 'export PATH="$HOME/.prjct-cli/bin:$PATH"' >> ~/.zshrc  # zsh
echo 'export PATH="$HOME/.prjct-cli/bin:$PATH"' >> ~/.bashrc # bash

# Reload shell
source ~/.zshrc  # or ~/.bashrc
```

#### Updating

```bash
cd ~/.prjct-cli
git pull origin main
bun install --production
```

#### Uninstalling

```bash
rm -rf ~/.prjct-cli
# Remove PATH entry from ~/.zshrc or ~/.bashrc
```

#### Benefits

⚡ 10x faster than npm
⚡ Modern JavaScript runtime
⚡ Zero configuration needed
⚡ Compatible with Node.js packages

---

### npm/Node.js

**Standard npm installation** - Works everywhere Node.js runs.

#### Prerequisites

- Node.js 18.0+ ([installation guide](https://nodejs.org))
- npm (comes with Node.js)

#### Installation

```bash
npm install -g @prjct/cli
```

#### Updating

```bash
npm update -g @prjct/cli
```

#### Uninstalling

```bash
npm uninstall -g @prjct/cli
```

#### Benefits

📦 Standard npm ecosystem
📦 Works on all platforms
📦 Easy version management
📦 Familiar for Node.js developers

---

### Quick Install Script

**Cross-platform bash script** - Automatic platform detection and configuration.

#### Prerequisites

- Node.js 18.0+
- Git
- Bash

#### Installation

```bash
curl -fsSL https://prjct.app/install.sh | bash
```

#### Advanced Options

```bash
# Force reinstall (even if up to date)
curl -fsSL https://prjct.app/install.sh | bash -s -- --force

# Auto-accept all prompts (unattended)
curl -fsSL https://prjct.app/install.sh | bash -s -- -y

# Install from development branch
curl -fsSL https://prjct.app/install.sh | bash -s -- --dev

# Show help
curl -fsSL https://prjct.app/install.sh | bash -s -- --help
```

#### What It Does

1. Checks prerequisites (Node.js, Git)
2. Detects alternative methods (suggests Homebrew/Bun if available)
3. Clones/updates repository to `~/.prjct-cli`
4. Installs dependencies
5. Runs setup script
6. Installs commands to AI editors (interactive selection)
7. Configures PATH

#### Benefits

🌐 Cross-platform support
🌐 Automatic detection of faster methods
🌐 Interactive editor selection
🌐 Comprehensive setup

---

## Post-Installation

### Editor Command Installation

After installation, `prjct` can install commands to your AI editors:

```bash
# Interactive mode (select editors)
prjct install

# Install to all detected editors
prjct install --no-interactive

# Install to specific editor
prjct install --editor claude
prjct install --editor cursor
prjct install --editor windsurf

# Force update existing commands
prjct install --force
```

**Supported Editors:**
- Claude Code (`~/.claude/commands/`)
- Cursor AI (`~/.cursor/commands/`)
- Codeium (`~/.codeium/windsurf/commands/`)

### Initialize Your First Project

```bash
cd your-project
prjct init
```

This creates:
- `.prjct/prjct.config.json` (local config)
- `~/.prjct-cli/projects/{id}/` (global data)

---

## Verification

### Check Installation

```bash
# Check version
prjct --version

# Verify PATH
which prjct

# Test command
prjct init
```

### Expected Output

```bash
$ prjct --version
@prjct/cli v0.4.0

$ which prjct
/Users/you/.local/bin/prjct  # or /opt/homebrew/bin/prjct
```

### Check Editor Integration

**Claude Code:**
```
# In Claude Code, type:
/p:
# Should show autocomplete with prjct commands
```

**Terminal:**
```bash
ls ~/.claude/commands/
# Should show: now.md, ship.md, done.md, etc.
```

---

## Troubleshooting

### Command Not Found

**Symptoms:**
```bash
prjct: command not found
```

**Solutions:**

1. **Reload your shell:**
   ```bash
   source ~/.zshrc   # or ~/.bashrc
   ```

2. **Check PATH:**
   ```bash
   echo $PATH | grep prjct
   ```

3. **Add to PATH manually:**
   ```bash
   export PATH="$HOME/.prjct-cli/bin:$PATH"  # Bun/Script install
   export PATH="/opt/homebrew/bin:$PATH"      # Homebrew (Apple Silicon)
   export PATH="/usr/local/bin:$PATH"         # Homebrew (Intel)
   ```

4. **Verify symlink:**
   ```bash
   ls -la ~/.local/bin/prjct
   ```

### Permission Denied

**Symptoms:**
```bash
permission denied: prjct
```

**Solutions:**

```bash
# Make binary executable
chmod +x ~/.prjct-cli/bin/prjct

# Fix symlink
ln -sf ~/.prjct-cli/bin/prjct ~/.local/bin/prjct
```

### Node.js Version Issues

**Symptoms:**
```
Error: Node.js version must be >= 18.0.0
```

**Solutions:**

```bash
# Check current version
node --version

# Install Node.js 18+ via nvm
nvm install 18
nvm use 18

# Or via Homebrew
brew install node@18
```

### Bun Installation Issues

**Symptoms:**
```
bun: command not found
```

**Solutions:**

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Reload shell
source ~/.zshrc
```

### MCP Setup Failed

**Symptoms:**
- Commands not appearing in Claude Code
- Editor integration not working

**Solutions:**

```bash
# Re-run install command
prjct install --force

# Check editor directories
ls ~/.claude/commands/
ls ~/.cursor/commands/

# Verify templates exist
ls ~/.prjct-cli/templates/commands/
```

### Homebrew Tap Issues

**Symptoms:**
```
Error: No available formula with the name "prjct"
```

**Solutions:**

```bash
# Update Homebrew
brew update

# Re-add tap
brew untap jlopezlira/prjct
brew tap jlopezlira/prjct

# Try again
brew install prjct
```

---

## Uninstallation

### Homebrew

```bash
brew uninstall prjct
brew untap jlopezlira/prjct
```

### Bun/Script Install

```bash
# Run uninstall script
~/.prjct-cli/scripts/uninstall.sh

# Or manual cleanup
rm -rf ~/.prjct-cli
rm ~/.local/bin/prjct
# Remove PATH entry from ~/.zshrc or ~/.bashrc
```

### npm

```bash
npm uninstall -g @prjct/cli
```

### Clean Global Data (Optional)

**Warning:** This removes all your project data, progress, and memories.

```bash
# Backup first (optional)
cp -r ~/.prjct-cli/projects ~/prjct-backup

# Remove global data
rm -rf ~/.prjct-cli/projects
```

### Remove Editor Commands

```bash
# Claude Code
rm -rf ~/.claude/commands/p-*.md

# Cursor
rm -rf ~/.cursor/commands/p-*.md

# Windsurf
rm -rf ~/.codeium/windsurf/commands/p-*.md
```

---

## Platform-Specific Notes

### macOS (Apple Silicon)

- Homebrew installs to `/opt/homebrew/`
- Use `arch -arm64 brew install prjct` if needed

### macOS (Intel)

- Homebrew installs to `/usr/local/`
- Standard installation works

### Linux

- Homebrew supported on Linux
- May need `build-essential` for some dependencies
- Bun is the fastest option for Linux

### Windows (WSL)

- Use WSL2 for best experience
- All Linux methods work
- Path: `/home/username/.prjct-cli`

---

## Getting Help

- **Documentation**: [GitHub Wiki](https://github.com/jlopezlira/prjct-cli/wiki)
- **Issues**: [GitHub Issues](https://github.com/jlopezlira/prjct-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jlopezlira/prjct-cli/discussions)

---

**Happy shipping! 🚀**
