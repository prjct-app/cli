---
allowed-tools: [Bash, AskUserQuestion]
---

# p. workflow $ARGUMENTS

## Step 1: Parse intent

If $ARGUMENTS is empty, show current rules:
```bash
prjct workflow --md
```

**If $ARGUMENTS contains natural language, DO NOT pass it raw to the CLI.**
The CLI only accepts structured args — you must parse the intent yourself first.

Parse:
- **Action**: add / remove / list / create / delete / reset
- **Command**: the shell command to run (infer from description)
- **Position**: `before` or `after` (from words like "after", "después de", "before", "antes de")
- **Workflow**: `task` / `done` / `ship` / `sync` (infer from context)

**Inference examples**:
| Natural language | → | Structured |
|---|---|---|
| "después del merge revisa npm" | → | `add "npm view prjct-cli version" after ship` |
| "after ship check npm version" | → | `add "npm view prjct-cli version" after ship` |
| "before task run tests" | → | `add "npm test" before task` |
| "check lint before ship" | → | `add "npm run lint" before ship` |
| "after done show git log" | → | `add "git log --oneline -5" after done` |

If any of the three values (command, position, workflow) is ambiguous → ASK before running.

## Step 2: Execute

### Add a rule
```bash
prjct workflow add "$COMMAND" $POSITION $WORKFLOW --md
```

### List rules
```bash
prjct workflow list --md
```

### Remove a rule
```bash
prjct workflow rm $RULE_ID --md
```

### Create custom workflow
```bash
prjct workflow create "$NAME" "$DESCRIPTION" --md
```

### Delete custom workflow
```bash
prjct workflow delete "$NAME" --md
```

## Step 3: Confirm destructive actions

For `reset` (removes all rules): ASK "Remove all workflow rules?" Yes / Cancel

For `remove` with multiple matches: show matches and ASK which one to remove.

## Step 4: Present result

Show the CLI markdown output to the user.
