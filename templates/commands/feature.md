---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: '7-phase feature development workflow'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/queue.json'
claude-context: 'context/next.md'
backend-sync: 'sync/pending.json'
---

# /p:feature - Add Feature with 7-Phase Workflow

## 7-Phase Development Workflow

```
Phase 1: Discovery     → Understand the feature
Phase 2: Exploration   → Analyze existing codebase
Phase 3: Questions     → Clarify ambiguities
Phase 4: Design        → Architecture options
Phase 5: Implementation → Task breakdown + start
Phase 6: Review        → (via /p:done, /p:ship)
Phase 7: Summary       → (via /p:done)
```

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

---

## PHASE 1: Discovery

OUTPUT: "## Phase 1: Discovery"

### 1.1 Summarize the Feature
Analyze {feature} and OUTPUT:
```
Building: {one-sentence summary}

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

### 2.1 Find Similar Features
DELEGATE to Explore agent:
```
Task(
  subagent_type: 'Explore',
  prompt: 'Find code similar to "{feature}". Look for:
    - Existing implementations of similar functionality
    - Patterns used in this codebase
    - Key files that would be affected
    Return: file paths, patterns found, relevant code snippets'
)
```

### 2.2 Trace Dependencies
BASH: Find imports/dependencies related to the feature area

### 2.3 Report Findings
OUTPUT:
```
Found similar:
- {similar feature 1} in {file path}
- {similar feature 2} in {file path}

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
  - Priority: "Is {sub-feature} required now or later?"
  ```
  WAIT for answers
  UPDATE requirements based on answers

IF no ambiguities:
  OUTPUT: "Requirements are clear. Proceeding to design."

---

## PHASE 4: Design

OUTPUT: "## Phase 4: Architecture Design"

### 4.0 UX/UI Analysis (Frontend Features)

**CRITICAL**: If feature involves UI/frontend, apply UX/UI agent FIRST.

CHECK: Does feature involve frontend/UI?
- Keywords: page, component, form, button, modal, dashboard, view, screen, UI, interface
- File types affected: .tsx, .jsx, .vue, .svelte, .swift, .kt, .dart

IF frontend feature:
  READ: `{globalPath}/agents/uxui.md`

  IF agent not found:
    OUTPUT: "⚠️ UX/UI agent not found. Run /p:sync to generate."
    CONTINUE without UX/UI analysis

  ELSE:
    OUTPUT: "### 4.0 UX/UI Analysis"

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
    question: "¿Qué dirección estética para este feature?"
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

    OUTPUT:
    ```
    **Aesthetic:** {aestheticDirection}

    **UI Guidelines Applied:**
    - Typography: Distinctive fonts (avoiding Inter, Roboto, Arial)
    - Color: 60-30-10 framework with personality
    - Animation: Purposeful micro-interactions
    - Layout: Memorable composition (not generic centered)
    ```

### 4.1 Generate Options
Based on exploration (and UX/UI analysis if frontend), design 2-3 approaches:

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

### 4.2 Get Approval
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
Tasks for {feature}:
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

## Step 3: Update Storage (SOURCE OF TRUTH)

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

## Step 4: Generate Context (FOR CLAUDE)

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

## Step 5: Auto-Start First Task

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

## Step 6: Queue Sync Events

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

## Step 7: Log to Memory

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

### Example 1: Full 7-Phase Workflow
Input: `/p:feature add user authentication`

```
## Phase 1: Discovery

Building: OAuth2 authentication with JWT tokens

Requirements:
- Support Google and GitHub OAuth
- Session persistence
- Secure token handling

Success looks like:
- Users can log in via OAuth
- Sessions persist across browser refreshes

---

## Phase 2: Codebase Exploration

Found similar:
- Session middleware in src/middleware/session.ts
- User model in src/models/user.ts

Patterns used:
- Middleware pattern for auth checks
- Repository pattern for data access

Key files to modify:
- src/routes/auth.ts (new)
- src/middleware/session.ts (extend)
- src/models/user.ts (add OAuth fields)

---

## Phase 3: Clarifying Questions

Which OAuth providers should we support?
> [User selected: Google and GitHub]

Should we support "Remember me" functionality?
> [User selected: Yes, 30-day tokens]

---

## Phase 4: Architecture Design

### Option 1: Minimal Changes
- Extend existing session middleware
- Pros: Fast
- Cons: Coupling

### Option 2: Clean Architecture
- New AuthService with strategy pattern
- Pros: Testable, extensible
- Cons: More files

### Option 3: Pragmatic Balance (Recommended)
- OAuthProvider abstraction, integrate with existing session
- Pros: Clean boundaries, reuses existing code
- Cons: None significant

Which approach? > [User selected: Option 3]

---

## Phase 5: Task Breakdown

Tasks for user authentication:
1. Create OAuthProvider interface
2. Implement GoogleOAuthProvider
3. Implement GitHubOAuthProvider
4. Add OAuth routes (/auth/google, /auth/github)
5. Extend session middleware for OAuth tokens
6. Add "Remember me" token refresh
7. Write auth integration tests

Impact: high | Effort: 6-8h

---

✅ Added: add user authentication

🎯 Started: Create OAuthProvider interface

Next: /p:done | /p:next
```

### Example 2: Frontend Feature with UX/UI Analysis
Input: `/p:feature add dark mode toggle`

```
## Phase 1: Discovery
Building: Dark mode toggle in settings

## Phase 2: Exploration
Found: Theme context exists in src/context/theme.tsx
Pattern: React Context for global state

## Phase 3: Questions
Requirements are clear. Proceeding to design.

## Phase 4: Design

### 4.0 UX/UI Analysis

**User Analysis:**
- Who: Users who prefer dark interfaces or work in low-light
- Problem: Eye strain, preference not respected
- Happy Path: Toggle → Instant switch → Preference saved
- Edge Cases: System preference, mid-animation toggle

**UX Requirements:**
- [x] User understands action in < 3 seconds (toggle is clear)
- [x] Each action has visual feedback (instant theme switch)
- [x] Errors are clear and recoverable (N/A - no error states)
- [x] Keyboard navigation supported (toggle focusable)
- [x] Contrast ratio >= 4.5:1 (both themes)
- [x] Touch targets >= 44px (toggle size)

**Aesthetic:** Minimal
- Typography: System font (matches app)
- Animation: Smooth 200ms transition
- Layout: Toggle in settings, icon in header

### Architecture
Recommending: Extend existing theme context
(Simple feature, only 1 approach needed)

## Phase 5: Tasks
1. Add dark mode colors to theme context
2. Create toggle component with a11y support
3. Add smooth transition animation (200ms)
4. Persist preference to localStorage
5. Detect system preference as default

---

✅ Added: add dark mode toggle

🎯 Started: Add dark mode colors to theme context

Next: /p:done | /p:next
```
