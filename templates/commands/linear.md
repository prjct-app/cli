---
allowed-tools: [Bash, AskUserQuestion]
---

# p. linear $ARGUMENTS

## Parse Intent

Understand what the user wants:
- "actualiza el status de 273" → update PRJ-273 status
- "mark 303 as done" → mark PRJ-303 as done
- "get 273" → fetch issue
- "list" → list issues
- "setup" → configure

## Execute

**For status updates** (actualiza, cambiar, update status):
1. Extract issue ID (e.g., "273" → "PRJ-273")
2. Ask user: "What status do you want for PRJ-273? (In Progress, Done, Todo, Canceled)"
3. Map response to Linear state:
   - "In Progress" / "Doing" → use `prjct linear start PRJ-273`
   - "Done" / "Complete" → use `prjct linear done PRJ-273`
   - Other → use `prjct linear update PRJ-273 '{"stateId":"<state>"}'`

**For other commands:**
```bash
prjct linear $ARGUMENTS --md
```

Follow the CLI output.
