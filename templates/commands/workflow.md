---
allowed-tools: [Bash, AskUserQuestion]
---

# p. workflow $ARGUMENTS

## Step 1: Parse intent via CLI

If $ARGUMENTS is empty, show current rules:
```bash
prjct workflow --md
```
Follow the CLI output.

If $ARGUMENTS is provided, delegate to CLI intent detection:
```bash
prjct workflow "$ARGUMENTS" --md
```

## Step 2: Handle workflow lifecycle

### Creating Custom Workflows

If user wants to CREATE a workflow:
1. Ask for workflow name (lowercase, alphanumeric + hyphens, e.g., "qa", "deploy-prod")
2. Ask for description (brief explanation of what the workflow does)
3. Execute:
```bash
prjct workflow create "$NAME" "$DESCRIPTION" --md
```

### Listing Workflows

If user wants to LIST workflows:
```bash
prjct workflow list --md
```
Shows both built-in (task, done, ship, sync) and custom workflows.

### Deleting Workflows

If user wants to DELETE a workflow:
1. Confirm (built-in workflows cannot be deleted)
2. Execute:
```bash
prjct workflow delete "$NAME" --md
```

## Step 3: Handle incomplete intents

If the CLI output indicates missing information (e.g., add without a command, position, or action):

ASK the user to clarify:
- **Adding a rule**: What shell command? Which workflow? Before or after?
- **Removing/disabling**: Which rule ID? (Show the matches from CLI output)
- **Gate**: Which workflow to gate? What check must pass?
- **Creating workflow**: What name? What description?

Then re-run with complete arguments:
```bash
prjct workflow add "$ACTION" $POSITION $COMMAND --md
```

## Step 4: Confirm destructive actions

For `reset` (removes all rules), ASK: "Remove all workflow rules?" Yes / Cancel

For `remove` or `disable` with search results showing multiple matches, present the matches and ASK which one to act on, then execute:
```bash
prjct workflow rm $RULE_ID --md
```

## Step 5: Follow CLI output

Present the final result from CLI markdown. The CLI supports bilingual natural language (English/Spanish) -- pass user input as-is.
