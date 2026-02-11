---
allowed-tools: [Read, Write, Glob, GetTimestamp, GetDate]
description: 'Spec-driven development for complex features'
think-triggers: [explore_to_edit, complex_analysis]
---

# /p:spec - Spec-Driven Development

Spec-Driven Development. Creates detailed specifications for complex features before implementation.

# All spec data is stored in SQLite via the CLI

## Think First

Before creating spec, analyze:
1. Is this feature complex enough for a spec? (auth, payments, migrations = yes)
2. What are the key architectural decisions to make?
3. Are there multiple valid approaches? Document tradeoffs.
4. What questions should I ask the user before proceeding?

## Context Variables
- Spec data is managed by the CLI in SQLite

## Purpose

For features that require:
- Clear requirements before coding
- Design decisions documented
- Tasks broken into 20-30 min chunks
- User approval before starting

## Flow

### No params: Show template
```
→ Interactive spec template
→ Ask for feature name
→ Guide through requirements
```

### With feature name: Create spec
```
/p:spec "Dark Mode"
1. Analyze: Context, patterns, dependencies
2. Propose: Requirements + Design + Tasks
3. Save: Via CLI to SQLite
4. Ask: User approval
5. On approve: Add tasks to queue via CLI, start first
```

## Spec Structure

```markdown
# Feature Spec: {name}

**Created**: {GetDate()}
**Status**: PENDING_APPROVAL | APPROVED | IN_PROGRESS | COMPLETED

## Requirements (User approves)
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## Design (Claude proposes)
- **Approach**: {architecture decision}
- **Key decisions**: {list}
- **Dependencies**: {existing code/libs}

## Tasks (20-30min each)
1. [ ] Task 1 (20m) - {description}
2. [ ] Task 2 (25m) - {description}
3. [ ] Task 3 (30m) - {description}

**Total**: {n} tasks, ~{Xh}

## Notes
- {implementation notes}
- {edge cases to consider}
```

## Storage

All spec data is persisted to SQLite by the CLI (`prjct spec`).
The CLI handles creating, listing, and updating specs.

## Validation

- Feature name required for creation
- Spec must have at least 1 requirement
- Each task should be 20-30 minutes
- Check for existing spec with same name

## Response

### On creation:
```
📋 Spec: {feature}

Requirements ({n}):
{numbered_list}

Design:
→ {approach}
→ {key_decision}

Tasks ({n}, ~{total_time}):
{numbered_list}

APPROVE? (y/n/edit)
```

### On approval:
```
✅ Spec approved: {feature}
→ {n} tasks added to queue
→ Starting: {task_1}

Use /p:done when complete
```

## Examples

```
/p:spec "User Authentication"
→ Creates spec with OAuth/JWT decisions
→ Breaks into: setup, login, logout, session, tests
→ Estimates ~4h total

/p:spec "Dark Mode"
→ Creates spec with theme approach
→ Breaks into: toggle, state, styles, persist, test
→ Estimates ~3h total
```

## Decision Logging (absorbed from /p:decision)

Specs now capture architectural decisions inline. When making design choices:

### Decision Format

```
/p:spec "API Design"

[During spec creation, capture decisions:]

Decision: Use REST instead of GraphQL
Reasoning: Simpler for this use case, team familiarity
Alternatives: GraphQL, gRPC
```

### Storage

Decisions are stored in the spec itself:
```json
{
  "id": "{specId}",
  "name": "{feature}",
  "decisions": [
    {
      "id": "{decisionId}",
      "decision": "Use REST instead of GraphQL",
      "reasoning": "Simpler for this use case",
      "alternatives": ["GraphQL", "gRPC"],
      "createdAt": "{timestamp}"
    }
  ]
}
```

### Response (with decisions)
```
📝 Decision logged: Use REST instead of GraphQL

ID: {decisionId}
Reasoning: Simpler for this use case
Alternatives: GraphQL, gRPC

This creates institutional memory to avoid:
- Repeating the same debates
- Forgetting why something was done a certain way
- Making inconsistent choices
```

## Natural Language Support

- "p. spec" → Interactive spec creation
- "p. spec dark mode" → Create spec for dark mode
- "p. design spec auth" → Create spec for auth
- "p. decision use postgres" → Log decision (now part of spec)
