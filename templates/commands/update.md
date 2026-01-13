---
allowed-tools: [Bash, Read, Write]
description: 'Update prjct-cli installation - sync commands, statusline, config'
---

# p. update - Update prjct-cli Installation

Run this after `npm update -g prjct-cli` to sync all components.

## What It Does

1. Syncs commands to `~/.claude/commands/p/`
2. Updates statusline in `~/.prjct-cli/statusline/`
3. Updates global CLAUDE.md config
4. Updates project versions

## Execute

Run the setup script directly:

```bash
node "$(npm root -g)/prjct-cli/dist/core/infrastructure/setup.js"
```

If that fails, try with bun:

```bash
bun "$(npm root -g)/prjct-cli/core/infrastructure/setup.ts"
```

## Output

```
✓ prjct-cli updated to v{version}

Commands: {n} synced
Statusline: updated
Config: updated
```
