# Git Operations (Batched)

## Quick Status (Single Call)

```bash
git status --porcelain && git branch --show-current && git rev-list --count HEAD 2>/dev/null
```

Returns:
- Uncommitted changes (first lines)
- Current branch
- Commit count

## Full Analysis (Single Call)

```bash
git status --porcelain && \
git log --oneline -10 --pretty=format:"%h|%s" && \
git branch --show-current && \
git rev-list --count HEAD && \
git diff --stat HEAD~1 2>/dev/null
```

## Branch Operations

### Create Feature Branch
```bash
git checkout -b {branchName} && git push -u origin {branchName}
```

### Check Branch State
```bash
git log main..HEAD --oneline 2>/dev/null | wc -l
```

## Stash Operations (for interrupts)

```bash
# Save work
git stash push -m "prjct: {reason}" --include-untracked

# Restore work
git stash pop
```

## Diff Analysis

```bash
# Files changed
git diff --name-only HEAD~{N}

# Stats
git diff --stat HEAD~{N}

# Full diff for review
git diff HEAD~{N}
```

## Commit (with prjct footer)

```bash
git add -A && git commit -m "$(cat <<'EOF'
{message}

🤖 Generated with [p/](https://www.prjct.app/)
EOF
)"
```
