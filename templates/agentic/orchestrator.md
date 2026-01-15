# Orchestrator - Agent & Skill Coordinator

**Purpose**: Automatically route tasks to the right agents and skills.

## How It Works

```
User Task → Orchestrator → [Analyze] → [Load Agents] → [Invoke Skills] → [Execute]
```

The orchestrator is **implicit** - it runs automatically for every p. command.

---

## Step 1: Task Analysis

Analyze the current task/command to determine domains involved.

### Domain Detection Keywords

| Domain | Keywords | Agent | Skills |
|--------|----------|-------|--------|
| **Frontend** | react, vue, component, UI, CSS, styling, layout | `frontend.md` | ui-design, react-patterns |
| **UX/UI** | design, user experience, accessibility, UX, interaction | `uxui.md` | ux-research, accessibility |
| **Backend** | API, server, endpoint, database query, auth | `backend.md` | api-design, backend-patterns |
| **Database** | schema, migration, query, SQL, ORM, prisma | `database.md` | sql-patterns, database-design |
| **Testing** | test, spec, coverage, TDD, unit, integration | `testing.md` | test-automation |
| **DevOps** | deploy, CI/CD, docker, kubernetes, pipeline | `devops.md` | ci-cd, infrastructure |
| **Planning** | plan, architecture, design doc, PRD, spec | `prjct-planner.md` | architecture |
| **Shipping** | ship, release, PR, merge, version | `prjct-shipper.md` | code-review |

### Analysis Process

```
1. EXTRACT keywords from task description
2. MATCH keywords to domains (can be multiple)
3. SET: {detectedDomains} = matched domains
4. SET: {primaryDomain} = highest match count
5. SET: {secondaryDomains} = other matches
```

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

## Step 6: Execute with Context

Pass the execution context to the command template.

The command template receives:
- `{orchestrator.agents}` - Loaded agent contexts
- `{orchestrator.skills}` - Active skill instructions
- `{orchestrator.project}` - Project conventions
- `{orchestrator.execution}` - Execution metadata

---

## Multi-Domain Coordination

When task spans multiple domains:

### Example: "Add user authentication with login form"

```
Detected domains:
├── Frontend (login form, UI)
├── Backend (auth API, sessions)
└── Database (users table, schema)

Loaded agents:
├── frontend.md → React patterns, form handling
├── backend.md → API design, auth patterns
└── database.md → Schema design, migrations

Active skills:
├── ui-design → Form components
├── api-design → Auth endpoints
└── sql-patterns → User schema

Execution order:
1. Database: Create users schema
2. Backend: Implement auth API
3. Frontend: Build login form
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

1. **Before execution**: Run orchestrator Steps 1-5
2. **During execution**: Use orchestrator context
3. **After execution**: Log which agents/skills were used

### Command Template Integration

```markdown
# p. {command}

## Step 0: Orchestrator

INCLUDE: templates/agentic/orchestrator.md

Execute orchestrator Steps 1-5 to build context.

## Step 1: {Command-specific logic}

Use {orchestrator.agents} and {orchestrator.skills} for:
- Code patterns
- Conventions
- Domain expertise

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
