---
allowed-tools: [Bash]
description: 'Deep sync - analyze git, update ALL project data'
orchestrator: false
---

# /p:sync - Project Sync

**Execute the TypeScript CLI to sync everything in ONE command.**

## Step 1: Run CLI Sync

```bash
prjct sync
```

**That's it.** The CLI handles everything:
- Git analysis
- Project stats
- Context file generation
- Agent generation
- Skill configuration
- State updates

## Step 2: Format Output

The CLI outputs the sync results. Present them to the user.

## Why This Works

The `prjct sync` command runs ALL operations in TypeScript:
- No individual Read/Write calls
- No individual Bash calls
- ONE permission prompt instead of 50+

## Error Handling

| Error | Action |
|-------|--------|
| "prjct: command not found" | Run `npm install -g prjct-cli` |
| "No prjct project" | Run `p. init` first |
| Other errors | Show error message |
