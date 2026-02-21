---
allowed-tools: [Bash, Read, AskUserQuestion]
---

# p. done

## Step 1: Complete via CLI
```bash
prjct done --md
```
If CLI output is JSON with `options`, present the options to the user and execute the chosen command.

## Step 2: Verify completion
- Review files changed: `git diff --name-only HEAD`
- Ensure work is complete and tested

## Step 3: Pattern compliance check

If a Pattern Commitment table was created during the "Pattern commitment" step of the task workflow, review each committed pattern against the actual changes:

| Pattern | Status | Evidence |
|---------|--------|----------|
| (name) | FOLLOWED | `path/file.ts:line` — used correct abstraction |
| (name) | VIOLATED | reason — e.g., needed `use client` for interactivity |

Report any VIOLATED pattern with a clear reason. The user decides whether to accept the violation.

If no commitment table exists (e.g., project not synced, or patterns were empty), skip this step.

## Step 4: Handoff context
Summarize what was done and what the next subtask needs to know.

## Step 5: Follow CLI next steps → Ship
After completing, you MUST ask:
ASK: "Subtask done. Ready to ship or continue to next subtask?"
- Ship now → execute `p. ship` workflow (load and follow `~/.claude/commands/p/ship.md`)
- Next subtask → continue working
- Pause → execute `p. pause`

## Presentation
Format your completion summary as:

1. `**Subtask complete**: {what was done}`
2. Brief summary of changes (2-3 lines max)
3. If next subtask exists, preview what's next
4. Show next commands as a table
