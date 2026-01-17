# Orchestrator - Agent & Skill Coordinator

**Purpose**: Automatically route tasks to the right agents and skills.

## How It Works

```
User Task → Orchestrator → [Analyze] → [Fragment?] → [Load Agents] → [Delegate] → [Execute]
```

The orchestrator is **implicit** - it runs automatically for every p. command.

**CRITICAL**: This is an AGENTIC orchestrator. Claude analyzes and decides - NO hardcoded keyword matching.

---

## Step 1: Task Analysis (AGENTIC)

Analyze the current task/command to determine domains involved.

**DO NOT use keyword matching.** Instead, analyze:
1. What does the task actually require?
2. What files/modules will be affected?
3. What expertise is needed?

### Domain Detection (Agentic, Not Keyword-Based)

| Domain | What It Handles | Agent |
|--------|----------------|-------|
| **Frontend** | UI components, forms, layouts, styling, client-side logic | `frontend.md` |
| **UX/UI** | Design systems, accessibility, user experience | `uxui.md` |
| **Backend** | API endpoints, server logic, business rules, auth | `backend.md` |
| **Database** | Schema design, migrations, queries, data models | `database.md` |
| **Testing** | Unit tests, integration tests, e2e tests | `testing.md` |
| **DevOps** | CI/CD, deployment, infrastructure, containers | `devops.md` |

### Analysis Process (AGENTIC)

```
1. READ the task description carefully
2. REASON about what work is actually required
3. IDENTIFY which domains are involved (can be multiple)
4. CHECK which agents exist in {agentsDir}
5. DECIDE: Fragment into subtasks OR single execution
```

**Remember**: Agents in `{agentsDir}` are ALREADY project-specific. They were generated during `p. sync` with this project's patterns and technologies. Always prefer specialist agents over generalist.

---

## Step 2: Load Project Context

```
READ: .prjct/prjct.config.json → {projectId}
SET: {globalPath} = ~/.prjct-cli/projects/{projectId}

READ: {globalPath}/config/skills.json → {skillsConfig}
READ: {globalPath}/analysis/repo-analysis.json → {repoAnalysis}
```

---

## Step 3: Load Relevant Agents

For each detected domain, load the corresponding agent.

```
SET: {loadedAgents} = []

FOR EACH domain IN {detectedDomains}:
  SET: {agentPath} = {globalPath}/agents/{domain}.md

  IF file exists:
    READ: {agentPath}
    EXTRACT: frontmatter (description, skills, patterns)
    ADD to {loadedAgents}

    OUTPUT: "🤖 Loaded: {domain} agent"
```

### Agent Context Injection

Each loaded agent provides:
- **Patterns**: Code patterns specific to this project
- **Conventions**: Naming, structure, style rules
- **Skills**: Which skills to invoke for this domain
- **Anti-patterns**: What to avoid

---

## Step 4: Invoke Skills

For each loaded agent, check if skills should be invoked.

```
FOR EACH agent IN {loadedAgents}:
  GET: {agentSkills} = agent.frontmatter.skills

  FOR EACH skillName IN {agentSkills}:
    SET: {skillPath} = ~/.claude/skills/{skillName}/SKILL.md

    IF file exists:
      READ: {skillPath}
      EXTRACT: skill instructions
      ADD to {activeSkills}

      OUTPUT: "⚡ Skill active: {skillName}"
```

### Skill Selection Criteria

Only invoke skills that are:
1. **Relevant** to the current task
2. **Installed** in ~/.claude/skills/
3. **Linked** to a loaded agent

---

## Step 5: Build Execution Context

Combine all context for task execution.

```json
{
  "task": "{original task description}",
  "command": "{p. command being executed}",
  "project": {
    "id": "{projectId}",
    "ecosystem": "{repoAnalysis.ecosystem}",
    "conventions": "{repoAnalysis.conventions}"
  },
  "agents": [
    {
      "name": "{agent.name}",
      "patterns": "{agent.patterns}",
      "rules": "{agent.rules}"
    }
  ],
  "skills": [
    {
      "name": "{skill.name}",
      "instructions": "{skill.instructions}"
    }
  ],
  "execution": {
    "primaryDomain": "{primaryDomain}",
    "secondaryDomains": ["{secondaryDomains}"],
    "commands": "{repoAnalysis.commands}"
  }
}
```

---

## Step 6: Task Fragmentation (AGENTIC)

For complex multi-domain tasks, fragment into subtasks for specialist agents.

**Read**: `templates/agentic/task-fragmentation.md` for full details.

### When to Fragment

Fragment when:
- Task spans 3+ domains
- One-shot execution would saturate context
- Task has natural dependency order (database → backend → frontend)

### Fragmentation Process

```
1. IDENTIFY atomic subtasks (one domain each)
2. ASSIGN responsible agent to each subtask
3. ORDER by dependencies
4. DELEGATE via Task tool with clean context
5. COLLECT summaries for context handoff
```

### Delegation Pattern

For each subtask:

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    ## Agent Assignment
    Read and apply: {agentsPath}/{domain}.md

    ## Subtask
    {subtask.description}

    ## Previous Subtask Output (if any)
    {previousSubtask.summary}

    ## MANDATORY: Generate Summary on Completion
    - What was done
    - Files created/modified
    - Output for next agent

    ## FOCUS
    ONLY this subtask. Do NOT implement other parts.
  '
)
```

### Context Handoff

Each subtask generates a summary stored in `storage/state.json`:

```json
{
  "subtasks": [{
    "id": "subtask-1",
    "status": "completed",
    "summary": {
      "title": "Create auth schema",
      "description": "Created User and Session models",
      "outputForNextAgent": "Models available via Prisma"
    }
  }]
}
```

The summary is passed to the next subtask for context.

---

## Step 7: Execute with Context

Pass the execution context to the command template.

The command template receives:
- `{orchestrator.agents}` - Loaded agent contexts
- `{orchestrator.skills}` - Active skill instructions
- `{orchestrator.project}` - Project conventions
- `{orchestrator.execution}` - Execution metadata

---

## Multi-Domain Coordination (Example)

When task spans multiple domains, use FRAGMENTATION:

### Example: "Add user authentication with login form"

```
🎯 Task: add user authentication with login form

📊 Analysis:
├── Domains detected: database, backend, frontend
├── Agents available: database.md ✅, backend.md ✅, frontend.md ✅
└── Fragmentation: REQUIRED (3 domains)

📋 Subtasks (ordered by dependencies):
│
├─ 1. [database] Create auth schema
│     Agent: database.md
│     Output: User model, Session model, migrations
│
├─ 2. [backend] Implement auth API
│     Agent: backend.md
│     Depends on: #1
│     Output: /login, /logout endpoints
│
└─ 3. [frontend] Create login form
      Agent: frontend.md
      Depends on: #2
      Output: LoginForm component

🚀 Executing subtasks...

✅ Subtask 1 complete → Summary passed to subtask 2
✅ Subtask 2 complete → Summary passed to subtask 3
✅ Subtask 3 complete

📋 Task Complete: All 3 subtasks finished
```

---

## Orchestrator Output

At the start of each command, output:

```
🎯 Task: {task description}

📦 Context Loaded:
├── Agents: {loadedAgents.join(', ')}
├── Skills: {activeSkills.join(', ')}
└── Primary: {primaryDomain}

{Continue with command execution...}
```

---

## Integration with Commands

Every p. command should:

1. **Before execution**: Run orchestrator Steps 1-6 (including fragmentation check)
2. **During execution**: Use orchestrator context, delegate to specialists
3. **After execution**: Aggregate subtask results, log which agents were used

### Command Template Integration

```markdown
# p. {command}

## Step 0: Orchestrator

INCLUDE: templates/agentic/orchestrator.md

Execute orchestrator Steps 1-6 to:
1. Analyze task (agentic, not keyword-based)
2. Load project context
3. Load relevant agents
4. Invoke skills
5. Build execution context
6. Fragment into subtasks if needed

## Step 1: {Command-specific logic}

Use {orchestrator.agents} and {orchestrator.skills} for:
- Code patterns
- Conventions
- Domain expertise

If fragmented, delegate each subtask via Task tool.

{Rest of command...}
```

---

## Configuration

### Disable Orchestrator

For simple commands that don't need orchestration:

```yaml
---
orchestrator: false
---
```

### Force Specific Agents

```yaml
---
orchestrator:
  agents: [frontend, testing]
  skills: [ui-design]
---
```

---

## Skill Invocation Patterns

### When to Invoke Skills

| Trigger | Skills to Invoke |
|---------|------------------|
| Creating UI component | ui-design, accessibility |
| Writing API endpoint | api-design, backend-patterns |
| Database changes | sql-patterns, database-design |
| Writing tests | test-automation |
| Deploying | ci-cd, infrastructure |
| Code review | code-review |
| Creating documents | pdf, docx, pptx (if installed) |

### Skill Execution

Skills provide:
1. **Instructions** - How to approach the task
2. **Examples** - Code/pattern examples
3. **Checklists** - Quality gates
4. **References** - Additional documentation

---

## Error Handling

| Situation | Action |
|-----------|--------|
| No agents found | Use default patterns from repo-analysis |
| No skills installed | Continue without skills, suggest `p. sync` |
| Agent file missing | Skip that agent, continue with others |
| Skill file missing | Skip that skill, log warning |

---

## Logging

Log orchestrator decisions to memory:

```json
{"ts":"{timestamp}","action":"orchestrator","task":"{task}","agents":["{agents}"],"skills":["{skills}"],"primaryDomain":"{domain}"}
```
