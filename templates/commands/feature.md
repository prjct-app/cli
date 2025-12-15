---
allowed-tools: [Read, Write, Bash, Task, Glob]
description: 'Value analysis + roadmap + task breakdown + auto-start'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/queue.json'
claude-context: 'context/next.md'
backend-sync: 'sync/pending.json'
---

# /p:feature - Add Feature to Roadmap

## Architecture: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

**Source of Truth**: `storage/queue.json` (tasks), `storage/roadmap.json` (features)
**Claude Context**: `context/next.md`, `context/roadmap.md` (generated)
**Backend Sync**: `sync/pending.json` (events)

## Agent Delegation (REQUIRED)

Before executing any code-related task, delegate to a specialist agent:

### Step 0: Assign Agent

1. **List agents**: `Glob("~/.prjct-cli/projects/{projectId}/agents/*.md")`
2. **Read routing**: `Read("templates/agentic/agent-routing.md")`
3. **Analyze task**: Determine domain (frontend, backend, testing, etc.)
4. **Select agent**: Match task to best agent
5. **Delegate via Task tool** (pass reference, NOT content):

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    ## Agent Assignment
    Read and apply: ~/.prjct-cli/projects/{projectId}/agents/{agent-name}.md

    ## Task
    {feature description}

    ## Context
    - Project: {projectPath}
    - Feature: {feature}

    ## Flow
    1. Read agent file FIRST
    2. Apply agent expertise
    3. Execute task
    4. Return results
  '
)
```

**CRITICAL:** Pass file PATH, not content. Subagent reads it (~200 bytes vs 3-5KB).

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{queuePath}`: `{globalPath}/storage/queue.json`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{nextContextPath}`: `{globalPath}/context/next.md`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{feature}`: User-provided feature description

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Handle No Parameters

IF no feature description provided:
  OUTPUT interactive menu:
  ```
  What kind of feature?

  1. UI/UX - Interface improvements
  2. Performance - Speed, memory, optimization
  3. Features - New functionality
  4. Quality - Testing, refactoring
  5. Bugs - Fix issues
  6. Docs - Documentation

  Describe your feature or choose a category.
  ```
  WAIT for user input
  CONTINUE with user's response as {feature}

## Step 3: Value Analysis

Analyze the feature:

### Impact Assessment
Based on feature description, determine:

IF affects core functionality OR user-facing:
  {impact} = "high"
ELSE IF affects internal systems OR developer experience:
  {impact} = "medium"
ELSE:
  {impact} = "low"

### Effort Estimation
Based on complexity:

IF simple change (1-2 files, straightforward):
  {effort} = "1-2h"
  {taskCount} = 1-2
ELSE IF medium change (3-5 files, some logic):
  {effort} = "3-4h"
  {taskCount} = 3-4
ELSE IF complex change (many files, new patterns):
  {effort} = "6-8h"
  {taskCount} = 5-8
ELSE:
  {effort} = "1d+"
  {taskCount} = 8+

### Timing Decision
IF {impact} = "high" AND {effort} < "4h":
  {timing} = "do_now"
ELSE IF {impact} = "high":
  {timing} = "plan_first"
ELSE:
  {timing} = "add_to_queue"

## Step 4: Task Breakdown

Break {feature} into specific, actionable tasks:

### Task Generation Rules
1. Each task should be completable in 30min - 2h
2. Tasks should be atomic (one concern each)
3. Order tasks by dependency (blockers first)
4. Include setup/research task if needed
5. Include testing/verification as final task

### Example Breakdown
For feature "add user authentication":
```
1. Research auth patterns for this stack
2. Setup auth middleware/routes
3. Implement login endpoint
4. Implement logout endpoint
5. Add session management
6. Write auth tests
```

GENERATE: {tasks} = list of task descriptions
GENERATE: {featureId} = UUID v4
SET: {now} = GetTimestamp()

## Step 5: Update Storage (SOURCE OF TRUTH)

### Update queue.json

READ: `{queuePath}` (or create default if not exists)

Default structure:
```json
{
  "tasks": [],
  "lastUpdated": null
}
```

For each task in {tasks}, create task object:
```json
{
  "id": "{taskId}",
  "description": "{taskDescription}",
  "type": "feature",
  "priority": "normal",
  "section": "active",
  "featureId": "{featureId}",
  "featureName": "{feature}",
  "createdAt": "{now}"
}
```

APPEND all tasks to `tasks` array
SET: `lastUpdated` = {now}
WRITE: `{queuePath}`

## Step 6: Generate Context (FOR CLAUDE)

### Generate context/next.md

READ: `{queuePath}`
TRANSFORM to markdown:

```markdown
# Next

## High Priority

{high priority tasks from queue}

## Normal Priority

- [ ] {task1} @{featureId}
- [ ] {task2} @{featureId}
...

## Low Priority

{low priority tasks}
```

WRITE: `{nextContextPath}`

## Step 7: Auto-Start First Task

READ: `{statePath}`

IF no currentTask:
  ### Start First Task
  {firstTask} = first item from {tasks}
  GENERATE: {sessionId} = UUID v4

  ### Update state.json
  ```json
  {
    "currentTask": {
      "id": "{firstTask.id}",
      "description": "{firstTask.description}",
      "sessionId": "{sessionId}",
      "featureId": "{featureId}",
      "startedAt": "{now}",
      "status": "active"
    },
    "pausedTask": null,
    "lastUpdated": "{now}"
  }
  ```
  WRITE: `{statePath}`

  ### Generate context/now.md
  ```markdown
  # NOW

  **{firstTask.description}**

  Started: {now}
  Session: {sessionId}
  Feature: {featureId}
  ```
  WRITE: `{globalPath}/context/now.md`

  {autoStarted} = true
ELSE:
  {autoStarted} = false

## Step 8: Queue Sync Events

READ: `{syncPath}` or create empty array

### Feature created event
APPEND:
```json
{
  "type": "feature.created",
  "path": ["queue"],
  "data": {
    "featureId": "{featureId}",
    "name": "{feature}",
    "impact": "{impact}",
    "effort": "{effort}",
    "taskCount": {taskCount}
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```

### Tasks added events (one per task)
For each task:
```json
{
  "type": "queue.task_added",
  "path": ["queue"],
  "data": {
    "taskId": "{taskId}",
    "description": "{taskDescription}",
    "featureId": "{featureId}"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```

IF {autoStarted}:
```json
{
  "type": "task.started",
  "path": ["state"],
  "data": {
    "taskId": "{firstTask.id}",
    "sessionId": "{sessionId}",
    "featureId": "{featureId}"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```

WRITE: `{syncPath}`

## Step 9: Log to Memory

APPEND to: `{memoryPath}`
```json
{"timestamp":"{now}","action":"feature_added","featureId":"{featureId}","feature":"{feature}","tasks":{taskCount}}
```

## Output

SUCCESS (with auto-start):
```
✅ Added: {feature}

Impact: {impact} | Effort: {effort}
Tasks: {taskCount}

🎯 Started: {firstTask.description}

Next:
• Work on the task
• /p:done - When finished
• /p:next - See full queue
```

SUCCESS (without auto-start):
```
✅ Added: {feature}

Impact: {impact} | Effort: {effort}
Tasks: {taskCount}

⚠️ Already working on another task.
Tasks added to queue.

Next:
• /p:done - Finish current task
• /p:next - See queue
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No config | "No prjct project" | STOP |
| No feature | Show category menu | WAIT |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Simple Feature
Input: `/p:feature add dark mode toggle`

```
✅ Added: add dark mode toggle

Impact: medium | Effort: 2-3h
Tasks: 3

🎯 Started: Setup theme context/state

Tasks:
1. Setup theme context/state
2. Add toggle component
3. Apply theme to components

Next: /p:done | /p:next
```

### Example 2: Complex Feature
Input: `/p:feature implement user authentication`

```
✅ Added: implement user authentication

Impact: high | Effort: 6-8h
Tasks: 6

🎯 Started: Research auth patterns

Tasks:
1. Research auth patterns
2. Setup auth middleware
3. Implement login
4. Implement logout
5. Add session management
6. Write auth tests

Next: /p:done | /p:next
```
