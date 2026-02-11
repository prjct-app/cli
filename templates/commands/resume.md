---
allowed-tools: [Bash, AskUserQuestion]
---

# p. resume

## ⚡ FAST COMMAND — Execute Immediately

### Step 1: Resume Task

```bash
prjct resume
```

The CLI handles:
- Checking for active tasks (blocks if already working)
- Selecting from paused tasks (if multiple, uses most recent)
- Updating state in SQLite
- Logging events

### Step 2: Switch to Task Branch (if needed)

```bash
git branch --show-current
```

```
IF the resumed task has a branch AND currentBranch != task.branch:
  # Check for uncommitted changes first
  git status --porcelain

  IF uncommitted changes:
    AskUserQuestion:
      question: "You have uncommitted changes. What should we do?"
      header: "Git"
      options:
        - label: "Stash changes"
          description: "Save changes and switch branches"
        - label: "Commit changes"
          description: "Commit before switching"
        - label: "Cancel"
          description: "Stay on current branch"

    Handle response appropriately

  git checkout {task.branch}
```

---

## Output

```
▶️ Resumed: {task description}

Was paused: {duration}
Branch: {task.branch}

Next:
- Continue work → make changes
- Finish subtask → `p. done`
- Pause again → `p. pause`
```
