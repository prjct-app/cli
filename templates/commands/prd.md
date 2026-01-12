---
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion, Task]
description: 'Create a PRD using the Chief Architect agent'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/prds.json'
claude-context: 'context/prd.md'
subagent: 'chief-architect'
---

# /p:prd - Create Product Requirement Document

**Purpose**: Create a formal PRD for a feature using the Chief Architect agent.

**This command INVOKES the Chief Architect subagent** which follows an 8-phase methodology to create comprehensive PRDs.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{title}`: PRD title from arguments
- `{timestamp}`: Current timestamp (GetTimestamp())

---

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

---

## Step 2: Check for Existing PRD

READ: `{globalPath}/storage/prds.json`

IF file exists:
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

## Step 3: Initialize PRD Storage (if needed)

IF `{globalPath}/storage/prds.json` does NOT exist:
  CREATE empty prds.json:
  ```json
  {
    "prds": [],
    "lastUpdated": "{timestamp}"
  }
  ```

---

## Step 4: Load Chief Architect Agent

READ: `templates/subagents/workflow/chief-architect.md`

**CRITICAL**: The Chief Architect agent handles the PRD creation process.
Follow its methodology based on the feature size.

---

## Step 5: Execute Chief Architect Methodology

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
6. **Save** - Write to prds.json

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

## Step 6: Save PRD

After Chief Architect completes:

### 6.1 Generate IDs

```bash
# Generate PRD ID
bun -e "console.log('prd_' + crypto.randomUUID().slice(0,8))" 2>/dev/null || node -e "console.log('prd_' + require('crypto').randomUUID().slice(0,8))"

# Generate timestamp
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```

### 6.2 Write to Storage

READ: `{globalPath}/storage/prds.json`
ADD new PRD to `prds` array
UPDATE `lastUpdated`
WRITE: `{globalPath}/storage/prds.json`

### 6.3 Generate Context

WRITE: `{globalPath}/context/prd.md`

```markdown
# PRD: {title}

**ID:** {prd_id}
**Status:** Draft
**Size:** {size}
**Created:** {timestamp}
**Estimated:** {estimatedHours}h

---

## Problem Statement

{problem.statement}

**Target User:** {problem.targetUser}
**Impact:** {problem.impact}
**Frequency:** {problem.frequency}

### Pain Points
{FOR EACH problem.painPoints}
- {painPoint}
{END FOR}

---

## Success Criteria

### Metrics

| Metric | Baseline | Target | Unit |
|--------|----------|--------|------|
{FOR EACH successCriteria.metrics}
| {metric.name} | {metric.baseline || 'N/A'} | {metric.target} | {metric.unit} |
{END FOR}

### Acceptance Criteria

{FOR EACH successCriteria.acceptanceCriteria}
- [ ] {ac}
{END FOR}

---

## Estimation

| Area | Hours |
|------|-------|
{FOR EACH estimation.breakdown}
| {area} | {hours} |
{END FOR}
| **Total** | **{estimation.estimatedHours}** |

**Confidence:** {estimation.confidence}

---

## MVP Scope

### P0 - Must Have
{FOR EACH roadmap.mvp.p0}
- {item}
{END FOR}

### P1 - Should Have
{FOR EACH roadmap.mvp.p1}
- {item}
{END FOR}

### P2 - Nice to Have
{FOR EACH roadmap.mvp.p2}
- {item}
{END FOR}

---

## Risks

{FOR EACH roadmap.risks}
### {risk.type}: {risk.description}
- **Probability:** {risk.probability}
- **Impact:** {risk.impact}
- **Mitigation:** {risk.mitigation}
{END FOR}

---

## Next Steps

1. Review this PRD
2. Run `p. plan` to add to roadmap
3. Run `p. task "{title}"` to start implementation
```

### 6.4 Log to Memory

APPEND to: `{globalPath}/memory/events.jsonl`

```json
{"ts":"{timestamp}","action":"prd_created","prdId":"{prd_id}","title":"{title}","size":"{size}","estimatedHours":{hours},"phases":{phasesExecuted}}
```

---

## Step 7: Link to Roadmap (Optional)

ASK: "Do you want to add this PRD to the roadmap now?"
[A] Yes - run /p:plan
[B] No - keep as draft

IF [A]:
  READ: `{globalPath}/storage/roadmap.json`

  ADD feature entry:
  ```json
  {
    "id": "feat_{uuid8}",
    "name": "{title}",
    "status": "planned",
    "prdId": "{prd_id}",
    "legacy": false,
    "impact": "{problem.impact}",
    "progress": 0,
    "tasks": [],
    "createdAt": "{timestamp}"
  }
  ```

  UPDATE PRD with featureId link
  WRITE both files

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

📄 Full PRD: `{globalPath}/context/prd.md`

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

The enforcement level is read from `prjct.config.json`:

```json
{
  "orchestration": {
    "prdRequired": "standard"  // strict | standard | relaxed | off
  }
}
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
