---
allowed-tools: [Read, Write, Bash, Task, Glob]
description: 'Value analysis + roadmap + task breakdown + auto-start'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
---

# /p:feature - Add Feature to Roadmap

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
- `{roadmapPath}`: `{globalPath}/planning/roadmap.md`
- `{nextPath}`: `{globalPath}/core/next.md`
- `{nowPath}`: `{globalPath}/core/now.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
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

## Step 5: Update Roadmap

READ: `{roadmapPath}` (create if not exists)

### Format New Entry

```markdown
## {GetDate()} - {feature}
- Impact: {impact} | Effort: {effort}
- Tasks: {taskCount}
- Status: active

### Tasks
1. [ ] {task1}
2. [ ] {task2}
...
```

INSERT at top (after # Roadmap header)

### Archive Old Entries
IF entries older than 30 days exist:
  MOVE to: `{globalPath}/planning/archive/roadmap-{yearMonth}.md`

WRITE: `{roadmapPath}`

## Step 6: Update Priority Queue

READ: `{nextPath}` (create if not exists)

### Add Tasks to Queue

For each task in {tasks}:
  APPEND to next.md:
  ```markdown
  - [ ] {task} (from: {feature})
  ```

WRITE: `{nextPath}`

## Step 7: Auto-Start First Task

READ: `{nowPath}`

IF empty OR contains "No current task":
  ### Start First Task
  {firstTask} = first item from {tasks}

  WRITE: `{nowPath}`
  ```markdown
  # NOW

  **{firstTask}**

  Feature: {feature}
  Started: {GetTimestamp()}
  ```

  {autoStarted} = true
ELSE:
  {autoStarted} = false

## Step 8: Log to Session

GET: {date} = GetDate()
EXTRACT: {yearMonth} = YYYY-MM from {date}

ENSURE directory:
BASH: `mkdir -p {globalPath}/planning/sessions/{yearMonth}`

APPEND to: `{globalPath}/planning/sessions/{yearMonth}/{date}.jsonl`

Single line (JSONL):
```json
{"ts":"{GetTimestamp()}","type":"feature_add","name":"{feature}","tasks":{taskCount},"impact":"{impact}","effort":"{effort}"}
```

## Step 9: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{GetTimestamp()}","action":"feature_added","feature":"{feature}","tasks":{taskCount}}
```

## Output

SUCCESS (with auto-start):
```
✅ Added: {feature}

Impact: {impact} | Effort: {effort}
Tasks: {taskCount}

🎯 Started: {firstTask}

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
