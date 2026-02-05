---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. done

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read Current State

READ `{globalPath}/storage/state.json`

```
IF no currentTask OR currentTask is null:
  OUTPUT: "No active task. Use `p. task` to start one."
  STOP
```

## Step 3: Handle Subtasks

```
IF currentTask.subtasks exists AND has items:
  current = currentTask.subtasks[currentTask.currentSubtaskIndex]
  remaining = subtasks where status != "completed"

  IF remaining.length > 1:
    # More subtasks after current one
    AskUserQuestion:
      question: "Subtask complete. What next?"
      header: "Done"
      options:
        - label: "Next subtask (Recommended)"
          description: "Mark current done, move to next"
        - label: "Complete all remaining"
          description: "Mark entire task as done"
        - label: "Continue current"
          description: "Keep working on this subtask"

    IF "Next subtask":
      # Mark current subtask as completed
      currentTask.subtasks[currentSubtaskIndex].status = "completed"
      currentTask.currentSubtaskIndex++
      currentTask.subtasks[currentSubtaskIndex].status = "active"
      currentTask.description = currentTask.subtasks[currentSubtaskIndex].description

      WRITE state.json

      OUTPUT:
      """
      ✅ Subtask complete: {completed subtask}

      Progress: {completed}/{total} subtasks

      Current: {next subtask description}

      Next: Continue working, then `p. done`
      """
      STOP

    IF "Continue current":
      OUTPUT: "Continuing: {current subtask}"
      STOP

    # If "Complete all" - fall through to complete task
```

## Step 4: Complete Task

Generate timestamp:
```bash
node -e "console.log(new Date().toISOString())"
```

Calculate duration from `currentTask.startedAt` to now.

Update state:
```
# Mark all subtasks as completed
FOR each subtask in currentTask.subtasks:
  subtask.status = "completed"

# Update task status
currentTask.status = "completed"
currentTask.completedAt = "{timestamp}"

# Move to previousTask
previousTask = currentTask
currentTask = null
```

WRITE `{globalPath}/storage/state.json`:

## Step 4.5: Capture Learnings & Value (LLM Knowledge)

**⚠️ This data is for LLM future reference, not human documentation.**

Based on the work completed, analyze the code changes and capture:

### Learnings (Technical Knowledge for Future LLM Sessions)

Identify and record:
- **Patterns** - Any new code patterns introduced or discovered
- **Approaches** - How problems were solved (implementation strategies)
- **Decisions** - Why certain approaches were chosen over alternatives
- **Gotchas** - Things that could trip up future work on similar tasks

### Value Contribution

Assess what value this task brings to the project:
- **Type**: feature | bugfix | performance | dx | refactor | infrastructure
- **Impact**: high | medium | low
- **Description**: 1-2 sentences on the value added

### Get Files Changed

```bash
git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached
```

### Generate Tags

Extract tags from the task context:
- Domain tags (frontend, backend, api, database, etc.)
- Feature tags (auth, ui, testing, etc.)
- Technical tags (refactor, performance, security, etc.)

### Write to Learnings File

APPEND to `{globalPath}/memory/learnings.jsonl`:
```jsonl
{"taskId":"{id}","linearId":"{linearId or null}","timestamp":"{timestamp}","learnings":{"patterns":["pattern 1","pattern 2"],"approaches":["how X was solved"],"decisions":["why Y was chosen over Z"],"gotchas":["watch out for X"]},"value":{"type":"feature","impact":"high","description":"Brief description of value added"},"filesChanged":["path/to/file1.ts"],"tags":["domain-tag","feature-tag"]}
```

**Note**: This local cache enables future semantic retrieval without API latency. Will eventually feed into vector DB for cross-session LLM knowledge transfer.

---
```json
{
  "currentTask": null,
  "previousTask": {
    "id": "{task.id}",
    "description": "{task.parentDescription}",
    "type": "{task.type}",
    "status": "completed",
    "startedAt": "{task.startedAt}",
    "completedAt": "{timestamp}",
    "subtasks": [...],
    "branch": "{task.branch}",
    "linearId": "{task.linearId or null}"
  },
  "pausedTasks": []
}
```

## Step 5: Sync Issue Tracker Status (REQUIRED - DO NOT SKIP)

**⛔ This step is MANDATORY if there's a linked issue. NEVER skip this.**

**⛔ WRITE TO REMOTE ONLY - Do NOT re-read issue from API (token efficiency)**

The linearId/externalId is already in `previousTask` from local state.json.
Only send status update to remote API.

```
IF previousTask.linearId exists:
  # ═══════════════════════════════════════════════════════════════
  # USE prjct CLI DIRECTLY - NOT $PRJCT_CLI (may be unset)
  # ═══════════════════════════════════════════════════════════════
  RUN: prjct linear done "{linearId}"
  RUN: prjct linear comment "{linearId}" "✅ Task completed. Ready for ship."

  OUTPUT: "Linear: {linearId} → Done ✓"

ELSE IF previousTask.externalId AND previousTask.externalProvider == "jira":
  RUN: prjct jira transition "{externalId}" "Done"
  RUN: prjct jira comment "{externalId}" "✅ Task completed. Ready for ship."

  OUTPUT: "JIRA: {externalId} → Done ✓"

ELSE:
  # No issue tracker linked - that's OK, prjct works without it
  # Just skip the sync step silently
```

## Step 6: Log Event

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"task_completed","taskId":"{id}","description":"{parentDescription}","timestamp":"{timestamp}","duration":"{duration}"}
```

## Step 7: Count Stats

```bash
# Count files changed
git diff --stat HEAD~1 2>/dev/null | tail -1 || echo "0 files"

# Count commits on branch
git rev-list --count HEAD ^main 2>/dev/null || echo "0"
```

---

## Output

```
✅ {task description} ({duration})

Files: {count} | Commits: {count}
{linearId ? "Linear: {linearId} → Done" : ""}

Next:
- More work? → `p. task "description"`
- Ready to ship? → `p. ship`
- See queue → `p. next`
```
