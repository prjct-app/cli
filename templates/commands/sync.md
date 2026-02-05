---
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# p. sync

## Step 1: Run sync with JSON output

```bash
prjct sync --json
```

Parse the JSON output to determine next action.

## Step 2: Handle response

**If `action: "no_changes"`:**
```
Output: "✅ Context is up to date"
```

**If `action: "confirm_required"`:**

Show the diff summary to the user:

```
📋 Changes to context files:

+ Added: {list added sections}
~ Modified: {list modified sections}
- Removed: {list removed sections}

Tokens: {tokensBefore} → {tokensAfter} ({tokenDelta})
```

Then ask for confirmation:

```
AskUserQuestion:
  question: "Apply these context changes?"
  header: "Sync"
  options:
    - label: "Yes, apply changes"
      description: "Update context files with the changes shown above"
    - label: "No, cancel"
      description: "Keep existing context files unchanged"
    - label: "Show full diff"
      description: "See detailed before/after for each section"
```

## Step 3: Apply based on response

**If "Yes, apply changes":**
```bash
prjct sync --yes
```

**If "No, cancel":**
```
Output: "✅ Sync cancelled"
```

**If "Show full diff":**
- Run `prjct sync --preview --json` to get full diff details
- Display the full diff to user
- Ask again with Yes/No options only

## First sync (no existing files)

When there's no existing context, the CLI will apply changes directly:

```bash
prjct sync --json
```

This returns success without needing confirmation.

## Linear Sync (when enabled)

```
READ: .prjct/prjct.config.json → get projectId
READ: {globalPath}/project.json → check integrations.linear.enabled

IF integrations.linear.enabled:
  # Sync Linear issues to local cache
  RUN: bun $PRJCT_CLI/core/cli/linear.ts --project {projectId} sync

  # Result stored in {globalPath}/storage/issues.json
  OUTPUT: "Linear: {fetched} issues synced"
```

## Output

```
✅ Synced: {projectName}

Ecosystem: {ecosystem}
Agents: {count} generated
Linear: {issueCount} issues synced (or "not enabled")

Next:
- Start work → `p. task "description"`
- See queue → `p. next`
```
