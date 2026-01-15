---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Unified task workflow with PM Expert enrichment'
---

# p. task - Start Any Task

**ARGUMENTS**: $ARGUMENTS

Start any work with **automatic PM Expert enrichment** to ensure proper understanding before coding.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{task}`: User-provided task description

---

## Quick Flow

```
1. Validate project exists
2. Handle no task / active task conflict
3. PM EXPERT ENRICHMENT (5 phases - ALWAYS runs)
   3.1 Intelligent Classification
   3.2 Technical Analysis
   3.3 Dependency Detection
   3.4 User Story + AC Generation
   3.5 Verify Understanding
4. PRD Check (informed by enrichment)
5. Git branch management
6. Design + Task Breakdown
7. Update storage + context
8. Output summary
```

**CRITICAL**: PM Expert Enrichment runs AUTOMATICALLY before any coding starts.

---

## Step 1: Validate Project

```
READ: .prjct/prjct.config.json
EXTRACT: projectId
SET: globalPath = ~/.prjct-cli/projects/{projectId}

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP
```

---

## Step 2: Handle No Task / Active Task Conflict

```
IF no task provided:
  READ: {globalPath}/storage/state.json

  IF currentTask exists AND status == "active":
    OUTPUT current task status with elapsed time
    STOP
  ELSE:
    OUTPUT: "No current task. Use `p. task <description>` to start one."
    STOP

IF currentTask exists AND status == "active" AND description != {task}:
  USE AskUserQuestion:
    question: "Active task: '{currentTask.description}'. How to proceed?"
    options:
      - "Complete current first" → complete it, then continue
      - "Pause and switch" → pause it, then continue
      - "Cancel" → stay with current task
```

---

## Step 3: PM Expert Enrichment (AUTOMÁTICO)

**CRITICAL**: Before ANY coding, ALWAYS run PM Expert enrichment to ensure proper understanding.

### 3.1 Intelligent Classification

Analyze the task using REASONING, not keyword matching:

| Type | When to Use |
|------|-------------|
| `feature` | Adds new functionality that didn't exist |
| `bug` | Something is broken or incorrect |
| `improvement` | Enhances existing functionality |
| `refactor` | Reorganizes code, same behavior |
| `chore` | Maintenance, deps, docs, config |

| Priority | Criteria |
|----------|----------|
| `critical` | Production broken, data loss risk |
| `high` | Blocks users, security issue |
| `medium` | Important but not blocking |
| `low` | Nice to have, cosmetic |

| Complexity | Hours | Files |
|------------|-------|-------|
| `trivial` | < 1h | 1-2 |
| `small` | 1-4h | 2-5 |
| `medium` | 4-16h | 5-15 |
| `large` | 16-40h | 15+ |
| `epic` | > 40h | Many |

```
OUTPUT:
## Classification

Task: {task}
Type: {taskType} | Priority: {priority} | Complexity: {complexity}

Reasoning: {why this classification}
```

### 3.2 Technical Analysis

**ALWAYS use Task(Explore) to understand the codebase BEFORE proposing solutions.**

```
USE Task(Explore) to find:
- Similar existing code patterns
- Related files that would be affected
- API endpoints involved
- Database schemas touched
- Test files related

OUTPUT:
## Technical Analysis

Affected Files:
- `{file1}` - {expected changes}
- `{file2}` - {expected changes}
- `{file3}` - {expected changes}

Existing Patterns:
- {pattern} in `{file}` - {how to follow it}

Suggested Approach:
{high-level implementation strategy based on codebase patterns}
```

### 3.3 Dependency Detection

```
ANALYZE:
- Code imports/exports (what files depend on what)
- API calls (fetch, axios, internal services)
- Database queries (tables, schemas affected)
- Other tasks in queue (potential blockers)
- External services (third-party APIs)

OUTPUT:
## Dependencies

Code Dependencies:
- `{file}` - {reason} ({low|medium|high} risk)

API Dependencies:
- {endpoint} - {status}

Blocking Tasks:
- {taskId}: {title} ({status}) OR "None"

External:
- {service} - {purpose} OR "None"
```

### 3.4 User Story + Acceptance Criteria

```
GENERATE user story in format:
"As a {role}, I want to {action} so that {benefit}."

GENERATE 3-7 acceptance criteria based on technical analysis:

OUTPUT:
## User Story

As a **{role}**, I want to **{action}** so that **{benefit}**.

## Acceptance Criteria

- [ ] {AC-1}: When {action}, then {expected result}
- [ ] {AC-2}: When {action}, then {expected result}
- [ ] {AC-3}: When {action}, then {expected result}
...

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Tests written and passing
- [ ] Code reviewed (if team)
- [ ] No regressions introduced
```

### 3.5 Verify Understanding

```
IF anything is UNCLEAR about:
- What the user wants to achieve
- How it should behave
- Edge cases to handle
- Priority of different aspects

THEN:
  USE AskUserQuestion to clarify BEFORE proceeding
  DO NOT assume or invent requirements

OUTPUT:
## Enrichment Complete

Type: {type} | Priority: {priority} | Complexity: {complexity}
Affected: {count} files | Dependencies: {count}

User Story: As a {role}, I want to {action}...

AC: {count} criteria defined

Questions: {any_remaining_questions OR "All clear ✓"}
```

---

## Step 4: PRD Check (Informed by Enrichment)

Now that we have enrichment data, check if PRD is needed:

```
# Read orchestration config
READ: .prjct/prjct.config.json
SET: prdRequired = config.orchestration?.prdRequired || "standard"

# Skip for off mode or trivial/small tasks
IF prdRequired == "off" OR complexity in ["trivial", "small"]:
  CONTINUE to Step 5

# Check for existing PRD
IF complexity in ["medium", "large", "epic"]:
  READ: {globalPath}/storage/prds.json

  # Search for matching PRD
  SET: matchingPRD = null
  FOR EACH prd in prds:
    IF prd.title matches task (fuzzy):
      SET: matchingPRD = prd
      BREAK

  IF matchingPRD exists:
    OUTPUT: "📋 Found PRD: {matchingPRD.title} (status: {matchingPRD.status})"
    SET: linkedPRDId = matchingPRD.id

  ELSE IF prdRequired == "strict":
    OUTPUT: "⛔ PRD Required for {complexity} tasks"
    OUTPUT: "Run `p. prd \"{task}\"` to create one."
    STOP

  ELSE IF prdRequired == "standard" AND complexity in ["large", "epic"]:
    USE AskUserQuestion:
      question: "This is a {complexity} task. Create PRD first?"
      options:
        - label: "Create PRD (recommended)"
          description: "Document requirements properly"
        - label: "Continue without PRD"
          description: "I understand the risks"

    IF "Create PRD":
      OUTPUT: "Running `p. prd \"{task}\"`..."
      STOP (prd command will continue)
```

### Legacy Work Exemption

```
READ: {globalPath}/storage/roadmap.json

FOR EACH feature in roadmap.features:
  IF feature.legacy == TRUE AND feature matches task:
    OUTPUT: "ℹ️  Legacy feature - no PRD required"
    BREAK
```

---

## Step 5: Git Branch Management

```
BASH: git branch --show-current
SET: currentBranch = result

IF currentBranch == "main" OR currentBranch == "master":
  # Handle uncommitted changes first
  IF git status shows changes:
    USE AskUserQuestion: "Uncommitted changes. Stash, commit, or abort?"

  # Create branch
  SET: branchName = {taskType}/{slugify(task)}
  BASH: git checkout -b {branchName}
  OUTPUT: "Created branch: {branchName}"
```

---

## Step 6: Design + Task Breakdown

Now that enrichment is complete, design the solution and break into subtasks.

### Load Domain Agents + Skills

```
READ: {globalPath}/agents/ → find relevant agents for task type

FOR EACH relevant agent:
  READ agent file
  PARSE frontmatter → get `skills` array

  IF skills exist:
    Invoke Skill(skill) for domain expertise
    OUTPUT: "📚 {agent} using /{skill}"

Example:
- UI feature → Load uxui.md → Invoke /frontend-design
- Backend → Load backend.md → Invoke /javascript-typescript
```

### Propose 2-3 Approaches

Based on enrichment Technical Analysis, propose options:

```
### Option 1: Minimal
- Approach: {desc}
- Files: {count from enrichment}
- Pros: Fast, low risk
- Cons: May need refactor later

### Option 2: Clean Architecture
- Approach: {desc}
- Files: {count}
- Pros: Maintainable
- Cons: More initial work

### Recommended: Option {N}
Reason: {based on codebase patterns found in enrichment}
```

USE AskUserQuestion to get approval if options differ significantly.

### Task Breakdown

Break into actionable subtasks:
- Each task: 30min - 2h
- Ordered by dependency (from Dependency Detection)
- Include testing as final task

```
Tasks for {task}:
1. {subtask 1} - {file(s)}
2. {subtask 2} - {file(s)}
...
n. Write tests and verify AC
```

---

## Step 7: Update Storage

### Write state.json
```json
{
  "currentTask": {
    "id": "{uuid}",
    "description": "{firstSubtask}",
    "type": "{taskType}",
    "status": "active",
    "sessionId": "{uuid}",
    "featureId": "{uuid}",
    "startedAt": "{timestamp}",
    "branch": {
      "name": "{branchName}",
      "baseBranch": "{baseBranch}"
    },
    "subtasks": [...],
    "currentSubtaskIndex": 0,
    "parentDescription": "{task}"
  },
  "lastUpdated": "{timestamp}"
}
```

### Write queue.json
Add all subtasks to queue with featureId linking them.

### Generate context/now.md
```markdown
# NOW

**{firstSubtask.description}**

Type: {taskType}
Feature: {task}
Branch: {branchName}
```

---

## Step 8: Log to Memory

```
APPEND to {globalPath}/memory/events.jsonl:
{"timestamp":"{now}","action":"task_started","taskId":"{id}","type":"{type}","description":"{task}"}
```

---

## Output

```
## {task}

Type: {taskType} | Priority: {priority} | Complexity: {complexity}
Branch: {branchName}

User Story: As a {role}, I want to {action}...

Affected: {count} files
Subtasks: {count}

Started: {firstSubtask}

Next: Work on the task, then `p. done`
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No config | "No prjct project. Run `p. init` first." → STOP |
| No task | Show current task or prompt for one |
| Active task | Ask user what to do |
| Branch fails | Show error, suggest fix |
