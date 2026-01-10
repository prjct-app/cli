---
allowed-tools: [Read, Edit, Bash]
description: 'Code cleanup'
tool-permissions:
  bash:
    allow: ["git status", "find . -type f", "wc -l"]
    ask: ["rm *", "git clean"]
    deny: ["rm -rf /", "rm -rf ~", "rm -rf .", "git reset --hard"]
---

# /p:cleanup

## Types
- **code**: Remove logs, dead code
- **imports**: Clean unused
- **files**: Remove temp/empty
- **deps**: Find unused
- **all**: Everything

## Flow
Parse type → Backup → Clean → Validate → Log

## Response
`🧹 Cleaned: {N} logs, {N} dead code, {N} imports | Freed: {X}MB`
