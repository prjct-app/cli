# Standard Project Validation

Reusable validation patterns for prjct commands.

## Project Config Validation

```
READ: .prjct/prjct.config.json
EXTRACT: projectId

IF file not found OR projectId missing:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

SET: {globalPath} = ~/.prjct-cli/projects/{projectId}
```

## Git Repository Check

```
BASH: git rev-parse --git-dir 2>/dev/null

IF fails:
  SET: {isGitRepo} = false
  # Continue without git features
ELSE:
  SET: {isGitRepo} = true
  BASH: git branch --show-current
  SET: {currentBranch} = result
```

## Current Task Check

```
READ: {globalPath}/storage/state.json

IF currentTask exists AND status == "active":
  SET: {hasActiveTask} = true
  SET: {activeTaskDescription} = currentTask.description
  SET: {elapsedTime} = now - currentTask.startedAt
ELSE:
  SET: {hasActiveTask} = false
```

## Protected Branch Check

```
IF {currentBranch} == "main" OR {currentBranch} == "master":
  OUTPUT: "Cannot execute on protected branch: {currentBranch}"
  STOP
```

## Uncommitted Changes Check

```
BASH: git status --porcelain

IF not empty:
  SET: {hasUncommittedChanges} = true
  SET: {modifiedFiles} = parse result
ELSE:
  SET: {hasUncommittedChanges} = false
```

## Timestamp Generation

```bash
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```

## UUID Generation

```bash
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```
