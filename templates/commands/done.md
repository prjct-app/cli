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

## Step 3: Handoff context
Summarize what was done and what the next subtask needs to know.

## Step 4: Follow CLI next steps → Ship
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
