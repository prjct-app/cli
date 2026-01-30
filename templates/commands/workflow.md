---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. workflow

Manage workflow preferences using natural language.

```bash
prjct context workflow
```

---

## If NO argument provided

Show current workflow preferences:

```typescript
IMPORT: { listWorkflowPreferences, formatWorkflowPreferences } from core/workflow/workflow-preferences
CALL: preferences = listWorkflowPreferences(projectId)
OUTPUT: formatWorkflowPreferences(preferences)
```

---

## If argument provided (natural language)

Parse the user's intent and update preferences accordingly.

### Patterns to detect:

| Pattern | Hook | Command | Action |
|---------|------|---------|--------|
| "antes de ship corre X" | before | ship | X |
| "before ship run X" | before | ship | X |
| "después de done X" | after | done | X |
| "after done run X" | after | done | X |
| "no quiero X en ship" | skip | ship | true |
| "skip tests on ship" | skip | ship | true |
| "quita el hook de ship" | * | ship | REMOVE |
| "remove ship hook" | * | ship | REMOVE |

### Flow:

1. **Detect intent** from natural language
2. **Ask for scope** (ALWAYS):

```
AskUserQuestion:
  question: "¿Cuándo quieres que aplique esto?"
  header: "Scope"
  options:
    - label: "Siempre (Recommended)"
      description: "Guardo en tus preferencias permanentemente"
    - label: "Solo esta sesión"
      description: "Hasta que cierres la terminal"
    - label: "Solo el próximo comando"
      description: "Se usa una vez y se elimina"
```

3. **Apply preference**:

```typescript
IMPORT: { setWorkflowPreference, removeWorkflowPreference } from core/workflow/workflow-preferences

// For adding/updating
CALL: setWorkflowPreference(projectId, {
  hook: detected.hook,      // 'before' | 'after' | 'skip'
  command: detected.command, // 'task' | 'done' | 'ship' | 'sync'
  action: detected.action,   // command to run or 'true' for skip
  scope: userChoice,         // 'permanent' | 'session' | 'once'
  createdAt: new Date().toISOString()
})

// For removal
CALL: removeWorkflowPreference(projectId, hook, command)
```

4. **Confirm**:

```
IF scope == 'permanent':
  OUTPUT: "Guardado. Antes de cada {command} correré: {action}"
ELSE IF scope == 'session':
  OUTPUT: "OK. Durante esta sesión, antes de {command} correré: {action}"
ELSE:
  OUTPUT: "OK. En el próximo {command} correré: {action}"
```

---

## Examples

### Setting a hook

```
User: "p. workflow antes de ship corre bun test"

→ Detect: hook=before, command=ship, action="bun test"
→ Ask scope
→ User: "siempre"
→ Save: setWorkflowPreference(projectId, { hook: 'before', command: 'ship', action: 'bun test', scope: 'permanent', ... })
→ Output: "Guardado. Antes de cada ship correré: bun test"
```

### Removing a hook

```
User: "p. workflow quita el hook de ship"

→ Detect: REMOVE for ship
→ Remove: removeWorkflowPreference(projectId, 'before', 'ship')
→ Remove: removeWorkflowPreference(projectId, 'after', 'ship')
→ Output: "Eliminado. Los hooks de ship ya no están activos."
```

### Skipping a step

```
User: "p. workflow no corras lint en ship"

→ Detect: hook=skip, command=ship (interpreted as skip lint step)
→ Ask scope
→ User: "solo ahora"
→ Save: setWorkflowPreference(projectId, { hook: 'skip', command: 'ship', action: 'lint', scope: 'once', ... })
→ Output: "OK. En el próximo ship se saltará el lint."
```

---

## Output Format

**When showing preferences**:
```
WORKFLOW PREFERENCES
────────────────────────────
  [permanent] before ship    → bun test
  [session]   after done     → npm run docs

Modify: "p. workflow antes de ship corre npm test"
Remove: "p. workflow quita el hook de ship"
```

**When no preferences**:
```
No workflow preferences configured.

Set one: "p. workflow antes de ship corre los tests"
```
