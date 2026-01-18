---
allowed-tools: [Read]
---

# Agent Routing

Determine best agent for a task.

## Process

1. **Understand task**: What files? What work? What knowledge?
2. **Read project context**: Technologies, structure, patterns
3. **Match to agent**: Based on analysis, not assumptions

## Agent Types

| Type | Domain |
|------|--------|
| Frontend/UX | UI components, styling |
| Backend | API, server logic |
| Database | Schema, queries, migrations |
| DevOps/QA | Testing, CI/CD |
| Full-stack | Cross-cutting concerns |

## Delegation

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    Read: ~/.prjct-cli/projects/{projectId}/agents/{agent}.md
    Task: {description}
    Execute using agent patterns.
  '
)
```

**Pass PATH, not CONTENT** - subagent reads what it needs.

## Output

```
✅ Delegated to: {agent}
Result: {summary}
```
