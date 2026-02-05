---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. pause "$ARGUMENTS"

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read Current State

READ `{globalPath}/storage/state.json`

```
IF no currentTask OR currentTask is null:
  OUTPUT: "No active task to pause."
  STOP

IF currentTask.status == "paused":
  OUTPUT:
  """
  ⏸️ Already paused: {currentTask.description}

  To resume: `p. resume`
  """
  STOP
```

## Step 3: Get Pause Reason

```
IF $ARGUMENTS is empty:
  AskUserQuestion:
    question: "Why are you pausing?"
    header: "Pause"
    options:
      - label: "Blocked (waiting on external)"
        description: "Waiting for review, dependency, or other team"
      - label: "Switching task"
        description: "Need to work on something else"
      - label: "Taking a break"
        description: "Stepping away temporarily"
      - label: "Researching"
        description: "Need to investigate before continuing"

  SET pauseReason = selected option

  IF pauseReason == "Blocked":
    ASK: "What's blocking you?"
    SET blockingReason = response
ELSE:
  SET pauseReason = $ARGUMENTS
```

## Step 4: Calculate Duration

```bash
# Get current timestamp
node -e "console.log(new Date().toISOString())"
```

Calculate time elapsed since `currentTask.startedAt` (or `resumedAt` if it exists).

## Step 5: Update State

READ current state, then update:

```
pausedTask = currentTask
pausedTask.status = "paused"
pausedTask.pausedAt = "{timestamp}"
pausedTask.pauseReason = "{pauseReason}"
pausedTask.blockingReason = "{blockingReason if set}"
pausedTask.activeTime = "{duration worked so far}"

state.pausedTasks = state.pausedTasks || []
state.pausedTasks.unshift(pausedTask)  # Add to front
state.currentTask = null
```

WRITE `{globalPath}/storage/state.json`:
```json
{
  "currentTask": null,
  "pausedTasks": [
    {
      "id": "{task.id}",
      "description": "{task.description}",
      "type": "{task.type}",
      "status": "paused",
      "startedAt": "{task.startedAt}",
      "pausedAt": "{timestamp}",
      "pauseReason": "{pauseReason}",
      "blockingReason": "{blockingReason or null}",
      "activeTime": "{duration}",
      "subtasks": [...],
      "currentSubtaskIndex": {task.currentSubtaskIndex},
      "parentDescription": "{task.parentDescription}",
      "branch": "{task.branch}",
      "linearId": "{task.linearId or null}"
    },
    ...existing paused tasks
  ],
  "previousTask": {...}
}
```

## Step 6: Log Event

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"task_paused","taskId":"{id}","description":"{description}","reason":"{pauseReason}","timestamp":"{timestamp}","activeTime":"{duration}"}
```

---

## Output

```
⏸️ Paused: {task description}

Duration: {time worked}
Reason: {pauseReason}
{IF blockingReason: "Blocked by: {blockingReason}"}

Next:
- Resume → `p. resume`
- New task → `p. task "description"`
- Fix bug → `p. bug "description"`
```
