---
allowed-tools: [Bash, Read, Write]
description: 'Verify workflow completion and close task'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'Write-Through (JSON -> MD -> Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
---

# /p:verify

Verify all workflow checkpoints are complete and close the task.

## Usage

```
/p:verify
```

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{nowContextPath}`: `{globalPath}/context/now.md`

## Step 1: Validate Project

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Validate Workflow Phase

READ: `{globalPath}/storage/state.json`

IF currentTask is null:
  OUTPUT: "No active task. Nothing to verify."
  STOP

IF currentTask.workflow is null:
  OUTPUT: "Task has no workflow. This is a legacy task."
  STOP

IF currentTask.workflow.phase != "register":
  OUTPUT:
  ```
  Cannot verify. Current phase: {currentTask.workflow.phase}

  Required phase: register (after ship)

  Workflow: analyze → branch → implement → test → review → merge → ship → verify
  
  Complete p. ship first.
  ```
  STOP

## Step 3: Validate All Checkpoints

SET: {checkpoints} = currentTask.workflow.checkpoints
SET: {required} = ["analyze", "branch", "implement", "test", "review", "merge", "tag", "release", "deploy", "register"]
SET: {missing} = []

FOR each checkpoint in {required}:
  IF {checkpoints}[checkpoint] is null:
    APPEND checkpoint to {missing}

IF {missing}.length > 0:
  OUTPUT:
  ```
  ⚠️ Incomplete workflow

  Missing checkpoints:
  {FOR each in missing: "- {checkpoint}"}

  Complete all phases before verifying.
  ```
  STOP

## Step 4: Calculate Workflow Summary

SET: {startedAt} = currentTask.workflow.startedAt
SET: {now} = GetTimestamp()
SET: {totalDuration} = time between {startedAt} and {now}
FORMAT: as "Xh Ym" or "Xd Xh"

### Gather metrics from checkpoints
SET: {scope} = checkpoints.analyze.data.scope
SET: {branchName} = checkpoints.branch.data.branchName
SET: {coverage} = checkpoints.test.data.coverage
SET: {mcpScore} = checkpoints.review.data.mcpScore
SET: {approvals} = checkpoints.review.data.approvals.length
SET: {mergeCommit} = checkpoints.merge.data.mergeCommit
SET: {version} = checkpoints.tag.data.version
SET: {releaseUrl} = checkpoints.release.data.releaseUrl

## Step 5: Complete Workflow

SET: currentTask.workflow.phase = "verify"
SET: currentTask.workflow.checkpoints.verify = {
  "completedAt": "{now}",
  "data": {
    "verified": true,
    "totalDuration": "{totalDuration}"
  }
}
SET: currentTask.workflow.completedAt = "{now}"
SET: currentTask.workflow.lastCheckpoint = "verify"

### Move to previousTask
SET: state.previousTask = {
  ...currentTask,
  "status": "completed",
  "completedAt": "{now}"
}
SET: state.currentTask = null
SET: state.lastUpdated = "{now}"

WRITE: `{statePath}`

## Step 6: Generate Context

WRITE: `{nowContextPath}`

```markdown
# NOW

_No active task_

Last completed: {previousTask.description}
Duration: {totalDuration}
Version: {version}

Use p. task to start new work.
```

## Step 7: Log Events

APPEND to `{memoryPath}`:
```json
{"timestamp":"{now}","action":"workflow_completed","taskId":"{previousTask.id}","duration":"{totalDuration}","checkpoints":11}
{"timestamp":"{now}","action":"checkpoint_completed","taskId":"{previousTask.id}","checkpoint":"verify"}
```

APPEND to `{syncPath}`:
```json
{"type":"workflow.completed","data":{"taskId":"{previousTask.id}","duration":"{totalDuration}","version":"{version}"},"timestamp":"{now}"}
```

## Output

```
✓ Workflow Complete

Task: {previousTask.description}
Type: {previousTask.type}
Duration: {totalDuration}
Version: {version}

Checkpoints (11/11):
1. analyze ✓ - Scope: {scope}
2. branch ✓ - {branchName}
3. implement ✓
4. test ✓ - Coverage: {coverage}
5. review ✓ - MCP: {mcpScore}/100, Approvals: {approvals}
6. merge ✓ - {mergeCommit}
7. tag ✓ - v{version}
8. release ✓ - {releaseUrl}
9. deploy ✓ - Reminded
10. register ✓ - Logged
11. verify ✓ - Complete

Summary:
- All phases completed
- Audit trail recorded
- Task closed

Next: p. task to start new work
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No active task | "Nothing to verify" | STOP |
| No workflow | "Legacy task" | STOP |
| Wrong phase | Show required phase | STOP |
| Missing checkpoints | List missing | STOP |

## Natural Language Triggers

- `p. verify` -> /p:verify
- `p. complete` -> /p:verify
- `p. close` -> /p:verify

## References

- Architecture: `~/.prjct-cli/docs/architecture.md`
- Workflow: `~/.prjct-cli/docs/workflow.md`
