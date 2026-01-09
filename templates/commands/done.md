---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Complete subtask or mark implement phase done'
---

# /p:done - Complete Subtask

Mark current subtask as complete and progress to next. Does NOT complete the workflow - use p. verify after shipping.

**Note**: In workflow mode, p. done advances subtasks within the implement phase. To complete the full workflow:
```
p. task → (implement) → p. done (subtasks) → p. test → p. review → p. merge → p. ship → p. verify
```

## Usage
```
/p:done
```

## Flow

### Step 1: Validate
READ: `.prjct/prjct.config.json` → extract `projectId`
IF missing: "No prjct project. Run /p:init first." → STOP

SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`

READ: `{globalPath}/storage/state.json`
IF no `currentTask` OR status != "active":
  OUTPUT: "No active task. Use p. task to start one."
  STOP

EXTRACT: `{task}` = currentTask.description
EXTRACT: `{startedAt}` = currentTask.startedAt
EXTRACT: `{sessionId}` = currentTask.sessionId
EXTRACT: `{estimate}` = currentTask.estimate (optional)

### Step 1.5: Handle Subtask Completion (AGENTIC)

IF currentTask.subtasks exists AND currentTask.subtasks.length > 0:
  SET: {currentIndex} = currentTask.currentSubtaskIndex
  SET: {currentSubtask} = currentTask.subtasks[{currentIndex}]
  SET: {totalSubtasks} = currentTask.subtasks.length
  SET: {nextIndex} = {currentIndex} + 1
  SET: {hasMoreSubtasks} = {nextIndex} < {totalSubtasks}

  IF {hasMoreSubtasks}:
    SET: {nextSubtask} = currentTask.subtasks[{nextIndex}]
    SET: {completedCount} = subtasks where status == "completed" + 1
    SET: {remainingCount} = {totalSubtasks} - {completedCount}

    USE AskUserQuestion:
    ```
    question: "Subtask '{currentSubtask.description}' done. What's next?"
    header: "Subtask Complete"
    options:
      - label: "Next: {nextSubtask.description}"
        description: "{remainingCount} subtasks remaining"
      - label: "Complete entire feature"
        description: "Finish '{currentTask.parentDescription}' now"
      - label: "More work needed"
        description: "Continue on this subtask"
    ```

    IF choice starts with "Next:":
      SET: {now} = GetTimestamp()
      # Mark current subtask complete
      SET: currentTask.subtasks[{currentIndex}].status = "completed"
      SET: currentTask.subtasks[{currentIndex}].completedAt = "{now}"
      # Start next subtask
      SET: currentTask.subtasks[{nextIndex}].status = "active"
      SET: currentTask.currentSubtaskIndex = {nextIndex}
      SET: currentTask.description = "{nextSubtask.description}"

      WRITE: `{globalPath}/storage/state.json`

      APPEND to `{globalPath}/memory/events.jsonl`:
      {"timestamp":"{now}","action":"subtask_completed","subtaskId":"{currentSubtask.id}","nextSubtaskId":"{nextSubtask.id}"}

      OUTPUT:
      ```
      ✅ {currentSubtask.description}

      Now: {nextSubtask.description}
      Progress: {completedCount}/{totalSubtasks} subtasks

      p. done when finished
      ```
      STOP

    IF choice == "Complete entire feature":
      # Mark all remaining as skipped, continue to normal done flow
      FOR each subtask in currentTask.subtasks:
        IF subtask.status == "pending":
          SET: subtask.status = "skipped"
      SET: currentTask.subtasks[{currentIndex}].status = "completed"
      OUTPUT: "Completing feature: {currentTask.parentDescription}"
      # Continue to Step 2

    IF choice == "More work needed":
      OUTPUT: "Continuing: {currentSubtask.description}"
      STOP

  ELSE:
    # Last subtask - mark complete and continue to normal done flow
    SET: {now} = GetTimestamp()
    SET: currentTask.subtasks[{currentIndex}].status = "completed"
    SET: currentTask.subtasks[{currentIndex}].completedAt = "{now}"
    OUTPUT: "Final subtask done. Completing feature..."
    # Continue to Step 2

### Step 2: Calculate Metrics
GET timestamp: `bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"`
SET: `{now}` = result

CALCULATE: `{duration}` = time between startedAt and now
FORMAT: as "Xh Ym" or "Xm"

IF estimate exists:
  CALCULATE: `{accuracy}` = 100 - |((actual - estimate) / estimate) * 100|
  CAP at 0-100%

BASH: `git rev-list --count --since="{startedAt}" HEAD 2>/dev/null || echo "0"`
SET: `{commits}` = result

BASH: `git diff --stat HEAD~{commits} 2>/dev/null || git diff --stat`
EXTRACT: `{filesChanged}`, `{linesAdded}`, `{linesRemoved}`

### Step 3: Update Storage
Update `{globalPath}/storage/state.json`:
- Move currentTask to previousTask with status: "completed"
- Set currentTask = null
- Set lastUpdated = {now}
- Add completedAt, duration, accuracy, metrics

WRITE: `{globalPath}/storage/state.json`

### Step 4: Generate Context
WRITE: `{globalPath}/context/now.md`:
```markdown
# NOW

_No active task_

Use `/p:now <task>` to start working.
```

### Step 5: Log Events
APPEND to `{globalPath}/sync/pending.json`:
```json
{"type":"task.completed","data":{...},"timestamp":"{now}"}
```

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"timestamp":"{now}","action":"task_completed","task":"{task}","duration":{seconds}}
```

APPEND to `{globalPath}/progress/sessions/{YYYY-MM}/{date}.jsonl`:
```json
{"ts":"{now}","type":"task_complete","task":"{task}","duration":"{duration}"}
```

### Step 5.5: Handle Bug Completion Resume (AGENTIC)

IF currentTask.type == "bug" AND state.interruptedTask exists:
  USE AskUserQuestion:
  ```
  question: "Bug fixed! Resume '{state.interruptedTask.description}'?"
  header: "Bug Complete"
  options:
    - label: "Resume previous task"
      description: "Return to '{state.interruptedTask.description}'"
    - label: "Pick from queue"
      description: "See what else is waiting"
    - label: "Done for now"
      description: "No active task"
  ```

  IF choice == "Resume previous task":
    SET: {now} = GetTimestamp()
    SET: currentTask = state.interruptedTask
    SET: currentTask.status = "active"
    SET: currentTask.resumedAt = "{now}"
    SET: state.interruptedTask = null

    WRITE: `{globalPath}/storage/state.json`

    APPEND to `{globalPath}/memory/events.jsonl`:
    {"timestamp":"{now}","action":"task_resumed_from_interrupt","taskId":"{currentTask.id}"}

    OUTPUT:
    ```
    ✅ Bug fixed ({duration})

    Resumed: {currentTask.description}

    p. done when finished
    ```
    STOP

  IF choice == "Pick from queue":
    SET: state.interruptedTask = null
    READ: `{globalPath}/storage/queue.json`
    SET: {topTasks} = first 3 from queue.tasks

    OUTPUT:
    ```
    ✅ Bug fixed ({duration})

    Previous task saved. Queue:
    {FOR each in topTasks: "- {task.description}"}

    p. task <description> to start
    ```
    STOP

  IF choice == "Done for now":
    OUTPUT:
    ```
    ✅ Bug fixed ({duration})

    '{state.interruptedTask.description}' saved for later.

    p. resume to return | p. task for new work
    ```
    STOP

### Step 6: Output with Queue Suggestion

READ: `{globalPath}/storage/queue.json`
SET: {queueCount} = queue.tasks.length
SET: {topTask} = queue.tasks[0] if exists

WITH estimate:
```
✅ {task} ({duration})

Estimate: {estimate} | Actual: {duration} | Accuracy: {accuracy}%
Files: {filesChanged} | +{linesAdded}/-{linesRemoved} | Commits: {commits}
{IF queueCount > 0: "Queue: {queueCount} tasks | Next: {topTask.description}"}

p. task | p. ship | p. next
```

WITHOUT estimate:
```
✅ {task} ({duration})

Files: {filesChanged} | +{linesAdded}/-{linesRemoved} | Commits: {commits}
{IF queueCount > 0: "Queue: {queueCount} tasks | Next: {topTask.description}"}

p. task | p. ship | p. next
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No active task | "No active task" | STOP |
| Git fails | Use zeros for metrics | CONTINUE |

## References
- Architecture: `~/.prjct-cli/docs/architecture.md`
- Validation: `~/.prjct-cli/docs/validation.md`
