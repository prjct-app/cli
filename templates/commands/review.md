---
allowed-tools: [Bash, Read, Write, Task, AskUserQuestion]
description: 'Code review with MCP agent and GitHub approvals'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'Write-Through (JSON -> MD -> Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
---

# /p:review

Run MCP code review agent and wait for GitHub PR approvals.

## Usage

```
/p:review [--skip-mcp]    # Skip MCP agent review
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
  IF currentTask.workflow.phase != "test":
    OUTPUT:
    ```
    Cannot start review. Current phase: {currentTask.workflow.phase}

    Required phase: test

    Workflow: analyze → branch → implement → test → review → merge → ship → verify
    
    Run p. test first to advance to test phase.
    ```
    STOP

## Step 3: Run MCP Code Review (unless --skip-mcp)

IF NOT --skip-mcp:
  OUTPUT: "Running MCP code review..."
  
  ### Get changed files
  BASH: `git diff --name-only HEAD~1..HEAD 2>/dev/null || git diff --name-only`
  SET: {changedFiles} = result
  
  ### Analyze with MCP agent
  FOR each file in {changedFiles}:
    READ: file
    ANALYZE for:
    - Security issues (hardcoded secrets, injection vulnerabilities)
    - Logic errors
    - Missing error handling
    - Performance issues
    - Code style violations
    
    ASSIGN confidence score (0-100):
    - 90-100: Definite bug/security issue
    - 70-89: Likely problem
    - 50-69: Maybe a problem
    - 0-49: Nitpick/style
  
  SET: {issues} = issues with confidence >= 70
  SET: {mcpScore} = 100 - (count of high-confidence issues * 10)
  
  IF {issues}.length > 0:
    OUTPUT:
    ```
    ## MCP Code Review Results
    
    Found {issues.length} issues (confidence >= 70%):
    
    {FOR each issue:}
    - [{confidence}%] {description}
      File: {file}:{line}
    {END FOR}
    ```
    
    USE AskUserQuestion:
    ```
    question: "Code review found {issues.length} issues. How to proceed?"
    header: "Review Issues"
    options:
      - label: "Fix issues first"
        description: "Return to implement phase to fix"
      - label: "Proceed anyway"
        description: "Continue with PR creation"
    ```
    
    IF choice == "Fix issues first":
      OUTPUT: "Returning to implement phase. Fix issues and run p. test again."
      STOP
  ELSE:
    OUTPUT: "✓ MCP review passed. No high-confidence issues found."
    SET: {mcpScore} = 100

## Step 4: Create/Check PR

### Check if PR exists
BASH: `gh pr view --json url,number,state 2>/dev/null`

IF PR exists:
  SET: {prUrl} = result.url
  SET: {prNumber} = result.number
  SET: {prState} = result.state
  OUTPUT: "PR exists: {prUrl}"
ELSE:
  OUTPUT: "Creating PR..."
  
  SET: {branchName} = currentTask.branch.name
  SET: {baseBranch} = currentTask.branch.baseBranch OR "main"
  
  BASH: `git push -u origin {branchName} 2>&1`
  
  SET: {prTitle} = "{currentTask.type}: {currentTask.description}"
  SET: {prBody} = """
## Summary
{currentTask.description}

## Workflow Phase
- [x] Analyze
- [x] Branch
- [x] Implement  
- [x] Test
- [ ] Review ← current
- [ ] Merge
- [ ] Ship
- [ ] Verify

## MCP Review Score
{mcpScore}/100

---
🤖 Generated with [p/](https://www.prjct.app/)
"""
  
  BASH: `gh pr create --title "{prTitle}" --base {baseBranch} --body "$(cat <<'PREOF'
{prBody}
PREOF
)"`
  
  EXTRACT: {prUrl}, {prNumber} from output

## Step 5: Check GitHub Approvals

OUTPUT: "Checking for approvals..."

BASH: `gh pr view {prNumber} --json reviews,reviewDecision`
SET: {reviews} = result.reviews
SET: {decision} = result.reviewDecision

IF {decision} == "APPROVED":
  SET: {approved} = true
  SET: {approvals} = reviews where state == "APPROVED"
  OUTPUT: "✓ PR approved by {approvals.length} reviewer(s)"
ELSE IF {decision} == "CHANGES_REQUESTED":
  OUTPUT:
  ```
  ⚠️ Changes requested
  
  {FOR each review where state == "CHANGES_REQUESTED":}
  - {review.author}: {review.body}
  {END FOR}
  
  Address feedback, push changes, and run p. review again.
  ```
  STOP
ELSE:
  OUTPUT:
  ```
  ⏳ Waiting for approvals
  
  PR: {prUrl}
  
  Request review from team members, then run p. review again.
  ```
  STOP

## Step 6: Update Workflow Phase

SET: {now} = GetTimestamp()

SET: currentTask.workflow.phase = "review"
SET: currentTask.workflow.checkpoints.review = {
  "completedAt": "{now}",
  "data": {
    "mcpScore": {mcpScore},
    "approvals": {approvals},
    "prUrl": "{prUrl}",
    "prNumber": {prNumber}
  }
}
SET: currentTask.workflow.lastCheckpoint = "review"
SET: currentTask.branch.prUrl = "{prUrl}"
SET: currentTask.branch.prNumber = {prNumber}

WRITE: `{statePath}`

## Step 7: Log Events

APPEND to `{memoryPath}`:
```json
{"timestamp":"{now}","action":"phase_advanced","taskId":"{currentTask.id}","from":"test","to":"review"}
{"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"review","data":{"mcpScore":{mcpScore},"approvals":{approvals.length}}}
```

APPEND to `{syncPath}`:
```json
{"type":"workflow.phase_advanced","data":{"taskId":"{currentTask.id}","from":"test","to":"review","prUrl":"{prUrl}"},"timestamp":"{now}"}
```

## Output

```
✓ Review Complete

Task: {currentTask.description}
MCP Score: {mcpScore}/100
Approvals: {approvals.length}
PR: {prUrl}

Phase: review (5/11 checkpoints)

Workflow:
1. analyze ✓
2. branch ✓
3. implement ✓
4. test ✓
5. review ✓
6. merge ← next

Next: p. merge to merge PR
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No active task | "No active task" | STOP |
| Wrong phase | Show required phase | STOP |
| MCP issues found | Ask user | WAIT |
| Changes requested | Show feedback | STOP |
| No approvals | Show PR URL | STOP |
| gh CLI missing | "Install gh CLI" | STOP |

## Natural Language Triggers

- `p. review` -> /p:review
- `p. code review` -> /p:review
- `p. pr` -> /p:review

## References

- Architecture: `~/.prjct-cli/docs/architecture.md`
- Workflow: `~/.prjct-cli/docs/workflow.md`
