---
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion, Task]
description: 'Create a PRD using the Chief Architect agent'
subagent: 'chief-architect'
---

# /p:prd - Create Product Requirement Document

**Purpose**: Create a formal PRD for a feature using the Chief Architect agent.

**This command INVOKES the Chief Architect subagent** which follows an 8-phase methodology to create comprehensive PRDs.

## Context Variables

- `{title}`: PRD title from arguments
- `{timestamp}`: Current timestamp (GetTimestamp())

---

## Step 1: Validate Project

```bash
prjct status --json 2>/dev/null || echo "NO_PROJECT"
```

IF output contains "NO_PROJECT":
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

---

## Step 2: Check for Existing PRD

```bash
# Check existing PRDs via CLI (SQLite)
prjct prd list --json 2>/dev/null || echo '{"prds":[]}'
```

SEARCH for PRD with similar title (fuzzy match)

IF found:
  OUTPUT: "A PRD for '{similar title}' already exists (status: {status})"
  ASK: "Do you want to:"
  [A] Create a new PRD anyway
  [B] View existing PRD
  [C] Update existing PRD

  IF [B]: Show existing PRD and STOP
  IF [C]: Load existing PRD for editing

---

## Step 3: Load Chief Architect Agent

READ: `templates/subagents/workflow/chief-architect.md`

**CRITICAL**: The Chief Architect agent handles the PRD creation process.
Follow its methodology based on the feature size.

---

## Step 4: Execute Chief Architect Methodology

The Chief Architect will:

1. **Classify** - Determine if PRD is needed
2. **Size** - Ask user to estimate feature size (XS/S/M/L/XL)
3. **Execute Phases** - Based on size:
   - XS: Phases 1, 8 only
   - S: Phases 1, 2, 8
   - M: Phases 1-4, 8
   - L: Phases 1-6, 8
   - XL: All 8 phases
4. **Estimate** - Calculate effort
5. **Define Success** - Quantifiable metrics
6. **Save** - Persist to SQLite via CLI

### Phase Quick Reference

| Phase | Name | Output |
|-------|------|--------|
| 1 | Discovery & Problem Definition | problem statement, target user, pain points |
| 2 | User Flows & Journeys | entry points, happy path, error states |
| 3 | Domain Modeling | entities, relationships, business rules |
| 4 | API Contract Design | endpoints, auth, schemas |
| 5 | System Architecture | components, dependencies |
| 6 | Data Architecture | schema changes, migrations |
| 7 | Tech Stack Decision | dependencies, security, performance |
| 8 | Implementation Roadmap | MVP scope, phases, risks |

---

## Step 5: Save PRD

After Chief Architect completes:

### 5.1 Generate IDs

```bash
# Generate PRD ID
bun -e "console.log('prd_' + crypto.randomUUID().slice(0,8))" 2>/dev/null || node -e "console.log('prd_' + require('crypto').randomUUID().slice(0,8))"

# Generate timestamp
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```

### 5.2 Save via CLI

```bash
# The CLI saves the PRD to SQLite and generates context files
prjct prd save --json '{"id":"{prd_id}","title":"{title}","size":"{size}",...}'
```

# Events are logged automatically by the CLI

---

## Step 6: Link to Roadmap (Optional)

ASK: "Do you want to add this PRD to the roadmap now?"
[A] Yes - run /p:plan
[B] No - keep as draft

IF [A]:
  Run `p. plan add {prd_id}` to add the PRD to the roadmap.
  The CLI handles all SQLite persistence.

---

## Output Format

```
## PRD Created: {title}

**ID:** {prd_id}
**Status:** Draft
**Size:** {size} ({estimatedHours}h estimated)

### Problem
{problem.statement}

### Success Metrics
{FOR EACH metric}
- {metric.name}: {metric.baseline || '?'} → {metric.target} {metric.unit}
{END FOR}

### MVP Scope
- P0: {p0.length} must-have items
- P1: {p1.length} should-have items

### Risks
- {risks.length} identified ({high_risks.length} high priority)

---

Full PRD saved by CLI.

**Next Steps:**
1. Review the PRD
2. Run `p. plan` to add to roadmap
3. Run `p. task "{title}"` to start work
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No project | "Run /p:init first" |
| PRD exists | Offer to view/update |
| User cancels | "PRD creation cancelled" |
| Missing input | Re-ask question |

---

## Integration Notes

### For Linear/Jira/Monday

The PRD structure maps directly to PM tools:

| PRD Field | Linear | Jira | Monday |
|-----------|--------|------|--------|
| title | Project name | Epic summary | Board name |
| problem.statement | Description | Description | Description |
| estimation.tShirtSize | Estimate | Story Points | Time |
| successCriteria | Goals | Acceptance Criteria | Goals |
| featureId | Project ID | Epic Key | Board ID |

### Enforcement

The enforcement level is configured in the project settings:

```
Levels: strict | standard | relaxed | off
```

- **strict**: Block task creation without PRD
- **standard**: Warn but allow (default)
- **relaxed**: Suggest PRD, no warning
- **off**: No PRD checks

---

## Related Commands

| Command | Relationship |
|---------|--------------|
| `/p:task` | Checks for PRD, links to it |
| `/p:plan` | Uses PRDs to populate roadmap |
| `/p:feature` | Can trigger PRD creation |
| `/p:ship` | Links shipped feature to PRD |
| `/p:impact` | Compares outcomes to PRD metrics |
