---
allowed-tools: [Read, Bash]
---

# p. learnings

Show what the system has auto-learned from completed tasks.

## Step 1: Get Learnings Data

```bash
# The CLI retrieves learnings from SQLite
prjct dash --json 2>/dev/null || echo '{"learnings":[]}'
```

## Step 2: Extract Patterns

From CLI output, extract and display:

**File Co-change Patterns:**
- File pairs that change together in 2+ tasks

**Tech Stack Confirmations:**
- Count occurrences of each confirmed stack item

**Architecture Patterns:**
- Count occurrences of each pattern

**Known Gotchas:**
- Issues seen 2+ times are "known gotchas"

## Step 3: Display Auto-Learned Memories

Filter memories where:
- `title` starts with `[auto-learned]`
- `content` contains `source: auto-learned`

## Output

```
LEARNINGS

## Auto-Learned Patterns ({count} total)

### High Confidence (3+ occurrences)
- {pattern} ({occurrences}x)
- {pattern} ({occurrences}x)

### Medium Confidence (2 occurrences)
- {pattern} ({occurrences}x)

### Low Confidence (1 occurrence)
- {pattern} ({occurrences}x)

## Injected Memories ({count})
{For each auto-learned memory:}
- [{category}] {title} — {confidence}

## Stats
- Tasks analyzed: {count}
- Patterns extracted: {count}
- Memories auto-created: {count}
- Confidence threshold: 3+ occurrences

Next:
- Sync to refresh → `p. sync`
- Start new task → `p. task "description"`
```
