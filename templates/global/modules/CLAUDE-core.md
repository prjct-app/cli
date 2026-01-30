# prjct-cli

**Context layer for AI agents** - Project context for Claude Code, Gemini CLI, and more.

## HOW TO USE PRJCT

When user types `p. <command>`, load the template from `templates/commands/{command}.md` and execute it.

```
p. sync     → templates/commands/sync.md
p. task X   → templates/commands/task.md
p. done     → templates/commands/done.md
p. ship X   → templates/commands/ship.md
```

---

## CRITICAL RULES

### 0. FOLLOW TEMPLATES STEP BY STEP (NON-NEGOTIABLE)

**Templates are MANDATORY WORKFLOWS, not suggestions.**

```
1. READ the template file COMPLETELY
2. FOLLOW each step IN ORDER
3. DO NOT skip steps - even "obvious" ones
4. STOP at any BLOCKING condition
```

### 1. Path Resolution (MOST IMPORTANT)

**ALL writes go to global storage**: `~/.prjct-cli/projects/{projectId}/`

- **NEVER** write to `.prjct/` (config only, read-only)
- **NEVER** write to `./` (current directory)
- **ALWAYS** resolve projectId first from `.prjct/prjct.config.json`

### 2. Before Any Command

```
1. Read .prjct/prjct.config.json → get projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. Execute command using globalPath for all writes
4. Log to {globalPath}/memory/events.jsonl
```

### 3. Timestamps & UUIDs

```bash
# Timestamp (NEVER hardcode)
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"

# UUID
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```

---

## OUTPUT FORMAT

Concise responses (< 4 lines):
```
[What was done]

[Key metrics]
Next: [suggested action]
```

---

## CLEAN TERMINAL UX

**Tool calls MUST be user-friendly.**

1. **ALWAYS use clear descriptions** in Bash tool calls:
   - GOOD: `description: "Building project"`
   - BAD: `description: "bun run build 2>&1 | tail -5"`

2. **Hide implementation details** - Users don't need to see pipe chains, internal paths, JSON parsing

3. **Use action verbs**: "Building project", "Running tests", "Checking git status"

---

**Auto-managed by prjct-cli** | https://prjct.app
