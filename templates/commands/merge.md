---
allowed-tools: [Bash, Read, Write, AskUserQuestion]
description: 'Merge PR to main branch'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'Write-Through (JSON -> MD -> Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
---

# /p:merge

Merge approved PR to main branch.

## Usage

```
/p:merge [--squash|--rebase|--merge]    # Merge strategy (default: squash)
         [--delete-branch]               # Delete branch after merge
```

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{syncPath}`: `{globalPath}/sync/pending.json`

## Step 1: Validate Project

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Validate Workflow Phase

READ: `{globalPath}/storage/state.json`

IF currentTask is null:
  OUTPUT: "No active task. Use p. task to start one."
  STOP

IF currentTask.workflow exists:
  IF currentTask.workflow.phase != "review":
    OUTPUT:
    ```
    Cannot merge. Current phase: {currentTask.workflow.phase}

    Required phase: review

    Workflow: analyze → branch → implement → test → review → merge → ship → verify
    
    Complete code review first with p. review
    ```
    STOP

## Step 3: Verify PR Status

SET: {prNumber} = currentTask.branch.prNumber

IF {prNumber} is null:
  OUTPUT: "No PR found. Run p. review first to create PR."
  STOP

### Check PR is approved
BASH: `gh pr view {prNumber} --json reviewDecision,mergeable,state`
SET: {decision} = result.reviewDecision
SET: {mergeable} = result.mergeable
SET: {state} = result.state

IF {state} == "MERGED":
  OUTPUT: "PR already merged."
  -> Skip to Step 5 (update workflow)

IF {decision} != "APPROVED":
  OUTPUT:
  ```
  ⚠️ PR not approved yet

  Current status: {decision}
  
  Get approvals and run p. merge again.
  ```
  STOP

IF {mergeable} != "MERGEABLE":
  OUTPUT:
  ```
  ⚠️ PR has conflicts or is not mergeable

  Status: {mergeable}
  
  Resolve conflicts and run p. merge again.
  ```
  STOP

## Step 4: Merge PR

### Parse merge strategy
SET: {strategy} = "squash"  # default
IF --rebase: {strategy} = "rebase"
IF --merge: {strategy} = "merge"

OUTPUT: "Merging PR #{prNumber} with {strategy} strategy..."

BASH: `gh pr merge {prNumber} --{strategy} --auto 2>&1`

IF command fails:
  OUTPUT: "Merge failed. Check PR status on GitHub."
  STOP

### Delete branch if requested
IF --delete-branch OR currentTask.branch.createdByPrjct:
  BASH: `git branch -d {currentTask.branch.name} 2>/dev/null`
  BASH: `git push origin --delete {currentTask.branch.name} 2>/dev/null`
  OUTPUT: "Deleted branch: {currentTask.branch.name}"

### Switch to base branch
BASH: `git checkout {currentTask.branch.baseBranch}`
BASH: `git pull origin {currentTask.branch.baseBranch}`

## Step 5: Update Workflow Phase

SET: {now} = GetTimestamp()

### Get merge commit
BASH: `git rev-parse HEAD`
SET: {mergeCommit} = result

SET: currentTask.workflow.phase = "merge"
SET: currentTask.workflow.checkpoints.merge = {
  "completedAt": "{now}",
  "data": {
    "mergeCommit": "{mergeCommit}",
    "prNumber": {prNumber},
    "strategy": "{strategy}"
  }
}
SET: currentTask.workflow.lastCheckpoint = "merge"

WRITE: `{statePath}`

## Step 6: Log Events

APPEND to `{memoryPath}`:
```json
{"timestamp":"{now}","action":"phase_advanced","taskId":"{currentTask.id}","from":"review","to":"merge"}
{"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"merge","data":{"mergeCommit":"{mergeCommit}"}}
```

APPEND to `{syncPath}`:
```json
{"type":"workflow.phase_advanced","data":{"taskId":"{currentTask.id}","from":"review","to":"merge","mergeCommit":"{mergeCommit}"},"timestamp":"{now}"}
```

## Output

```
✓ PR Merged

Task: {currentTask.description}
PR: #{prNumber}
Merge commit: {mergeCommit}
Strategy: {strategy}

Phase: merge (6/11 checkpoints)

Workflow:
1. analyze ✓
2. branch ✓
3. implement ✓
4. test ✓
5. review ✓
6. merge ✓
7-10. ship ← next

Next: p. ship to release
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No active task | "No active task" | STOP |
| Wrong phase | Show required phase | STOP |
| No PR | "Run p. review first" | STOP |
| Not approved | "Get approvals first" | STOP |
| Conflicts | "Resolve conflicts" | STOP |
| Merge fails | Show error | STOP |

## Natural Language Triggers

- `p. merge` -> /p:merge
- `p. merge pr` -> /p:merge

## References

- Architecture: `~/.prjct-cli/docs/architecture.md`
- Workflow: `~/.prjct-cli/docs/workflow.md`
