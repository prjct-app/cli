---
allowed-tools: [Read, Write, Bash]
description: 'Log architectural or important decisions'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:decision - Log Important Decisions

## Architecture: MD-First

**Source of Truth**: `planning/decisions.md`

MD files are the source of truth. Write directly to MD files.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{decisionsPath}`: `{globalPath}/planning/decisions.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{decision}`: User-provided decision (required)
- `{reasoning}`: User-provided reasoning (optional)
- `{alternatives}`: User-provided alternatives considered (optional)

## Decision Format

Capture WHY decisions were made to avoid repeating mistakes:

```
/p:decision "Use REST instead of GraphQL"
  --reason "Simpler for this use case, team familiarity"
  --alternatives "GraphQL, gRPC"
```

Or interactive prompt:
```
Decision: Use REST instead of GraphQL

Why did you make this decision?
> Simpler for this use case, team familiarity

What alternatives did you consider?
> GraphQL, gRPC
```

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Validate Input

IF {decision} is empty:
  ASK: "What decision did you make?"
  SET: {decision} = user response

IF {reasoning} is empty:
  ASK: "Why did you make this decision?"
  SET: {reasoning} = user response

IF {alternatives} is empty:
  ASK: "What alternatives did you consider? (optional, press Enter to skip)"
  SET: {alternatives} = user response OR "none documented"

## Step 3: Generate Decision Entry

GENERATE: {decisionId} = "dec_" + 8 random alphanumeric chars
SET: {now} = GetTimestamp()

## Step 4: Read/Create Decisions File

READ: `{decisionsPath}` (or create default if not exists)

Default structure:
```markdown
# Decisions

Architecture decisions and their reasoning.

## Recent

_No decisions logged yet_

## Archive

_No archived decisions_
```

## Step 5: Update Decisions File (MD)

Parse existing content and add new decision under "## Recent" section:

```markdown
# Decisions

Architecture decisions and their reasoning.

## Recent

### {decision}
- **ID**: {decisionId}
- **Date**: {now}
- **Reasoning**: {reasoning}
- **Alternatives**: {alternatives}
- **Context**: {current task from now.md if active}

{...existing recent decisions}

## Archive

{...existing archive}
```

WRITE: `{decisionsPath}`

## Step 6: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{now}","action":"decision_logged","decisionId":"{decisionId}","decision":"{decision}","reasoning":"{reasoning}","alternatives":"{alternatives}"}
```

## Output

SUCCESS:
```
📝 Decision logged: {decision}

ID: {decisionId}
Reasoning: {reasoning}
Alternatives: {alternatives}

Next:
• Continue working on your task
• /p:recap - Review decisions made
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No decision provided | Ask for decision | WAIT |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Full Decision with All Fields
**Input:** `/p:decision "Use Zustand for state management" --reason "Lighter than Redux, better DX" --alternatives "Redux, MobX, Jotai"`

**Output:**
```
📝 Decision logged: Use Zustand for state management

ID: dec_abc12345
Reasoning: Lighter than Redux, better DX
Alternatives: Redux, MobX, Jotai

Next: Continue working | /p:recap
```

### Example 2: Interactive Mode
**Input:** `/p:decision`

**Prompt flow:**
```
What decision did you make?
> Use PostgreSQL instead of MongoDB

Why did you make this decision?
> Need relational data with joins, better ACID compliance

What alternatives did you consider? (Enter to skip)
> MongoDB, SQLite
```

**Output:**
```
📝 Decision logged: Use PostgreSQL instead of MongoDB

ID: dec_xyz98765
Reasoning: Need relational data with joins, better ACID compliance
Alternatives: MongoDB, SQLite

Next: Continue working | /p:recap
```

### Example 3: Quick Decision (minimal)
**Input:** `/p:decision "Skip tests for MVP"`

**Prompt:**
```
Why did you make this decision?
> Time constraint, will add before launch
```

**Output:**
```
📝 Decision logged: Skip tests for MVP

ID: dec_qrs45678
Reasoning: Time constraint, will add before launch
Alternatives: none documented

Next: Continue working | /p:recap
```

## Use Cases

When to log a decision:
- Choosing between technologies/libraries
- Architectural pattern selection
- Trade-off decisions (speed vs quality)
- Deviation from best practices (and why)
- Postponing technical debt intentionally

This creates institutional memory to avoid:
- Repeating the same debates
- Forgetting why something was done a certain way
- Making inconsistent choices across the codebase
