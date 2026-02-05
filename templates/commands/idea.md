---
allowed-tools: [Read, Write, Bash]
---

# p. idea "$ARGUMENTS"

## Step 1: Validate Arguments

```
IF $ARGUMENTS is empty:
  ASK: "What's your idea?"
  WAIT for response
```

## Step 2: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 3: Detect Priority from Keywords

Analyze `$ARGUMENTS`:
- `urgent`, `critical`, `asap`, `important` → **high**
- `later`, `maybe`, `nice-to-have`, `someday` → **low**
- default → **medium**

## Step 4: Extract Tags

Look for hashtags in text: `#ui`, `#perf`, `#bug`, `#api`, `#security`, `#docs`, `#feature`

Or detect from context:
- UI/UX related words → `#ui`
- Performance related → `#perf`
- Security related → `#security`

## Step 5: Generate UUID and Timestamp

```bash
# UUID
node -e "console.log(require('crypto').randomUUID())"

# Timestamp
node -e "console.log(new Date().toISOString())"
```

## Step 6: Save Idea

READ `{globalPath}/storage/ideas.json` (or create empty array if doesn't exist)

APPEND new idea:
```json
{
  "id": "{uuid}",
  "text": "$ARGUMENTS",
  "priority": "{priority}",
  "tags": ["{tags}"],
  "status": "pending",
  "createdAt": "{timestamp}"
}
```

WRITE `{globalPath}/storage/ideas.json`

## Step 7: Log Event

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"idea_captured","ideaId":"{uuid}","text":"$ARGUMENTS","timestamp":"{timestamp}"}
```

---

## Output

```
💡 $ARGUMENTS

Priority: {priority}
Tags: {tags}

Next:
- Start work → `p. task "$ARGUMENTS"`
- See ideas → `p. dash`
```
