---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. workflow "$ARGUMENTS"

Manage workflow preferences using natural language.

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

---

## If NO argument provided

Show current workflow preferences:

READ `{globalPath}/config/workflow-preferences.json` (or empty object)

**When preferences exist:**
```
WORKFLOW PREFERENCES
────────────────────────────
  [permanent] before ship    → bun test
  [session]   after done     → npm run docs

Modify: "p. workflow before ship run npm test"
Remove: "p. workflow remove ship hook"
```

**When no preferences:**
```
No workflow preferences configured.

Set one: "p. workflow before ship run tests"
```

---

## If argument provided (natural language)

Parse the user's intent and update preferences accordingly.

### Patterns to detect:

| Pattern | Hook | Command | Action |
|---------|------|---------|--------|
| "before ship run X" | before | ship | X |
| "after done run X" | after | done | X |
| "skip tests on ship" | skip | ship | tests |
| "remove ship hook" | * | ship | REMOVE |

### Flow:

1. **Detect intent** from natural language

2. **Ask for scope** (ALWAYS):

```
AskUserQuestion:
  question: "When should this apply?"
  header: "Scope"
  options:
    - label: "Always (Recommended)"
      description: "Save permanently in your preferences"
    - label: "This session only"
      description: "Until you close the terminal"
    - label: "Just the next command"
      description: "Use once and discard"
```

3. **Save preference**:

READ `{globalPath}/config/workflow-preferences.json` (or create empty object)

For adding/updating:
```json
{
  "preferences": [
    {
      "hook": "{before|after|skip}",
      "command": "{task|done|ship|sync}",
      "action": "{command to run}",
      "scope": "{permanent|session|once}",
      "createdAt": "{timestamp}"
    }
  ]
}
```

WRITE `{globalPath}/config/workflow-preferences.json`

For removal:
- Filter out preferences matching the hook and command
- Write updated file

4. **Confirm**:

```
IF scope == 'permanent':
  OUTPUT: "Saved. Before each {command} I'll run: {action}"
ELSE IF scope == 'session':
  OUTPUT: "OK. During this session, before {command} I'll run: {action}"
ELSE:
  OUTPUT: "OK. On the next {command} I'll run: {action}"
```

---

## Examples

### Setting a hook

```
User: "p. workflow before ship run bun test"

→ Detect: hook=before, command=ship, action="bun test"
→ Ask scope
→ User: "always"
→ Save preference
→ Output: "Saved. Before each ship I'll run: bun test"
```

### Removing a hook

```
User: "p. workflow remove ship hook"

→ Detect: REMOVE for ship
→ Remove all hooks for ship command
→ Output: "Removed. Ship hooks are no longer active."
```

### Skipping a step

```
User: "p. workflow skip lint on ship"

→ Detect: hook=skip, command=ship, action="lint"
→ Ask scope
→ User: "just this once"
→ Save preference with scope=once
→ Output: "OK. On the next ship, lint will be skipped."
```
