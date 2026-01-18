# Sub-Agent Generation

Generate project-specific agents based on detected stack.

## Output Location

`{globalPath}/agents/` (NEVER local project)

## Agent Format

```markdown
---
name: agent-name
description: When to use. Include "Use PROACTIVELY" for auto-invoke.
tools: Read, Write, Glob, Grep, Bash
model: sonnet
skills: [skill-name]
---
Agent prompt...
```

## Required Workflow Agents

| Agent | Purpose | Skill |
|-------|---------|-------|
| prjct-workflow.md | Task lifecycle | - |
| prjct-planner.md | Feature planning | feature-dev |
| prjct-shipper.md | Git, deploy | code-review |

## Domain Agents (based on stack)

| If Detected | Generate | Skill |
|-------------|----------|-------|
| React, Vue, CSS | frontend.md | frontend-design |
| Node, Express, API | backend.md | javascript-typescript |
| PostgreSQL, MongoDB | database.md | - |
| Docker, CI/CD | devops.md | developer-kit |
| Jest, Pytest | testing.md | developer-kit |
| Any UI | uxui.md | frontend-design |

## Execution

1. Read `{globalPath}/analysis/repo-summary.md`
2. Create `{globalPath}/agents/` directory
3. Generate workflow agents (always)
4. Generate domain agents (based on analysis)
5. Add skills to frontmatter
6. Report generated agents

## Rules

- **ALWAYS** write to `{globalPath}/agents/`
- **NEVER** write to `.claude/` or `.prjct/`
- Adapt templates to project context
