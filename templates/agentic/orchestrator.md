# Orchestrator

Load project context for task execution.

## Flow

```
p. {command} → Load Config → Load State → Load Agents → Execute
```

## Step 1: Load Config

```
READ: .prjct/prjct.config.json → {projectId}
SET: {globalPath} = ~/.prjct-cli/projects/{projectId}
```

## Step 2: Load State

```bash
prjct dash compact
# Parse output to determine: {hasActiveTask}
```

## Step 3: Load Agents

```
GLOB: {globalPath}/agents/*.md
FOR EACH agent: READ and store content
```

## Step 4: Detect Domains

Analyze task → identify domains:
- frontend: UI, forms, components
- backend: API, server logic
- database: Schema, queries
- testing: Tests, mocks
- devops: CI/CD, deployment

IF task spans 3+ domains → fragment into subtasks

## Step 5: Build Context

Combine: state + agents + detected domains → execute

## Output Format

```
🎯 Task: {description}
📦 Context: Agent: {name} | State: {status} | Domains: {list}
```

## Error Handling

| Situation | Action |
|-----------|--------|
| No config | "Run `p. init` first" |
| No state | Create default |
| No agents | Warn, continue |

## Disable

```yaml
---
orchestrator: false
---
```
