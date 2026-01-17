# Task Fragmentation

**Purpose**: Break complex multi-domain tasks into subtasks for specialist agents.

## When to Fragment

Fragment a task when:
- It spans multiple domains (frontend + backend + database)
- It would require loading 3+ agents for one-shot execution
- One-shot implementation would saturate context
- The task has natural dependency order
- Complex enough that specialist focus improves quality

## When NOT to Fragment

Keep as single task when:
- Single domain only
- Small, focused change
- Already atomic
- User explicitly requests one-shot execution

---

## Fragmentation Algorithm

### Input

```
Task: "{task description}"
Available Agents: [list from {agentsDir}]
Project Tech: {from repo-analysis.json}
```

### Process

#### 1. Parse Intent

What is the user trying to achieve?
What are the moving parts?

#### 2. Identify Components

| Component | Domain | Indicator Keywords |
|-----------|--------|-------------------|
| Data layer changes | database | schema, migration, table, query, model |
| API changes | backend | endpoint, API, route, controller, auth |
| UI changes | frontend | component, form, page, UI, layout, styling |
| Test changes | testing | test, spec, coverage, TDD |
| Deploy changes | devops | deploy, CI/CD, pipeline, container |

#### 3. Check Agent Availability

For each identified component:
- Does a matching agent exist in `{agentsDir}`?
- If YES → Create subtask for that agent
- If NO → Mark for generalist execution (rare)

**Remember**: Agents in `{agentsDir}` are ALREADY project-specific (generated during `p. sync`). Don't second-guess whether they "match" the technology.

#### 4. Order by Dependencies

Typical dependency order:
1. **Database** (data models first)
2. **Backend** (API using models)
3. **Frontend** (UI using API)
4. **Testing** (tests for all)
5. **DevOps** (deploy everything)

#### 5. Create Subtask Objects

```json
{
  "subtasks": [
    {
      "id": "subtask-1",
      "description": "Create users table schema",
      "domain": "database",
      "agent": "database.md",
      "dependsOn": [],
      "expectedOutput": "Migration file created"
    },
    {
      "id": "subtask-2",
      "description": "Create auth API endpoints",
      "domain": "backend",
      "agent": "backend.md",
      "dependsOn": ["subtask-1"],
      "expectedOutput": "Auth routes implemented"
    },
    {
      "id": "subtask-3",
      "description": "Create login form component",
      "domain": "frontend",
      "agent": "frontend.md",
      "dependsOn": ["subtask-2"],
      "expectedOutput": "Login form component"
    }
  ]
}
```

---

## Output Format

Report fragmentation plan before executing:

```
🎯 Task: {original task}

📋 Subtasks (ordered by dependencies):
├─ 1. [database] Create users table schema
├─ 2. [backend] Create auth API endpoints
└─ 3. [frontend] Create login form

🤖 Agents to invoke: database, backend, frontend
```

---

## Delegation Pattern

For each subtask, delegate via Task tool:

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    ## Agent Assignment
    Read and apply: {agentsPath}/{domain}.md

    ## Subtask
    {subtask.description}

    ## Dependencies
    {list completed subtasks and their summaries}

    ## Previous Subtask Output
    {previousSubtask.summary if available}

    ## Expected Output
    {subtask.expectedOutput}

    ## MANDATORY: Summary on Completion

    When you complete this subtask, provide a summary:

    ### Summary
    [1-2 sentence description of what you did]

    ### Files Created/Modified
    [Table of files with actions]

    ### What Was Done
    [Numbered list of concrete actions]

    ### Output for Next Agent
    [What the next agent can use from your work]

    ### Notes for Integration
    [Any important notes for integration]

    ## IMPORTANT
    Focus ONLY on this subtask.
    Do NOT implement other parts.
    Return when this subtask is complete.
  '
)
```

---

## Summary Storage

After each subtask completes, the summary is stored in `storage/state.json`:

```json
{
  "currentTask": {
    "subtasks": [{
      "id": "subtask-1",
      "status": "completed",
      "summary": {
        "title": "Create auth schema",
        "description": "Created database schema for user authentication",
        "filesChanged": [
          { "path": "prisma/schema.prisma", "action": "modified" }
        ],
        "whatWasDone": [
          "Added User model",
          "Added Session model"
        ],
        "outputForNextAgent": "User and Session models available via Prisma",
        "notes": "Use bcrypt for password hashing"
      }
    }]
  }
}
```

---

## Context Handoff

Each subsequent subtask receives the previous subtask's summary:

```
## Previous Subtask Summary (CONTEXT)
${previousSubtask.summary}

## What's Available
- User model (prisma.user)
- Session model (prisma.session)
- Notes: Use bcrypt for passwords

## Your Task
Create auth API endpoints using the models from subtask 1.
```

---

## Progress Tracking

The orchestrator updates progress after each subtask:

```
📊 Progress: 2/4 subtasks (50%)

✅ 1. [database] Create auth schema
✅ 2. [backend] Create auth API
▶️ 3. [frontend] Create login form ← CURRENT
⏳ 4. [testing] Add auth tests
```

---

## Aggregating Results

After all subtasks complete, report aggregated status:

```
✅ Task Complete: add user authentication

📋 Subtasks Completed:
├─ ✅ 1. [database] Create auth schema
│      Files: prisma/schema.prisma
│
├─ ✅ 2. [backend] Create auth API
│      Files: src/routes/auth.ts, src/middleware/auth.ts
│
├─ ✅ 3. [frontend] Create login form
│      Files: src/components/LoginForm.tsx
│
└─ ✅ 4. [testing] Add auth tests
       Files: tests/auth.test.ts

📁 Total files affected: 5
⏱️ Total duration: {calculated from subtask times}
```

---

## Error Handling

If a subtask fails:

```
❌ Subtask 2/4 failed: Create auth API

Error: Database connection failed

Options:
1. Retry this subtask
2. Skip and continue with remaining subtasks
3. Abort task and rollback

What would you like to do?
```

Use `AskUserQuestion` to get user decision on failure handling.

---

## Anti-Patterns to Avoid

### 1. Over-fragmentation
```
❌ WRONG: 10 subtasks for "add login button"
✅ RIGHT: Single task (already atomic)
```

### 2. Under-fragmentation
```
❌ WRONG: 1 subtask for "add complete auth system"
✅ RIGHT: 4 subtasks (database, backend, frontend, testing)
```

### 3. Wrong Dependency Order
```
❌ WRONG: Frontend before backend (depends on API)
✅ RIGHT: Database → Backend → Frontend
```

### 4. Missing Summaries
```
❌ WRONG: Subtask completes without summary
✅ RIGHT: Every subtask generates structured summary
```

---

## Integration with Storage

The subtasks are stored in `storage/state.json` under `currentTask.subtasks`.

Key methods available:
- `stateStorage.createSubtasks(projectId, subtasks)` - Create subtasks
- `stateStorage.completeSubtask(projectId, output, summary)` - Complete current subtask
- `stateStorage.getCurrentSubtask(projectId)` - Get current subtask
- `stateStorage.getNextSubtask(projectId)` - Get next subtask
- `stateStorage.getSubtaskProgress(projectId)` - Get progress

These are called by the orchestrator as subtasks are processed.
