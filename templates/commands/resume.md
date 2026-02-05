---
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
---

# p. resume

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read Current State

READ `{globalPath}/storage/state.json`

```
IF currentTask exists AND currentTask.status == "active":
  OUTPUT:
  """
  Already active: {currentTask.description}

  To pause: `p. pause`
  To complete: `p. done`
  """
  STOP

IF (no pausedTasks OR pausedTasks is empty):
  OUTPUT: "Nothing to resume. Use `p. task` to start a new task."
  STOP
```

## Step 3: Select Task to Resume

```
IF pausedTasks.length == 1:
  taskToResume = pausedTasks[0]
ELSE:
  # Multiple paused tasks - let user choose
  Show list:
  """
  Multiple paused tasks:

  1. {pausedTasks[0].description} (paused {time ago})
     Reason: {pauseReason}
  2. {pausedTasks[1].description} (paused {time ago})
     Reason: {pauseReason}
  ...
  """

  AskUserQuestion:
    question: "Which task do you want to resume?"
    header: "Resume"
    options:
      - label: "{pausedTasks[0].description}"
        description: "Paused {time ago} - {pauseReason}"
      - label: "{pausedTasks[1].description}"
        description: "Paused {time ago} - {pauseReason}"
      ... (up to 4 options)

  taskToResume = selected task
```

## Step 4: Calculate Away Duration

```bash
# Get current timestamp
node -e "console.log(new Date().toISOString())"
```

Calculate time since `taskToResume.pausedAt`.

## Step 5: Switch to Task Branch (if needed)

```bash
git branch --show-current
```

```
IF taskToResume.branch exists AND currentBranch != taskToResume.branch:
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
        - label: "Cancel resume"
          description: "Stay on current branch"

    Handle response appropriately

  git checkout {taskToResume.branch}
```

## Step 6: Update State

```
resumedTask = taskToResume
resumedTask.status = "active"
resumedTask.resumedAt = "{timestamp}"
resumedTask.pausedDuration = "{away duration}"

# Remove from pausedTasks
state.pausedTasks = state.pausedTasks.filter(t => t.id != resumedTask.id)
state.currentTask = resumedTask
```

WRITE `{globalPath}/storage/state.json`:
```json
{
  "currentTask": {
    "id": "{task.id}",
    "description": "{task.description}",
    "type": "{task.type}",
    "status": "active",
    "startedAt": "{task.startedAt}",
    "resumedAt": "{timestamp}",
    "pausedDuration": "{away duration}",
    "subtasks": [...],
    "currentSubtaskIndex": {task.currentSubtaskIndex},
    "parentDescription": "{task.parentDescription}",
    "branch": "{task.branch}",
    "linearId": "{task.linearId or null}"
  },
  "pausedTasks": [...remaining paused tasks],
  "previousTask": {...}
}
```

## Step 7: Load Context

Load agents for context:
```
GLOB: {globalPath}/agents/*.md

FOR each agent file:
  READ agent content for domain patterns
```

## Step 8: Log Event

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"task_resumed","taskId":"{id}","description":"{description}","timestamp":"{timestamp}","pausedDuration":"{away duration}"}
```

---

## Output

```
▶️ Resumed: {task.parentDescription}

Was paused: {pausedDuration}
{IF task.subtasks: "Current subtask: {current subtask}"}
Branch: {task.branch}

Next:
- Continue work → make changes
- Finish subtask → `p. done`
- Pause again → `p. pause`
```
