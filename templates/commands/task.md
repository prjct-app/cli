---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Unified task workflow with agentic classification'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
architecture: 'Write-Through (JSON -> MD -> Events)'
storage-layer: true
source-of-truth: 'storage/state.json, storage/queue.json'
claude-context: 'context/now.md, context/next.md'
backend-sync: 'sync/pending.json'
---

# /p:task - Unified Task Workflow

Start any work with automatic type classification and 7-phase workflow.

## 7-Phase Development Workflow

```
Phase 1: Discovery     -> Understand the task
Phase 2: Exploration   -> Analyze existing codebase
Phase 3: Questions     -> Clarify ambiguities
Phase 4: Design        -> Architecture options
Phase 5: Implementation -> Task breakdown + start
Phase 6: Review        -> (via /p:done, /p:ship)
Phase 7: Summary       -> (via /p:done)
```

## Architecture: Write-Through Pattern

```
User Action -> Storage (JSON) -> Context (MD) -> Sync Events
```

**Source of Truth**: `storage/state.json` (current), `storage/queue.json` (queue)
**Claude Context**: `context/now.md`, `context/next.md` (generated)
**Backend Sync**: `sync/pending.json` (events)

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{queuePath}`: `{globalPath}/storage/queue.json`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{contextPath}`: `{globalPath}/context/now.md`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{task}`: User-provided task description

---

## Step 1: Validate Project

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`
READ: `{globalPath}/storage/state.json`

---

## Step 2: Handle No Parameters

IF no task description provided:
  READ: `{globalPath}/storage/state.json`

  IF currentTask exists AND status == "active":
    CALCULATE elapsed time
    OUTPUT:
    ```
    Now: {currentTask.description}
    Type: {currentTask.type}

    Session: {sessionId}
    Started: {elapsed} ago
    Branch: {branch.name}

    /p:done to complete | /p:pause to pause
    ```
    STOP
  ELSE:
    OUTPUT: "No current task. Use /p:task <description> to start one."
    STOP

---

## Step 3: Check for Active Task

READ: `{globalPath}/storage/state.json`

IF currentTask exists AND status == "active" AND description != {task}:
  OUTPUT:
  ```
  Already working on: {currentTask.description}

  Options:
  - /p:done - Complete current task first
  - /p:pause - Pause and switch
  ```
  STOP

IF currentTask.description == {task}:
  OUTPUT: "Continuing: {task}"
  STOP

---

## Step 4: Agentic Classification (CRITICAL)

**DO NOT use keyword matching or if/else rules.**
**ANALYZE the task holistically and REASON about its nature.**

ANALYZE {task} considering:

1. **Intent**: What is the user trying to achieve?
   - Are they adding something new that doesn't exist?
   - Are they fixing something that's broken?
   - Are they improving something that works but could be better?
   - Are they reorganizing without changing behavior?
   - Are they doing maintenance work?

2. **Impact**: What kind of value does this provide?
   - User-facing functionality = feature or improvement
   - Internal reorganization = refactor
   - Broken behavior = bug
   - Non-functional maintenance = chore

3. **Scope**: What is the nature of the change?
   - New capability = feature
   - Enhanced existing capability = improvement
   - Broken capability = bug
   - Same capability, better code = refactor
   - Dependencies, docs, config = chore

DETERMINE {taskType} from this analysis:

| Type | When to classify as this |
|------|--------------------------|
| feature | Adds new functionality that didn't exist before |
| bug | Something is broken, incorrect, or not working as expected |
| improvement | Enhances existing functionality (performance, UX, usability) |
| refactor | Reorganizes code without changing external behavior |
| chore | Maintenance work: deps, docs, config, cleanup - no user-facing change |

**Examples of agentic reasoning:**

- "add error handling to login"
  -> Reasoning: This adds new functionality (error handling) that didn't exist
  -> Type: feature

- "fix the button that doesn't submit"
  -> Reasoning: Something is broken (button not working)
  -> Type: bug

- "make the dashboard load faster"
  -> Reasoning: Dashboard works, but enhancing performance
  -> Type: improvement

- "split the UserService into smaller modules"
  -> Reasoning: Reorganizing code, behavior stays the same
  -> Type: refactor

- "update dependencies to latest versions"
  -> Reasoning: Maintenance, no user-facing change
  -> Type: chore

OUTPUT classification:
```
Analyzing: {task}
Intent: {your reasoning about what user wants}
Classification: {taskType}
```

SET: {taskType} = classified type
SET: {branchPrefix} = {taskType} (feature/, bug/, improvement/, refactor/, chore/)

---

## Step 5: Git Branch Management

### 5.1 Check Current Branch
BASH: `git branch --show-current`
SET: {currentBranch} = result

### 5.2 Handle Protected Branches
IF {currentBranch} == "main" OR {currentBranch} == "master":
  OUTPUT: "Creating {taskType} branch for your task..."

  ### 5.2.1 Handle Uncommitted Changes
  BASH: `git status --porcelain`
  SET: {hasChanges} = (result not empty)

  IF {hasChanges}:
    USE AskUserQuestion:
    ```
    question: "Uncommitted changes detected. How to proceed?"
    header: "Git"
    options:
      - label: "Stash changes"
        description: "Temporarily save changes, create branch, then continue"
      - label: "Commit first"
        description: "Commit current changes before switching"
      - label: "Abort"
        description: "Cancel and keep working on current branch"
    ```

    IF choice == "Stash changes":
      BASH: `git stash push -m "prjct: stashed for {task}"`
      SET: {stashedChanges} = true
    ELSE IF choice == "Commit first":
      OUTPUT: "Commit your changes first, then run /p:task again"
      STOP
    ELSE:
      OUTPUT: "Aborted. Staying on {currentBranch}"
      STOP

  ### 5.2.2 Create Branch
  SET: {taskSlug} = slugify({task})
  LIMIT: {taskSlug} to 50 characters, lowercase, replace spaces with hyphens
  SET: {branchName} = "{branchPrefix}/{taskSlug}"

  BASH: `git checkout -b {branchName}`
  IF command fails (branch exists):
    BASH: `git checkout {branchName}`
    IF still fails:
      OUTPUT: "Failed to create/checkout branch: {branchName}"
      STOP

  SET: {branchCreated} = true
  SET: {baseBranch} = {currentBranch}
  OUTPUT: "Created branch: {branchName}"

ELSE:
  SET: {branchName} = {currentBranch}
  SET: {branchCreated} = false
  SET: {baseBranch} = null

---

## PHASE 1: Discovery

OUTPUT: "## Phase 1: Discovery"

### 1.1 Summarize the Task
Analyze {task} and OUTPUT:
```
Building: {one-sentence summary}
Type: {taskType}

Requirements:
- {requirement 1}
- {requirement 2}
- {requirement 3}

Success looks like:
- {success criteria 1}
- {success criteria 2}
```

### 1.2 Initial Assessment
Determine scope:
- IF simple (1-2 files): {scope} = "small"
- IF medium (3-5 files): {scope} = "medium"
- IF complex (many files, new patterns): {scope} = "large"

---

## PHASE 2: Exploration

OUTPUT: "## Phase 2: Codebase Exploration"

### 2.1 Find Similar Code
DELEGATE to Explore agent:
```
Task(
  subagent_type: 'Explore',
  prompt: 'Find code similar to "{task}". Look for:
    - Existing implementations of similar functionality
    - Patterns used in this codebase
    - Key files that would be affected
    Return: file paths, patterns found, relevant code snippets'
)
```

### 2.2 Trace Dependencies
BASH: Find imports/dependencies related to the task area

### 2.3 Report Findings
OUTPUT:
```
Found similar:
- {similar code 1} in {file path}
- {similar code 2} in {file path}

Patterns used:
- {pattern 1}: {where it's used}
- {pattern 2}: {where it's used}

Key files to modify:
- {file 1}: {what needs to change}
- {file 2}: {what needs to change}
```

---

## PHASE 3: Questions

OUTPUT: "## Phase 3: Clarifying Questions"

### 3.1 Identify Ambiguities
Based on discovery and exploration, identify unclear aspects:

IF ambiguities exist:
  USE AskUserQuestion tool:
  ```
  - Scope: "Should this include {edge case}?"
  - Tech: "Prefer {option A} or {option B}?"
  - Priority: "Is {sub-task} required now or later?"
  ```
  WAIT for answers
  UPDATE requirements based on answers

IF no ambiguities:
  OUTPUT: "Requirements are clear. Proceeding to design."

---

## PHASE 4: Design

OUTPUT: "## Phase 4: Architecture Design"

### 4.0 Load Available Experts (CRITICAL)

**ALWAYS load all available domain experts to inform the design phase.**

GLOB: `{globalPath}/agents/*.md`
SET: {availableAgents} = list of agent files found

FOR each agent in {availableAgents}:
  READ: agent file
  EXTRACT: agent domain (frontend, backend, database, testing, devops, uxui)
  ADD to {loadedExperts}

OUTPUT: "Loaded experts: {loadedExperts.join(', ')}"

### 4.1 UX/UI Analysis (Frontend Tasks)

**CRITICAL**: If task involves UI/frontend, apply UX/UI analysis FIRST.

CHECK: Does task involve frontend/UI?
- Task mentions: page, component, form, button, modal, dashboard, view, screen, UI, interface
- File types affected: .tsx, .jsx, .vue, .svelte, .swift, .kt, .dart

IF frontend task AND "uxui" in {loadedExperts}:
  OUTPUT: "### 4.1 UX/UI Analysis"

  ### Apply UX Checklist (MANDATORY)
  ```
  **User Analysis:**
  - Who: {describe the user}
  - Problem: {what pain point this solves}
  - Happy Path: {ideal flow}
  - Edge Cases: {what can go wrong}

  **UX Requirements:**
  - [ ] User understands action in < 3 seconds
  - [ ] Each action has visual feedback
  - [ ] Errors are clear and recoverable
  - [ ] Keyboard navigation supported
  - [ ] Contrast ratio >= 4.5:1
  - [ ] Touch targets >= 44px (mobile)
  ```

  ### Ask Aesthetic Direction
  USE AskUserQuestion:
  ```
  question: "What aesthetic direction for this task?"
  header: "Aesthetic"
  options:
    - label: "Minimal"
      description: "Clean, professional. Best for B2B, productivity tools"
    - label: "Bold/Maximalist"
      description: "Striking, modern. Best for creative, entertainment"
    - label: "Soft/Organic"
      description: "Friendly, approachable. Best for wellness, lifestyle"
    - label: "Brutalist"
      description: "Raw, technical. Best for dev tools, startups"
  ```

  SET: {aestheticDirection} = user's choice

ELSE IF frontend task:
  OUTPUT: "UX/UI agent not found. Run /p:sync to generate."
  CONTINUE without UX/UI analysis

### 4.2 Backend Analysis (API Tasks)

IF task involves API/backend AND "backend" in {loadedExperts}:
  OUTPUT: "### 4.2 Backend Analysis"

  APPLY backend agent expertise:
  - API design patterns
  - Error handling conventions
  - Authentication/authorization requirements
  - Database interaction patterns

### 4.3 Database Analysis (Data Tasks)

IF task involves database/data AND "database" in {loadedExperts}:
  OUTPUT: "### 4.3 Database Analysis"

  APPLY database agent expertise:
  - Schema design considerations
  - Query optimization
  - Migration strategy
  - Data integrity constraints

### 4.4 Testing Strategy

IF "testing" in {loadedExperts}:
  OUTPUT: "### 4.4 Testing Strategy"

  APPLY testing agent expertise:
  - Unit test requirements
  - Integration test plan
  - Edge cases to cover
  - Test data requirements

### 4.5 DevOps Considerations

IF task involves deployment/infra AND "devops" in {loadedExperts}:
  OUTPUT: "### 4.5 DevOps Considerations"

  APPLY devops agent expertise:
  - Deployment strategy
  - Environment considerations
  - CI/CD requirements
  - Infrastructure changes

### 4.6 Generate Options
Based on exploration and expert analysis, design 2-3 approaches:

OUTPUT:
```
### Option 1: Minimal Changes
- Approach: {description}
- Files: {count} files modified
- Pros: Fast, low risk
- Cons: {tradeoff}

### Option 2: Clean Architecture
- Approach: {description}
- Files: {count} files modified
- Pros: Maintainable, testable
- Cons: More work upfront

### Option 3: Pragmatic Balance (Recommended)
- Approach: {description}
- Files: {count} files modified
- Pros: Balance of speed and quality
- Cons: {minor tradeoff}
```

### 4.7 Get Approval
USE AskUserQuestion:
```
question: "Which architecture approach?"
options:
  - "Option 1: Minimal Changes"
  - "Option 2: Clean Architecture"
  - "Option 3: Pragmatic Balance (Recommended)"
```

SET: {chosenApproach} = user's choice

---

## PHASE 5: Implementation

OUTPUT: "## Phase 5: Task Breakdown"

### 5.1 Generate Tasks
Based on {chosenApproach}, break into tasks:

Rules:
1. Each task: 30min - 2h
2. Atomic (one concern each)
3. Ordered by dependency
4. Include testing as final task

GENERATE: {tasks} = list of task descriptions
GENERATE: {featureId} = UUID v4
SET: {now} = GetTimestamp()

### 5.2 Show Task List
OUTPUT:
```
Tasks for {task}:
1. {task 1}
2. {task 2}
3. {task 3}
...
n. Write tests and verify
```

### 5.3 Impact Assessment
IF affects core functionality OR user-facing:
  {impact} = "high"
ELSE IF affects internal systems:
  {impact} = "medium"
ELSE:
  {impact} = "low"

{effort} = estimate based on task count

---

## Step 6: Update Storage (SOURCE OF TRUTH)

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
  "type": "{taskType}",
  "priority": "normal",
  "section": "active",
  "featureId": "{featureId}",
  "featureName": "{task}",
  "createdAt": "{now}"
}
```

APPEND all tasks to `tasks` array
SET: `lastUpdated` = {now}
WRITE: `{queuePath}`

### Update state.json

{firstTask} = first item from {tasks}
GENERATE: {sessionId} = UUID v4

```json
{
  "currentTask": {
    "id": "{firstTask.id}",
    "description": "{firstTask.description}",
    "type": "{taskType}",
    "status": "active",
    "sessionId": "{sessionId}",
    "featureId": "{featureId}",
    "startedAt": "{now}",
    "branch": {
      "name": "{branchName}",
      "createdByPrjct": {branchCreated},
      "baseBranch": "{baseBranch}",
      "createdAt": "{now}"
    }
  },
  "lastUpdated": "{now}"
}
```
WRITE: `{statePath}`

---

## Step 7: Generate Context (FOR CLAUDE)

### Generate context/now.md
```markdown
# NOW

**{firstTask.description}**

Type: {taskType}
Started: {now}
Session: {sessionId}
Branch: {branchName}
Feature: {task}
```
WRITE: `{globalPath}/context/now.md`

### Generate context/next.md
READ: `{queuePath}`
TRANSFORM to markdown with remaining tasks
WRITE: `{globalPath}/context/next.md`

---

## Step 8: Queue Sync Events

READ: `{syncPath}` or create empty array

### Task created event
APPEND:
```json
{
  "type": "task.created",
  "path": ["state"],
  "data": {
    "taskId": "{firstTask.id}",
    "description": "{task}",
    "type": "{taskType}",
    "featureId": "{featureId}",
    "taskCount": {taskCount},
    "branch": "{branchName}"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```

WRITE: `{syncPath}`

---

## Step 9: Log to Memory

APPEND to: `{memoryPath}`
```json
{"timestamp":"{now}","action":"task_started","taskId":"{firstTask.id}","type":"{taskType}","description":"{task}","branch":"{branchName}"}
```

---

## Output

```
{task}
Type: {taskType}

Branch: {branchName}
Tasks: {taskCount}
Impact: {impact} | Effort: {effort}

Started: {firstTask.description}

Next:
- Work on the task
- /p:done - When finished
- /p:next - See full queue
```

---

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No config | "No prjct project" | STOP |
| No task | Show current task or prompt | WAIT |
| Active task exists | Show options | STOP |
| Branch creation fails | "Failed to create branch" | STOP |
| Write fails | Log warning | CONTINUE |

---

## Natural Language Triggers

Messages starting with `p.` trigger this command:
- `p. task add auth` -> /p:task "add auth"
- `p. task fix login` -> /p:task "fix login"
- `p. start refactor api` -> /p:task "refactor api"
- `p. build dark mode` -> /p:task "dark mode"

---

## References

- Architecture: `~/.prjct-cli/docs/architecture.md`
- Commands: `~/.prjct-cli/docs/commands.md`
