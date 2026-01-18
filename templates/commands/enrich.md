---
allowed-tools: [Read, Write, Bash, Task, AskUserQuestion]
---

# p. enrich "$ARGUMENTS"

```bash
prjct context enrich $ARGUMENTS
```

Parse input: `PRJ-123` (Linear/JIRA) | `#123` (GitHub) | quoted text (no fetch)

Fetch ticket via MCP tool for detected tracker

USE Task(Explore) "very thorough" → similar code, affected files, risks
READ `agents[].filePath` → patterns

Classify:
- Type: Bug|Story|Improvement|Spike|Chore
- Points: 1-2 (trivial) | 3-5 (small) | 8 (medium) | 13 (large) | 21+ (epic)

Generate PRD with: Overview, Classification, Files to modify, Acceptance criteria, LLM prompt

Ask: "Publish as comment?" | "Update description?" | "Just show"

Publish via MCP tool

WRITE `{globalPath}/storage/enriched/{id}.json`

**Output**:
```
✅ Enriched: {ID} - {title}

Type: {type} | Points: {points} | Files: {count}

Next:
- Start work? → `p. task "{title}"` or `p. {tracker} start {ID}`
- Enrich another? → `p. enrich {ID}`
- See backlog → `p. {tracker}`
```
