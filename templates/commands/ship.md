---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. ship "$ARGUMENTS"

```bash
prjct context ship $ARGUMENTS
```

IF `currentTask` active → Ask: "Complete and ship?" or "Cancel"

```bash
git status --porcelain  # No changes? STOP
git diff --stat HEAD
```

Run lint/tests if configured

IF not trivial → Review for security issues, error handling

Version bump (patch default, minor for feat:, major for BREAKING)
Update CHANGELOG.md

```bash
gh auth status  # Not auth? STOP
git branch --show-current  # On main? STOP
```

Commit with footer:
```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

```bash
git add . && git commit && git push -u origin {branch}
gh pr create --title "feat: {feature}" --base main
```

**Output**:
```
🚀 Shipped: {feature}

Version: {old} → {new}
PR: {url}
CI: {status}

Next:
- CI failed? → Fix and push again
- Merge ready? → `p. merge` or merge in GitHub
- New task? → `p. task "description"`
```
