---
allowed-tools: [Bash, Read, Write, Glob]
description: 'Force update prjct-cli - sync all templates from npm package'
---

# p. update - Force Update prjct-cli

Manually sync all templates from npm package to local installation.

## Step 1: Find npm package location

```bash
npm root -g
```

Save this path as `NPM_ROOT`.

## Step 2: Copy p.md router

Read: `{NPM_ROOT}/prjct-cli/templates/commands/p.md`
Write to: `~/.claude/commands/p.md`

## Step 3: Copy ALL command templates

For each `.md` file in `{NPM_ROOT}/prjct-cli/templates/commands/`:
- Read the file
- Write to `~/.claude/commands/p/{filename}`

## Step 4: Update CLAUDE.md

Read: `{NPM_ROOT}/prjct-cli/templates/global/CLAUDE.md`

Check if `~/.claude/CLAUDE.md` exists:
- If NOT exists: Write the template content directly
- If exists: Find markers `<!-- prjct:start -->` and `<!-- prjct:end -->`, replace content between them

## Step 5: Copy statusline

Copy from `{NPM_ROOT}/prjct-cli/assets/statusline/` to `~/.prjct-cli/statusline/`:
- `statusline.sh`
- `lib/*.sh`
- `components/*.sh`
- `themes/*.json`

## Step 6: Get version and confirm

```bash
cat "$(npm root -g)/prjct-cli/package.json" | grep '"version"'
```

## Output

```
✅ prjct-cli updated

Commands: synced to ~/.claude/commands/p/
Config: ~/.claude/CLAUDE.md updated
Statusline: ~/.prjct-cli/statusline/ updated
```

## Action

NOW execute steps 1-6 in order. Use Bash to find npm root, then Read/Write to copy files.
