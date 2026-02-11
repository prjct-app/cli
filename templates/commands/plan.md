---
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion, Task]
description: 'Quarter-based roadmap planning with PRD prioritization'
---

# p. plan - Roadmap Planning

**Purpose**: Plan and prioritize features across quarters with capacity management.

---

## Usage

```
p. plan                    # Show roadmap status and planning options
p. plan quarter            # Plan next quarter
p. plan prioritize         # Re-prioritize based on value/effort
p. plan add <prd-id>       # Add PRD to roadmap
p. plan capacity           # View/adjust quarter capacity
```

---

## Step 1: Validate Project

```bash
prjct status --json 2>/dev/null || echo "NO_PROJECT"
```

IF output contains "NO_PROJECT":
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

---

## Step 2: Load Data

```bash
# The CLI loads roadmap and PRD data from SQLite
prjct plan --json 2>/dev/null || echo '{"strategy":null,"features":[],"backlog":[],"quarters":[]}'
```

---

## Step 3: Route by Subcommand

### 3.1 Default (No subcommand) - Show Status

```
OUTPUT:
┌─────────────────────────────────────────────────────────────┐
│  ROADMAP STATUS                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  QUARTERS                                                    │
│  {FOR EACH quarter in roadmap.quarters:}                     │
│  ├─ {quarter.id}: {quarter.name}                            │
│  │   Status: {quarter.status}                                │
│  │   Theme: {quarter.theme || 'Not set'}                     │
│  │   Features: {quarter.features.length}                     │
│  │   Capacity: {quarter.capacity.allocatedHours}/{quarter.capacity.totalHours}h ({utilization}%)
│  {END FOR}                                                   │
│                                                              │
│  FEATURES BY STATUS                                          │
│  ├─ Planned: {features.filter(f => f.status == 'planned').length}
│  ├─ Active: {features.filter(f => f.status == 'active').length}
│  ├─ Completed: {features.filter(f => f.status == 'completed').length}
│  └─ Shipped: {features.filter(f => f.status == 'shipped').length}
│                                                              │
│  UNPLANNED PRDs                                              │
│  {FOR EACH prd in unplannedPRDs:}                            │
│  ├─ {prd.title} ({prd.size}, {prd.estimation.estimatedHours}h)
│  │   Priority Score: {calculatePriorityScore(prd)}           │
│  {END FOR}                                                   │
│                                                              │
│  BACKLOG                                                     │
│  └─ {roadmap.backlog.length} items                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Commands:
- p. plan quarter     → Plan next quarter
- p. plan prioritize  → Re-prioritize features
- p. plan add <id>    → Add PRD to roadmap
- p. plan capacity    → Manage capacity
```

---

### 3.2 Subcommand: quarter

Plan the next quarter by selecting from approved PRDs.

```
# Determine current/next quarter
SET: currentDate = new Date()
SET: currentQuarter = calculateQuarter(currentDate)
SET: nextQuarter = incrementQuarter(currentQuarter)

# Check if quarter exists
SET: existingQuarter = roadmap.quarters.find(q => q.id == nextQuarter.id)

IF existingQuarter:
  OUTPUT: "Quarter {nextQuarter.id} already exists."

  USE AskUserQuestion:
    question: "What would you like to do?"
    options:
      - label: "View quarter details"
        description: "See features and capacity"
      - label: "Modify quarter"
        description: "Add/remove features"
      - label: "Create new quarter"
        description: "Plan a different quarter"
ELSE:
  # Create new quarter
  OUTPUT: "Creating quarter: {nextQuarter.id}"
```

#### 3.2.1 Gather Quarter Details

```
USE AskUserQuestion:
  question: "What is the theme for {nextQuarter.id}?"
  options:
    - label: "Foundation"
      description: "Core infrastructure and stability"
    - label: "Growth"
      description: "User acquisition and engagement"
    - label: "Quality"
      description: "Bug fixes, performance, polish"
    - label: "Custom"
      description: "Enter custom theme"

SET: quarterTheme = selected option

USE AskUserQuestion:
  question: "Total capacity for {nextQuarter.id}? (hours)"
  options:
    - label: "160h"
      description: "1 person, full time"
    - label: "320h"
      description: "2 people, full time"
    - label: "480h"
      description: "3 people, full time"
    - label: "Custom"
      description: "Enter custom hours"

SET: totalCapacity = selected hours
SET: bufferPercent = 20  # Default 20% buffer for unknowns
SET: availableCapacity = totalCapacity * (1 - bufferPercent/100)
```

#### 3.2.2 Select Features for Quarter

```
# Get approved PRDs not yet planned (from CLI data)
SET: approvedPRDs = prds.filter(p =>
  p.status == 'approved' AND
  p.featureId == null
)

# Calculate priority scores
FOR EACH prd in approvedPRDs:
  SET: prd.priorityScore = calculatePriorityScore(prd)

# Sort by priority (highest first)
SORT: approvedPRDs by priorityScore DESC

OUTPUT:
"""
## Available PRDs for {nextQuarter.id}

Capacity: {availableCapacity}h available (after {bufferPercent}% buffer)

| Priority | PRD | Size | Hours | Value/Effort |
|----------|-----|------|-------|--------------|
{FOR EACH prd in approvedPRDs:}
| {index + 1} | {prd.title} | {prd.size} | {prd.estimation.estimatedHours}h | {prd.priorityScore.toFixed(2)} |
{END FOR}
"""

USE AskUserQuestion:
  question: "Select features for {nextQuarter.id}"
  multiSelect: true
  options:
    {FOR EACH prd in approvedPRDs (top 4):}
    - label: "{prd.title} ({prd.estimation.estimatedHours}h)"
      description: "Priority: {prd.priorityScore.toFixed(2)}, Impact: {prd.problem.impact}"
    {END FOR}

SET: selectedPRDs = selected options
SET: allocatedHours = sum of selected PRD hours

IF allocatedHours > availableCapacity:
  OUTPUT: "⚠️ Over capacity by {allocatedHours - availableCapacity}h"

  USE AskUserQuestion:
    question: "Over capacity. What would you like to do?"
    options:
      - label: "Remove lowest priority"
        description: "Auto-remove until within capacity"
      - label: "Proceed anyway"
        description: "Accept over-commitment"
      - label: "Re-select"
        description: "Choose again"
```

#### 3.2.3 Create Quarter and Features

```
SET: {timestamp} = GetTimestamp()

# Create quarter
SET: newQuarter = {
  "id": "{nextQuarter.id}",
  "name": "{nextQuarter.name}",
  "theme": "{quarterTheme}",
  "goals": [],
  "features": [],
  "capacity": {
    "totalHours": {totalCapacity},
    "allocatedHours": {allocatedHours},
    "bufferPercent": {bufferPercent}
  },
  "status": "planned",
  "startDate": "{nextQuarter.startDate}",
  "endDate": "{nextQuarter.endDate}"
}

# Create features from PRDs
FOR EACH prd in selectedPRDs:
  # Generate feature ID
  BASH: bun -e "console.log('feat_' + crypto.randomUUID().slice(0,8))" 2>/dev/null || node -e "console.log('feat_' + require('crypto').randomUUID().slice(0,8))"
  SET: featureId = result

  SET: newFeature = {
    "id": "{featureId}",
    "name": "{prd.title}",
    "description": "{prd.problem.statement}",
    "date": "{timestamp.split('T')[0]}",
    "status": "planned",
    "impact": "{prd.problem.impact}",
    "progress": 0,
    "tasks": [],
    "createdAt": "{timestamp}",

    # AI Orchestration fields
    "prdId": "{prd.id}",
    "legacy": false,
    "quarter": "{nextQuarter.id}",
    "effortTracking": {
      "estimated": {
        "hours": {prd.estimation.estimatedHours},
        "confidence": "{prd.estimation.confidence}",
        "breakdown": {prd.estimation.breakdown}
      },
      "actual": null
    },
    "valueScore": {calculateValueScore(prd)}
  }

  # Add to quarter
  PUSH: newQuarter.features ← featureId

  # Add to roadmap features
  PUSH: roadmap.features ← newFeature

  # Update PRD with feature link
  SET: prd.featureId = featureId
  SET: prd.quarter = nextQuarter.id
  SET: prd.status = "in_progress"

# Add quarter to roadmap
PUSH: roadmap.quarters ← newQuarter

# Update timestamps
SET: roadmap.lastUpdated = {timestamp}

# The CLI persists changes to SQLite automatically
```

---

### 3.3 Subcommand: prioritize

Re-calculate priority scores and suggest re-ordering.

```
# Get all planned features
SET: plannedFeatures = roadmap.features.filter(f => f.status == 'planned')

# Calculate/update priority scores
FOR EACH feature in plannedFeatures:
  IF feature.prdId:
    SET: prd = prds.find(p => p.id == feature.prdId)
    IF prd:
      SET: feature.valueScore = calculateValueScore(prd)
      SET: feature.priorityScore = calculatePriorityScore(prd)
    ELSE:
      # Fallback calculation
      SET: impactScore = { high: 3, medium: 2, low: 1 }[feature.impact]
      SET: estimatedHours = feature.effortTracking?.estimated?.hours || 8
      SET: feature.valueScore = impactScore * 3
      SET: feature.priorityScore = feature.valueScore / (estimatedHours / 10)
  ELSE:
    # Legacy feature - use impact-based calculation
    SET: impactScore = { high: 3, medium: 2, low: 1 }[feature.impact]
    SET: feature.valueScore = impactScore * 3
    SET: feature.priorityScore = feature.valueScore

# Sort by priority
SORT: plannedFeatures by priorityScore DESC

OUTPUT:
"""
## Prioritized Roadmap

| Rank | Feature | Quarter | Value | Effort | Priority |
|------|---------|---------|-------|--------|----------|
{FOR EACH feature in plannedFeatures:}
| {rank} | {feature.name} | {feature.quarter || 'Unassigned'} | {feature.valueScore} | {feature.effortTracking?.estimated?.hours || '?'}h | {feature.priorityScore?.toFixed(2) || 'N/A'} |
{END FOR}

Prioritization based on: Value Score / Effort (hours)

Value Score = (Business Impact + User Impact) × Strategic Alignment
"""

USE AskUserQuestion:
  question: "Would you like to re-order any features?"
  options:
    - label: "Accept order"
      description: "Keep current prioritization"
    - label: "Move feature up"
      description: "Increase priority manually"
    - label: "Move feature down"
      description: "Decrease priority manually"
```

---

### 3.4 Subcommand: add <prd-id>

Add a specific PRD to the roadmap.

```
SET: prdId = argument

# PRD data loaded from CLI in Step 2
SET: prd = prds.find(p => p.id == prdId)

IF NOT prd:
  OUTPUT: "PRD not found: {prdId}"
  STOP

IF prd.featureId:
  OUTPUT: "PRD already linked to feature: {prd.featureId}"
  STOP

# Ask which quarter
USE AskUserQuestion:
  question: "Which quarter should '{prd.title}' be added to?"
  options:
    {FOR EACH quarter in roadmap.quarters:}
    - label: "{quarter.id}"
      description: "{quarter.theme} - {quarter.capacity.allocatedHours}/{quarter.capacity.totalHours}h used"
    {END FOR}
    - label: "Backlog"
      description: "Add to backlog instead"

IF selected == "Backlog":
  # Add to backlog
  PUSH: roadmap.backlog ← {
    "id": "{prdId}",
    "title": "{prd.title}",
    "prdId": "{prdId}",
    "valueScore": {calculateValueScore(prd)},
    "effortEstimate": {prd.estimation.estimatedHours},
    "reason": "Not scheduled"
  }

  OUTPUT: "Added '{prd.title}' to backlog"
ELSE:
  # Create feature and add to quarter
  SET: selectedQuarter = selected quarter

  # Check capacity
  SET: newAllocation = selectedQuarter.capacity.allocatedHours + prd.estimation.estimatedHours

  IF newAllocation > selectedQuarter.capacity.totalHours:
    OUTPUT: "⚠️ Adding this feature exceeds {selectedQuarter.id} capacity"
    USE AskUserQuestion:
      question: "Proceed anyway?"
      options:
        - label: "Yes"
          description: "Accept over-commitment"
        - label: "No"
          description: "Cancel"

    IF selected == "No":
      STOP

  # Generate feature ID
  BASH: bun -e "console.log('feat_' + crypto.randomUUID().slice(0,8))" 2>/dev/null || node -e "console.log('feat_' + require('crypto').randomUUID().slice(0,8))"
  SET: featureId = result

  # Create feature (same as 3.2.3)
  ...

  OUTPUT: "Added '{prd.title}' to {selectedQuarter.id}"
```

---

### 3.5 Subcommand: capacity

View and adjust quarter capacity.

```
OUTPUT:
"""
## Quarter Capacity

{FOR EACH quarter in roadmap.quarters:}
### {quarter.id}: {quarter.name}

Status: {quarter.status}
Theme: {quarter.theme}

| Metric | Value |
|--------|-------|
| Total Capacity | {quarter.capacity.totalHours}h |
| Allocated | {quarter.capacity.allocatedHours}h |
| Buffer | {quarter.capacity.bufferPercent}% |
| Available | {availableHours}h |
| Utilization | {utilization}% |

Features ({quarter.features.length}):
{FOR EACH featureId in quarter.features:}
  SET: feature = roadmap.features.find(f => f.id == featureId)
- {feature.name}: {feature.effortTracking?.estimated?.hours || '?'}h
{END FOR}

{END FOR}
"""

USE AskUserQuestion:
  question: "What would you like to adjust?"
  options:
    - label: "Adjust total capacity"
      description: "Change quarter hours"
    - label: "Adjust buffer"
      description: "Change buffer percentage"
    - label: "Move feature"
      description: "Move feature to different quarter"
    - label: "Done"
      description: "Exit capacity management"
```

---

## Step 4: Persist Changes

# The CLI persists all changes to SQLite and generates context files automatically
# Events are logged automatically by the CLI

---

## Helper Functions

### calculateQuarter(date)
```javascript
const month = date.getMonth()
const year = date.getFullYear()
const quarter = Math.floor(month / 3) + 1
return {
  id: `Q${quarter}-${year}`,
  name: `Q${quarter} ${year}`,
  startDate: new Date(year, (quarter - 1) * 3, 1).toISOString(),
  endDate: new Date(year, quarter * 3, 0).toISOString()
}
```

### incrementQuarter(quarter)
```javascript
const [q, year] = quarter.id.split('-')
const quarterNum = parseInt(q.slice(1))
if (quarterNum === 4) {
  return { id: `Q1-${parseInt(year) + 1}`, name: `Q1 ${parseInt(year) + 1}` }
}
return { id: `Q${quarterNum + 1}-${year}`, name: `Q${quarterNum + 1} ${year}` }
```

### calculateValueScore(prd)
```javascript
const impactScore = { critical: 4, high: 3, medium: 2, low: 1 }
const businessImpact = prd.value?.businessImpact
  ? impactScore[prd.value.businessImpact]
  : impactScore[prd.problem.impact]
const userImpact = prd.value?.userImpact
  ? impactScore[prd.value.userImpact]
  : impactScore[prd.problem.impact]
const strategicAlignment = prd.value?.strategicAlignment ?? 3
return (businessImpact + userImpact) * strategicAlignment
```

### calculatePriorityScore(prd)
```javascript
const valueScore = calculateValueScore(prd)
const effortScore = prd.estimation.estimatedHours / 10
return effortScore > 0 ? valueScore / effortScore : valueScore
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No project | "Run `p. init` first" |
| No PRDs | "No approved PRDs. Run `p. prd <title>` first" |
| PRD not found | "PRD not found: {id}" |
| Over capacity | Warn and ask user |
| Invalid quarter | "Invalid quarter format. Use Q1-2026" |

---

## Output Format

### Success
```
✅ Quarter {quarter.id} planned

Theme: {quarter.theme}
Features: {count}
Capacity: {allocated}/{total}h ({utilization}%)

Next: Run `p. task <description>` to start work
```

### Status
```
📊 Roadmap Status

Quarters: {quarters.length}
Features: {features.length} ({active} active)
Backlog: {backlog.length}

Next: `p. plan quarter` to plan next quarter
```

---

## Related Commands

| Command | Relationship |
|---------|--------------|
| `p. prd` | Creates PRDs that feed into roadmap |
| `p. task` | Starts work on roadmap features |
| `p. ship` | Ships features, updates roadmap |
| `p. impact` | Tracks outcomes for shipped features |
| `p. sync` | Generates roadmap from git history |
