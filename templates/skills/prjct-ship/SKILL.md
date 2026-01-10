---
name: prjct-ship
description: Ship a feature with PR, version bump, and changelog. Use when user says "p. ship", wants to release/deploy, or is ready to merge their work.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, TodoWrite]
user-invocable: true
---

# prjct Ship

Ship features with automated PR creation, version bumping, and changelog updates.

## Context Loading (ALWAYS FIRST)

```
1. Read `.prjct/prjct.config.json` → extract projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. Read {globalPath}/storage/state.json → current/last task
4. Check git status for branch and changes
```

## Ship Workflow

### 1. Pre-Ship Checks

```bash
# Check for uncommitted changes
git status --porcelain

# Check current branch (should not be main/master)
git branch --show-current

# Run tests if configured
npm test || bun test || yarn test
```

### 2. Create/Update PR

If on feature branch:
```bash
# Push branch
git push -u origin $(git branch --show-current)

# Create PR with gh CLI
gh pr create --title "feat: {feature name}" --body "..."
```

PR body template:
```markdown
## Summary
{Brief description}

## Changes
- {change 1}
- {change 2}

## Test Plan
- [ ] Tests pass
- [ ] Manual verification

---
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

### 3. Version Bump (if applicable)

Read `package.json`, determine bump type:
- **patch**: Bug fixes (0.0.x)
- **minor**: New features (0.x.0)
- **major**: Breaking changes (x.0.0)

```bash
npm version patch -m "chore: bump version to %s"
```

### 4. Update Changelog

Prepend to `CHANGELOG.md`:
```markdown
## [x.x.x] - YYYY-MM-DD

### Added
- {new feature}

### Fixed
- {bug fix}
```

### 5. Record Shipment

Write to `{globalPath}/storage/shipped.json`:
```json
{
  "shipped": [
    {
      "id": "uuid",
      "name": "{feature}",
      "version": "x.x.x",
      "prUrl": "https://github.com/...",
      "shippedAt": "ISO timestamp"
    }
  ]
}
```

### 6. Update Context

Write to `{globalPath}/context/shipped.md`:
```markdown
# Recently Shipped

## {feature name}
- Version: x.x.x
- PR: {url}
- Date: {date}
```

### 7. Log Event

Append to `{globalPath}/memory/events.jsonl`:
```json
{"timestamp": "...", "action": "feature_shipped", "feature": {...}, "version": "..."}
```

## Paths (CRITICAL)

| Type | Path | Access |
|------|------|--------|
| Config | `.prjct/prjct.config.json` | Read-only |
| Storage | `{globalPath}/storage/shipped.json` | Read-Write |
| Context | `{globalPath}/context/shipped.md` | Write |
| Memory | `{globalPath}/memory/events.jsonl` | Append |

## Git Commit Footer

ALWAYS include in commits:
```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

## Output Format

```
🚀 SHIPPED: {feature name}

Version: {x.x.x}
PR: {url}
Next: Celebrate! Then p. task "next feature"
```
