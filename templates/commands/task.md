---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Unified task workflow with intelligent classification'
---

# p. task - Start Any Task

Start any work with automatic classification and intelligent breakdown.

## @ Agent Mentions

Invoke specific agents directly in your task using @ notation:

| Mention | Agent | Use Case |
|---------|-------|----------|
| `@frontend` | frontend.md | UI components, React/Vue |
| `@backend` | backend.md | APIs, server logic |
| `@database` | database.md | Schema, queries |
| `@uxui` | uxui.md | UX patterns, design |
| `@testing` | testing.md | Tests, coverage |
| `@devops` | devops.md | CI/CD, Docker |

**Examples:**
- `p. task @frontend add button` - Loads frontend specialist
- `p. task @frontend @uxui dark mode` - Loads both agents
- `p. task @backend optimize API` - Loads backend specialist

**Note:** If no @ mention, agents are auto-assigned based on task analysis.

## Claude Code Subagents

Special @ mentions invoke Claude Code's native subagents:

| Mention | Subagent | Use Case |
|---------|----------|----------|
| `@explore` | Explore | Fast codebase search, find patterns |
| `@general` | General | Complex multi-step research |
| `@plan` | Plan | Architecture design, implementation planning |

**Examples:**
- `p. task @explore find all API endpoints`
- `p. task @general research caching strategies`
- `p. task @plan design authentication system`

**Combined:**
- `p. task @frontend @explore add button like existing ones`
  → Loads frontend agent + uses Explore subagent to find similar buttons

---

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{task}`: User-provided task description

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

## Step 2: Handle No Task Description

```
IF no task provided:
  READ: {globalPath}/storage/state.json

  IF currentTask exists AND status == "active":
    OUTPUT current task status with elapsed time
    STOP
  ELSE:
    OUTPUT: "No current task. Use `p. task <description>` to start one."
    STOP
```

---

## Step 3: Handle Active Task Conflict

```
READ: {globalPath}/storage/state.json

IF currentTask exists AND status == "active" AND description != {task}:
  USE AskUserQuestion:
    question: "Active task: '{currentTask.description}'. How to proceed?"
    options:
      - "Complete current first" → complete it, then continue
      - "Pause and switch" → pause it, then continue
      - "Cancel" → stay with current task
```

---

## Step 4: Agentic Classification

**CRITICAL: Use reasoning, NOT keyword matching.**

Analyze the task holistically:

| Type | When to Use |
|------|-------------|
| `feature` | Adds new functionality that didn't exist |
| `bug` | Something is broken or incorrect |
| `improvement` | Enhances existing functionality |
| `refactor` | Reorganizes code, same behavior |
| `chore` | Maintenance, deps, docs, config |

**Reasoning Examples:**
- "add error handling to login" → Reasoning: Adding new functionality → `feature`
- "fix button that doesn't submit" → Reasoning: Broken behavior → `bug`
- "make dashboard load faster" → Reasoning: Enhancing performance → `improvement`
- "split UserService into modules" → Reasoning: Reorganizing code → `refactor`

```
OUTPUT:
Analyzing: {task}
Intent: {your reasoning}
Classification: {taskType}
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

## 5-Phase Workflow

### Phase 1: Discovery
Summarize what you understand:
```
Building: {one-sentence summary}
Type: {taskType}

Requirements:
- {req 1}
- {req 2}

Success looks like:
- {criteria 1}
- {criteria 2}
```

### Phase 2: Exploration
Use Task(Explore) agent to find:
- Similar existing code
- Patterns used in this codebase
- Key files that would be affected

**Load skills based on task type:**
```
READ: {globalPath}/config/skills.json (if exists)

IF task involves UI/frontend:
  Invoke Skill("frontend-design") for design patterns
  OUTPUT: "🎨 Using frontend-design skill"

IF task involves backend/API:
  Invoke Skill("javascript-typescript") OR Skill("python-development")
  OUTPUT: "⚙️ Using {skill} skill"
```

```
OUTPUT:
Found similar:
- {code} in {file}

Patterns used:
- {pattern}: {where}

Key files:
- {file}: {what changes}

Skills activated: {skills used}
```

### Phase 3: Questions
If anything is unclear, use AskUserQuestion.
If everything is clear, say so and continue.

### Phase 4: Design

**Load agents + auto-invoke skills + query MCP docs.**

See `templates/guides/integrations.md` for skill/MCP details.

```
FOR EACH relevant agent:
  1. READ: {globalPath}/agents/{domain}.md
  2. PARSE frontmatter → skills, mcp
  3. FOR skill in frontmatter.skills: Invoke Skill(skill) → "🎯 Activated"
  4. FOR mcp in frontmatter.mcp: Query context7 for docs → "📚 Loaded"
```

**Propose 2-3 options** using skill context + library docs:

```
### Option 1: Minimal
- Files: {count}, Pros/Cons: ...

### Option 2: Recommended (Skill-informed)
- Files: {count}, Skills applied: {skills}
```

Use AskUserQuestion to get approval.

### Phase 5: Task Breakdown
Break into actionable subtasks:
- Each task: 30min - 2h
- Ordered by dependency
- Include testing as final task

```
Tasks for {task}:
1. {subtask 1}
2. {subtask 2}
...
n. Write tests and verify
```

---

## Step 6: Update Storage

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

## Step 7: Log to Memory

```
APPEND to {globalPath}/memory/events.jsonl:
{"timestamp":"{now}","action":"task_started","taskId":"{id}","type":"{type}","description":"{task}"}
```

---

## Output

```
{task}
Type: {taskType}

Branch: {branchName}
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
