---
allowed-tools: [Bash, Read, Write]
---

# p. merge

```bash
prjct context merge
```

IF no `currentTask` → "No active task"
IF no PR → "Run p. review first"

```bash
gh pr view {prNumber} --json reviewDecision,mergeable,state
```

IF not approved → "Get approvals first"
IF has conflicts → "Resolve conflicts first"

```bash
gh pr merge {prNumber} --squash --auto
git checkout main && git pull
```

Delete branch if created by prjct

**Output**:
```
✅ PR Merged

PR: #{prNumber}
Strategy: squash

Next:
- Release → `p. ship`
- New task → `p. task "description"`
```
