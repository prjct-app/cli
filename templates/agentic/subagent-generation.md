# Sub-Agent Generation

Generate Claude Code sub-agents for this project based on detected stack.

## Input Context

You have access to:
- `{analysis}` - repo-summary.md with detected technologies
- `{projectPath}` - Path to project root
- `{projectId}` - Project identifier

## Output Location

Write sub-agents to: `{globalPath}/agents/` (global storage, NOT local project)

## Sub-Agent Format (Claude Code)

```markdown
---
name: agent-name
agentId: p.agent.{name}
description: When to use this agent. Include "Use PROACTIVELY" for auto-invocation.
tools: Read, Write, Glob, Grep, Bash
model: sonnet
skills: [skill-name]
projectId: {projectId}
projectPath: {projectPath}
---

Agent system prompt here...
```

**Required fields:**
- `agentId`: Unique identifier for mentions. Format: `p.agent.{name}` (e.g., `p.agent.backend`, `p.agent.frontend`)
- `skills`: Links the agent to Claude Code skills from claude-plugins.dev
- `projectId`: Links agent to specific project
- `projectPath`: Path to project root

**Agent ID Convention:**
- All prjct agents use prefix `p.agent.`
- The `{name}` is derived from the agent filename without `.md`
- Examples: `p.agent.backend`, `p.agent.frontend`, `p.agent.workflow`, `p.agent.planner`
- Users can mention agents in prompts using this ID

## Generation Rules

### 1. ALWAYS Generate Workflow Agents

These are REQUIRED for every prjct project:

#### prjct-workflow.md
- Commands: /p:now, /p:done, /p:next, /p:pause, /p:resume
- Tools: Read, Write, Glob
- Purpose: Task lifecycle management

#### prjct-planner.md
- Commands: /p:feature, /p:idea, /p:spec, /p:bug
- Tools: Read, Write, Glob, Grep
- Purpose: Feature planning and breakdown

#### prjct-shipper.md
- Commands: /p:ship
- Tools: Read, Write, Bash, Glob
- Purpose: Git operations, testing, deployment

### 2. Generate Domain Agents Based on Stack

Analyze `{analysis}` and create ONLY relevant domain agents:

| If Detected | Generate | Tools | Skill |
|-------------|----------|-------|-------|
| React, Vue, Angular, Svelte, CSS, HTML | `frontend.md` | Read, Write, Glob, Grep | `frontend-design` |
| Node.js, Express, Go, Python API, REST, GraphQL | `backend.md` | Read, Write, Bash, Glob, Grep | `javascript-typescript` or `python-development` |
| PostgreSQL, MySQL, MongoDB, Redis, Prisma | `database.md` | Read, Write, Bash | (none) |
| Docker, Kubernetes, CI/CD, GitHub Actions | `devops.md` | Read, Bash, Glob | `developer-kit` |
| Bun test, Jest, Pytest, Testing Library | `testing.md` | Read, Write, Bash | `developer-kit` |
| ANY frontend UI (web or mobile) | `uxui.md` | Read, Write, Glob, Grep | `frontend-design` |

### 3. Adapt to Project Context

Each generated agent should include:
- Project-specific paths from analysis
- Detected frameworks and versions
- Relevant patterns found in codebase

## Execution Steps

1. **Read Analysis**
   ```
   Read("{globalPath}/analysis/repo-summary.md")
   ```

2. **Create Directory**
   ```
   Bash("mkdir -p {globalPath}/agents")
   ```

3. **Generate Workflow Agents** (always)
   - Read template from `templates/subagents/workflow/prjct-workflow.md`
   - Adapt with project context
   - Write to `{globalPath}/agents/prjct-workflow.md`
   - Repeat for prjct-planner.md and prjct-shipper.md

4. **Generate Domain Agents** (based on analysis)
   - For each detected technology stack:
     - Read corresponding template from `templates/subagents/domain/`
     - Adapt with project-specific details
     - Write to `{globalPath}/agents/`

5. **Link Skills to Agents**
   - Read `templates/config/skill-mappings.json`
   - For each generated agent, add the corresponding skill to frontmatter
   - Skill mappings:
     - `frontend.md` → `skills: [frontend-design]`
     - `uxui.md` → `skills: [frontend-design]`
     - `backend.md` → `skills: [javascript-typescript]` (or `python-development` for Python)
     - `testing.md` → `skills: [developer-kit]`
     - `devops.md` → `skills: [developer-kit]`
     - `prjct-planner.md` → `skills: [feature-dev]`
     - `prjct-shipper.md` → `skills: [code-review]`

6. **Report Generated Agents**
   ```
   Generated sub-agents in {globalPath}/agents/:
   - prjct-workflow.md (workflow)
   - prjct-planner.md (workflow) → /feature-dev
   - prjct-shipper.md (workflow) → /code-review
   - frontend.md (detected: React) → /frontend-design
   - backend.md (detected: Node.js) → /javascript-typescript
   ```

## Critical Rules

- **NEVER write agents to local project directories** (`.claude/`, `.prjct/`)
- **ALWAYS write agents to `{globalPath}/agents/`** (global storage)
- NEVER hardcode technology detection in TypeScript
- ALWAYS read and analyze repo-summary.md
- ADAPT templates to project context
- Use Claude Code frontmatter format exactly
- Include "Use PROACTIVELY" in descriptions for auto-invocation
