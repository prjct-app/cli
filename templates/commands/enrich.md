---
allowed-tools: [Read, Write, Bash, Task, AskUserQuestion]
---

# p. enrich "$ARGUMENTS"

Transform vague tickets into technical PRDs with AI-powered analysis.

## How This Works

User types `p. enrich PRJ-123` → Claude fetches ticket → Analyzes codebase → Generates PRD → Publishes back

**Examples**:
- `p. enrich PRJ-123` → Enrich Linear issue
- `p. enrich "vague description"` → Analyze without fetching

---

## CRITICAL - Execution Pattern

**NEVER use MCP tools** (`mcp__linear__*`, `mcp__jira__*`).
**ALWAYS use SDK via CLI helper.**

### CLI Helper for Linear

```bash
PRJCT_CLI=$(npm root -g)/prjct-cli
PROJECT_ID=$(cat .prjct/prjct.config.json | jq -r '.projectId')

# Fetch issue
ISSUE=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID get PRJ-123)

# Update description with PRD
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID update PRJ-123 '{"description":"..."}'

# Or add as comment
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID comment PRJ-123 "## PRD\n..."
```

---

## Step 1: Parse Input

Detect input format:
- `PRJ-123` → Linear issue (team key prefix)
- `"text"` → No fetch, analyze text directly

---

## Step 2: Fetch Ticket

```bash
# For Linear
ISSUE=$(bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID get "$IDENTIFIER")
```

Extract: `id`, `title`, `description`, `status`, `priority`

---

## Step 3: Analyze Codebase

```
USE Task(Explore) "very thorough":
- Find similar implementations
- Identify affected files
- Assess risks and dependencies

READ agents/*.md for domain patterns
```

---

## Step 4: Classify & Estimate

**Type**: Bug | Story | Improvement | Spike | Chore

**Story Points**:
| Points | Complexity |
|--------|------------|
| 1-2 | Trivial - single file, obvious fix |
| 3-5 | Small - few files, clear scope |
| 8 | Medium - multiple files, some unknowns |
| 13 | Large - significant changes, needs design |
| 21+ | Epic - break down further |

---

## Step 5: Generate PRD

```markdown
## Overview
{1-2 sentence summary of the technical approach}

## Classification
- **Type**: {type}
- **Points**: {points}
- **Risk**: Low/Medium/High

## Technical Approach
{Detailed implementation plan}

## Files to Modify
- `path/to/file.ts` - {what changes}
- ...

## Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}
- ...

## LLM Prompt
{Copy-paste ready prompt for any AI tool to implement this}
```

---

## Step 6: Ask Publication Method

```
ASK: "How should I publish the PRD?"
OPTIONS:
  - "Update description" (replace existing)
  - "Add as comment" (preserve original)
  - "Just show me" (don't publish)
```

---

## Step 7: Publish

```bash
# Update description
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID update PRJ-123 '{"description":"# PRD\n..."}'

# Or add comment
bun $PRJCT_CLI/core/cli/linear.ts --project $PROJECT_ID comment PRJ-123 "## PRD\n..."
```

---

## Step 8: Save Locally

```bash
WRITE: {globalPath}/storage/enriched/{id}.json
```

```json
{
  "id": "PRJ-123",
  "enrichedAt": "2026-01-29T...",
  "type": "story",
  "points": 5,
  "filesAffected": ["src/auth.ts", "src/login.tsx"],
  "prd": "..."
}
```

---

## Output

```
✅ Enriched: PRJ-123 - {title}

Type: Story | Points: 5 | Files: 3

Published: Updated description

Next:
- Start work? → `p. linear start 123` or `p. task "PRJ-123"`
- Enrich another? → `p. enrich PRJ-124`
- See backlog → `p. linear`
```
