---
allowed-tools: [Read, Write, Bash, Task, AskUserQuestion]
---

# p. bug "$ARGUMENTS"

```bash
prjct context bug $ARGUMENTS
```

Parse severity from keywords:
- crash/down/broken/production → critical
- error/fail → high
- bug/incorrect → medium (default)
- minor/typo → low

USE Task(Explore) → find affected files, recent commits

IF `currentTask` active:
  Ask: "Pause current and fix?" or "Queue for later"
  IF pause → save as `interruptedTask`

IF on main → `git checkout -b bug/{slug}`

UPDATE `{globalPath}/storage/state.json` with new bug task
ADD to `{globalPath}/storage/queue.json`

**Output**:
```
🐛 [{severity}] $ARGUMENTS

Affected: {files}
Branch: {branch}

Next:
- Fix the bug → `p. done`
- Queue only → add `--later` flag
```
