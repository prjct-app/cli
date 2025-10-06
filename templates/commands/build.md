---
allowed-tools: [Read, Write, GetTimestamp]
description: 'Start task with agent assignment'
timestamp-rule: 'CRITICAL - ALWAYS use GetTimestamp() tool for id and started fields. NEVER generate timestamps manually.'
---

# /p:build

## Validation

- Blocks if: `core/now.md` has active task
- Error: "Complete current task first. Use /p:done"

## Flow

1. Parse: task desc OR queue # (1-5)
2. Detect: `TaskSchema.detectAgent(task)` + complexity
3. Get: GitHub dev from `git config user.name` + remote
4. Create: task metadata with agent, complexity, estimate
5. Write: `core/now.md` with frontmatter (use GetTimestamp() for id and started)

## Frontmatter

**Use GetTimestamp() tool for both id and started fields:**

```yaml
---
id: task-{GetTimestamp()}
agent: {detected_agent}
dev: @{github_username}
complexity: {trivial|simple|moderate|complex|epic}
estimated: {time_range}
started: {GetTimestamp()}
---
{task_description}
```

## Response

```
🎯 {task}
{agent_icon} {agent_name}
Est: {time_estimate}
Complexity: {level}

/p:done when finished
```
