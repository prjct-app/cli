# Sub-Agent Generation

Generate Claude Code sub-agents for this project based on detected stack.

## Input Context

You have access to:
- `{analysis}` - repo-summary.md with detected technologies
- `{projectPath}` - Path to project root
- `{projectId}` - Project identifier

## Output Location

Write sub-agents to: `{projectPath}/.claude/agents/`

## Sub-Agent Format (Claude Code)

```markdown
---
name: agent-name
description: When to use this agent. Include "Use PROACTIVELY" for auto-invocation.
tools: Read, Write, Glob, Grep, Bash
model: sonnet
---

Agent system prompt here...
```

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

| If Detected | Generate | Tools |
|-------------|----------|-------|
| React, Vue, Angular, Svelte, CSS, HTML | `frontend.md` | Read, Write, Glob, Grep |
| Node.js, Express, Go, Python API, REST, GraphQL | `backend.md` | Read, Write, Bash, Glob, Grep |
| PostgreSQL, MySQL, MongoDB, Redis, Prisma | `database.md` | Read, Write, Bash |
| Docker, Kubernetes, CI/CD, GitHub Actions | `devops.md` | Read, Bash, Glob |
| Jest, Pytest, Vitest, Testing Library | `testing.md` | Read, Write, Bash |

### 3. Adapt to Project Context

Each generated agent should include:
- Project-specific paths from analysis
- Detected frameworks and versions
- Relevant patterns found in codebase

## Execution Steps

1. **Read Analysis**
   ```
   Read("{projectPath}/.prjct-cli/projects/{projectId}/analysis/repo-summary.md")
   ```

2. **Create Directory**
   ```
   Bash("mkdir -p {projectPath}/.claude/agents")
   ```

3. **Generate Workflow Agents** (always)
   - Read template from `templates/subagents/workflow/prjct-workflow.md`
   - Adapt with project context
   - Write to `{projectPath}/.claude/agents/prjct-workflow.md`
   - Repeat for prjct-planner.md and prjct-shipper.md

4. **Generate Domain Agents** (based on analysis)
   - For each detected technology stack:
     - Read corresponding template from `templates/subagents/domain/`
     - Adapt with project-specific details
     - Write to `{projectPath}/.claude/agents/`

5. **Report Generated Agents**
   ```
   Generated sub-agents in .claude/agents/:
   - prjct-workflow.md (workflow)
   - prjct-planner.md (workflow)
   - prjct-shipper.md (workflow)
   - frontend.md (detected: React)
   - backend.md (detected: Node.js)
   ```

## Critical Rules

- NEVER hardcode technology detection in TypeScript
- ALWAYS read and analyze repo-summary.md
- ADAPT templates to project context
- Use Claude Code frontmatter format exactly
- Include "Use PROACTIVELY" in descriptions for auto-invocation
