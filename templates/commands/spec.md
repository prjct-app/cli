---
allowed-tools: [Read, Write, Glob, GetTimestamp, GetDate]
description: 'Spec-driven development for complex features'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
think-triggers: [explore_to_edit, complex_analysis]
---

# /p:spec

Spec-Driven Development. Creates detailed specifications for complex features before implementation.

## Think First
Before creating spec, analyze:
1. Is this feature complex enough for a spec? (auth, payments, migrations = yes)
2. What are the key architectural decisions to make?
3. Are there multiple valid approaches? Document tradeoffs.
4. What questions should I ask the user before proceeding?

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
3. Write: `planning/specs/{slug}.md`
4. Ask: User approval
5. On approve: Add tasks to queue, start first
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

## Validation

- Feature name required for creation
- Spec must have at least 1 requirement
- Each task should be 20-30 minutes
- Check for existing spec with same name

## Data

Session: `{"ts":"{GetTimestamp()}","type":"spec_create","name":"{feature}","requirements":{n},"tasks":{n},"effort":"{Xh}"}`
Spec file: `planning/specs/{feature-slug}.md`

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
