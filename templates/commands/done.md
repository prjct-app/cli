---
allowed-tools: [Bash, AskUserQuestion]
---

# p. done

## Step 1: Complete Task via CLI

```bash
prjct done
```

The CLI handles:
- Reading current task from SQLite
- Checking if active task exists
- Completing the task
- Recording outcomes and metrics
- Syncing Linear/JIRA status
- Event logging

If no active task, CLI will output a warning. Show it to the user and stop.

## Step 2: Collect Handoff (MANDATORY for subtask completion)

**⛔ DO NOT skip this step. Every completion MUST include handoff data.**

The LLM should analyze the work done and produce:

### 1. Get Files Changed

```bash
git diff --name-only HEAD 2>/dev/null
git diff --name-only --cached 2>/dev/null
```

Categorize each file as `created`, `modified`, or `deleted`.

### 2. Summarize Work Done

Based on the code changes and task context, produce:
- **whatWasDone**: Array of 1-5 bullet points describing key accomplishments
- **outputForNextAgent**: A paragraph explaining context the next subtask needs:
  - What was built/changed and why
  - Key decisions made and their rationale
  - Any patterns established that subsequent work should follow
  - Known issues or edge cases to watch for

### 3. Validation

```
IF whatWasDone is empty:
  ⛔ STOP. At least one item is required.

IF outputForNextAgent is empty:
  ⛔ STOP. Context for next subtask is required.
```

## Step 3: Capture Learnings (LLM Knowledge)

**⚠️ This data is for LLM future reference, not human documentation.**

Based on the work completed, analyze and identify:
- **Patterns** - Any new code patterns introduced or discovered
- **Approaches** - How problems were solved
- **Decisions** - Why certain approaches were chosen
- **Gotchas** - Things that could trip up future work

## Step 4: Sync Issue Tracker Status (if linked)

**⛔ WRITE TO REMOTE ONLY - Do NOT re-read issue from API**

```
IF the completed task had a linearId:
  prjct linear done "{linearId}"
  prjct linear comment "{linearId}" "✅ Task completed. Ready for ship."
  OUTPUT: "Linear: {linearId} → Done ✓"

ELSE IF the completed task had a jiraId:
  prjct jira transition "{jiraId}" "Done"
  prjct jira comment "{jiraId}" "✅ Task completed. Ready for ship."
  OUTPUT: "JIRA: {jiraId} → Done ✓"
```

## Step 5: Count Stats

```bash
git diff --stat HEAD~1 2>/dev/null | tail -1 || echo "0 files"
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
