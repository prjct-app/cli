---
allowed-tools: [Read, Bash]
---

# p. learnings

Show what the system has auto-learned from completed tasks.

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read Data Sources

READ:
- `{globalPath}/storage/state.json` → get taskHistory array
- `{globalPath}/memory/memories.json` → get auto-learned memories

## Step 3: Extract Patterns

From `state.json.taskHistory`, extract and count:

**File Co-change Patterns:**
- Look at `subtaskSummaries[].filesChanged` across tasks
- Find file pairs that change together in 2+ tasks

**Tech Stack Confirmations:**
- From `taskHistory[].feedback.stackConfirmed`
- Count occurrences of each confirmed stack item

**Architecture Patterns:**
- From `taskHistory[].feedback.patternsDiscovered`
- Count occurrences of each pattern

**Known Gotchas:**
- From `taskHistory[].feedback.issuesEncountered`
- Issues seen 2+ times are "known gotchas"

## Step 4: Display Auto-Learned Memories

From `memories.json`, filter memories where:
- `title` starts with `[auto-learned]`
- `content` contains `source: auto-learned`

## Output

```
📚 LEARNINGS

## Auto-Learned Patterns ({count} total)

### High Confidence (3+ occurrences)
- ✅ {pattern} ({occurrences}x)
- ✅ {pattern} ({occurrences}x)

### Medium Confidence (2 occurrences)
- 🔵 {pattern} ({occurrences}x)

### Low Confidence (1 occurrence)
- ⚪ {pattern} ({occurrences}x)

## Injected Memories ({count})
{For each auto-learned memory:}
- [{category}] {title} — {confidence}

## Stats
- Tasks analyzed: {taskHistory.length}
- Patterns extracted: {count}
- Memories auto-created: {count}
- Confidence threshold: 3+ occurrences

Next:
- Sync to refresh → `p. sync`
- Start new task → `p. task "description"`
```
