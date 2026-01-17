# Orchestrator - Agent & Context Coordinator

**Purpose**: Load project-specific agents and state to provide Claude with full context for task execution.

## How It Works

```
p. {command} → Orchestrator → [Load State] → [Load Agent] → [Build Context] → Execute
```

**CRITICAL**: The orchestrator's job is to INJECT context into Claude's working memory. Without this, Claude operates generically instead of using project-specific patterns.

---

## Step 1: Load Project Config

```
READ: .prjct/prjct.config.json
EXTRACT: {projectId}

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

SET: {globalPath} = ~/.prjct-cli/projects/{projectId}
```

---

## Step 2: Load State (CRITICAL for Multi-Session)

Load the project state for continuity across sessions.

```
READ: {globalPath}/storage/state.json
PARSE: as JSON

SET: {state} = parsed state
SET: {hasActiveTask} = state.currentTask != null
SET: {projectType} = state.projectType || 'simple'
```

### State Context to Inject

**ALWAYS** include this in the execution context:

```markdown
## Project State

**Project ID**: {state.projectId}
**Project Type**: {projectType}
**Last Updated**: {state.lastUpdated}

### Current Task
{IF hasActiveTask:}
- **Task**: {state.currentTask.description}
- **Branch**: {state.currentTask.branch}
- **Subtask**: {state.currentTask.currentSubtaskIndex + 1}/{state.currentTask.subtasks.length}
- **Current**: {state.currentTask.subtasks[state.currentTask.currentSubtaskIndex].description}
{ELSE:}
No active task.
{ENDIF}

### Stack
{IF state.stack:}
- Language: {state.stack.language}
- Framework: {state.stack.framework}
- Test Runner: {state.stack.testRunner}
{ENDIF}

### Session Context
{IF state.context:}
- Last Action: {state.context.lastAction}
- Next Action: {state.context.nextAction}
{IF state.context.blockers:}
- Blockers: {state.context.blockers.join(', ')}
{ENDIF}
{ENDIF}
```

---

## Step 3: Load Project Agent (CRITICAL)

**The agent contains project-specific patterns.** Without loading it, Claude operates generically.

```
GLOB: {globalPath}/agents/*.md
SET: {agentFiles} = result

IF agentFiles.length > 0:
  # Load the primary project agent (first one, or project-specific one)
  READ: {agentFiles[0]}
  SET: {agentContent} = file content
  SET: {agentName} = filename without extension

  OUTPUT: "🤖 Agent loaded: {agentName}"
ELSE:
  SET: {agentContent} = null
  OUTPUT: "⚠️ No project agent found. Run `p. sync` to generate one."
```

### Agent Context to Inject

**IF agent was loaded**, include it in full:

```markdown
## Project Agent: {agentName}

{agentContent}
```

This gives Claude:
- **Patterns**: Code patterns specific to this project
- **Conventions**: Naming, structure, style rules
- **Stack**: Technologies and frameworks used
- **Key Files**: Important files to be aware of
- **Anti-patterns**: What to avoid

---

## Step 4: Detect Domains (If Needed)

For tasks that span multiple domains, identify which are involved.

**This is AGENTIC - Claude reasons about what's needed, no keyword matching.**

### Domain Detection Process

```
1. READ the task description
2. REASON about what work is required
3. IDENTIFY which domains are involved:
   - frontend: UI, forms, components, client-side
   - backend: API, server, business logic
   - database: Schema, queries, migrations
   - testing: Tests, assertions, mocks
   - devops: CI/CD, deployment, infrastructure

4. IF task spans 3+ domains → Consider fragmentation (see Step 5)
```

### Load Domain-Specific Agents

For multi-domain tasks, load additional agents:

```
FOR EACH domain IN {detectedDomains}:
  SET: {agentPath} = {globalPath}/agents/{domain}.md

  IF file exists:
    READ: {agentPath}
    ADD to {loadedAgents}
    OUTPUT: "🤖 Domain agent: {domain}"
```

---

## Step 5: Task Fragmentation (For Complex Tasks)

**When to Fragment:**
- Task spans 3+ domains
- Clear dependency order exists (database → backend → frontend)
- Task is too large for single execution

**Fragmentation Process:**

```
1. IDENTIFY atomic subtasks (one domain each)
2. ORDER by dependencies
3. DELEGATE via Task tool:

Task(
  subagent_type: 'general-purpose',
  prompt: '
    ## Context
    {agentContent}

    ## Current State
    {stateContext}

    ## Subtask
    {subtask.description}

    ## Previous Output
    {previousSubtask.summary}

    ## FOCUS: Only this subtask
  '
)
```

**Context Handoff:**
After each subtask, update state with summary for next subtask.

---

## Step 6: Build Execution Context

Combine all context into a single injection block:

```markdown
# Orchestrator Context

{stateContext from Step 2}

{agentContext from Step 3}

## Detected Domains
{detectedDomains.join(', ')}

## Execution
- Primary Domain: {primaryDomain}
- Task: {originalTask}
```

---

## Orchestrator Output Format

At the start of command execution, output:

```
🎯 Task: {task description}

📦 Context:
├── Agent: {agentName || 'none'}
├── State: {hasActiveTask ? 'active task' : 'no task'}
├── Type: {projectType}
└── Domains: {detectedDomains.join(', ')}

{Continue with command execution using injected context...}
```

---

## Integration with Commands

Commands that use orchestrator should:

```markdown
## Step 0: Load Orchestrator Context

Execute orchestrator Steps 1-4:
1. Load project config
2. Load state (inject state context)
3. Load agent (inject agent content)
4. Detect domains (if multi-domain task)

## Step 1: Execute with Context

USE the injected context for:
- Code patterns from agent
- State awareness from state.json
- Domain expertise from domain agents
```

---

## Example: Full Context Injection

For `p. task "add login form"`:

```markdown
# Orchestrator Context

## Project State

**Project ID**: abc123
**Project Type**: complex

### Current Task
No active task.

### Stack
- Language: TypeScript
- Framework: React
- Test Runner: Vitest

---

## Project Agent: frontend

### Stack
- React 18 with TypeScript
- Zustand for state management
- Tailwind CSS for styling

### Patterns
1. **Components**: Functional components with hooks
2. **State**: Zustand stores in /stores/
3. **Forms**: React Hook Form with Zod validation

### Conventions
- Components in PascalCase
- Hooks prefixed with use-
- Tests co-located with components

### Key Files
- src/components/ - UI components
- src/stores/ - Zustand stores
- src/hooks/ - Custom hooks

---

## Detected Domains
frontend

## Execution
- Primary Domain: frontend
- Task: add login form
```

**With this context, Claude knows:**
- No active task → This is a new task
- Stack is React + TypeScript + Zustand
- Use React Hook Form for forms
- Put component in src/components/
- Write test with Vitest

---

## Error Handling

| Situation | Action |
|-----------|--------|
| No project config | "Run `p. init` first" |
| No state file | Create default state |
| No agent files | Warn, continue without agent context |
| Agent parse error | Skip agent, log warning |

---

## Disable Orchestrator

For commands that don't need context:

```yaml
---
orchestrator: false
---
```

Commands like `init`, `setup`, `update` typically don't need orchestrator.
