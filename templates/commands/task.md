---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Unified task workflow with intelligent classification'
---

# p. task - Start Any Task

**See:** `@templates/shared/standard.md` for context variables and patterns.

## @ Mentions

| `@frontend` `@backend` `@database` `@uxui` `@testing` `@devops` | Load domain agents |
| `@explore` `@general` `@plan` | Claude Code subagents |

Example: `p. task @frontend @explore add button like existing ones`

---

## Quick Flow

```
1. Validate project exists
2. Handle active task conflict (if any)
3. Classify task type (agentic reasoning)
4. Create git branch (if on main)
5. Run 5-phase workflow
6. Update storage + context
7. Output summary
```

---

## Step 1: Validate & Load State (PARALLEL)

```
READ (parallel):
- .prjct/prjct.config.json → {projectId}
- {globalPath}/storage/state.json → {state}

IF no config: "No prjct project. Run `p. init`" → STOP
IF no task AND state.currentTask: Show status → STOP
IF no task: "Use `p. task <description>`" → STOP
IF state.currentTask.status == "active":
  AskUserQuestion: "Active task. Complete, Pause, or Cancel?"
```

---

## Step 2: Classify & Branch

### Classification (Reasoning, NOT keywords)

| Type | Signal |
|------|--------|
| `feature` | New functionality |
| `bug` | Broken behavior |
| `improvement` | Enhance existing |
| `refactor` | Reorganize, same behavior |
| `chore` | Maintenance, deps, docs |

### Git Branch (if on main)

```bash
git branch --show-current && git status --porcelain
```

IF on main AND clean: `git checkout -b {type}/{slug}`
IF on main AND dirty: AskUserQuestion → Stash/Commit/Abort

---

## Step 3: 5-Phase Workflow

### Phase 1: Discovery
```
Building: {one-line summary}
Type: {taskType}
Requirements: {2-3 bullets}
```

### Phase 2: Exploration (PARALLEL)

```
Task(Explore): Find similar code, patterns, affected files
READ: {globalPath}/config/skills.json → invoke matching skills
```

### Phase 3: Questions
AskUserQuestion if unclear. Otherwise continue.

### Phase 4: Design

```
READ (parallel): {globalPath}/agents/{detected domains}.md
FOR EACH agent.skills: Invoke Skill()
FOR EACH agent.mcp: Query context7
```

Propose 2 options → AskUserQuestion for approval.

### Phase 5: Breakdown
Subtasks: 30min-2h each, dependency order, tests last.

---

## Step 4: Update Storage (PARALLEL WRITES)

```
WRITE (parallel):
- {globalPath}/storage/state.json → currentTask with subtasks
- {globalPath}/storage/queue.json → add subtasks with featureId
- {globalPath}/context/now.md → current task summary

APPEND: {globalPath}/memory/events.jsonl
```

---

## Output

```
{task} | {taskType}
Branch: {branchName} | Subtasks: {count}
Started: {firstSubtask}

Next: p. done
```
