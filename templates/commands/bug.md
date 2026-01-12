---
allowed-tools: [Read, Write, Bash, Task, Glob, AskUserQuestion]
description: 'Report bug with auto-priority and auto-start'
---

# p. bug - Report Bug

**See:** `@templates/shared/standard.md` for context variables and patterns.

## Usage

```
p. bug <description> [--later]
```

## Severity Detection

| Keywords | Severity |
|----------|----------|
| crash, down, broken, production | critical |
| error, fail | high |
| bug, incorrect | medium |
| minor, typo | low |

---

## Step 1: Validate & Load (PARALLEL)

```
READ (parallel):
- .prjct/prjct.config.json → {projectId}
- {globalPath}/storage/state.json → {state}
- {globalPath}/storage/queue.json → {queue}
```

---

## Step 2: Handle Active Task

IF `--later`: Queue only → Step 4

IF state.currentTask active:
```
AskUserQuestion:
  - "Pause and fix bug" → save as interruptedTask
  - "Queue for later" → queue only
```

---

## Step 3: Create Bug Branch (if on main)

```bash
git branch --show-current && git status --porcelain
```

IF on main:
- Critical/high: auto-stash → create branch
- Other: AskUserQuestion → Stash/Commit/Abort

```bash
git checkout -b bug/{slug}
```

---

## Step 4: Update Storage (PARALLEL WRITES)

```
WRITE (parallel):
- {globalPath}/storage/queue.json → insert bug task
- {globalPath}/storage/state.json → set currentTask (if auto-start)
- {globalPath}/context/now.md → current bug

APPEND: {globalPath}/memory/events.jsonl
APPEND: {globalPath}/sync/pending.json
```

---

## Output

### Auto-Started
```
🐛 [{severity}] {description}
Branch: {branchName}

p. done when fixed
```

### Queued
```
🐛 [{severity}] {description}
Queued #{position}

p. task "🐛 {description}" to start
```

### Interrupted Task
```
🐛 [{severity}] {description}
⏸️ Paused: {previousTask}

p. done → will ask to resume
```
