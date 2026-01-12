---
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion, Task]
description: 'Track feature outcomes and capture learnings'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/outcomes.json'
claude-context: 'context/impact.md'
---

# p. impact - Track Feature Outcomes

**Purpose**: Capture outcomes, compare actual vs estimated effort, and record learnings after shipping a feature.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{featureId}`: Feature ID from arguments or most recent ship
- `{timestamp}`: Current timestamp (GetTimestamp())

---

## Usage

```
p. impact                    # Review most recently shipped feature
p. impact <feature-id>       # Review specific feature
p. impact list               # List features pending review
p. impact summary            # Show aggregate metrics
```

---

## Step 1: Validate Project

```
READ: .prjct/prjct.config.json
EXTRACT: projectId

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

SET: globalPath = ~/.prjct-cli/projects/{projectId}
```

---

## Step 2: Load Data

```
READ: {globalPath}/storage/shipped.json
READ: {globalPath}/storage/roadmap.json
READ: {globalPath}/storage/prds.json (if exists)
READ: {globalPath}/storage/outcomes.json (if exists)

IF outcomes.json does NOT exist:
  CREATE default:
  {
    "outcomes": [],
    "taskOutcomes": [],
    "lastUpdated": "{timestamp}"
  }
```

---

## Step 3: Route by Subcommand

### 3.1 Subcommand: list

Show features pending impact review.

```
SET: shippedFeatures = shipped.filter(s => s.version)
SET: reviewedFeatureIds = outcomes.outcomes.map(o => o.featureId)
SET: pendingReview = shippedFeatures.filter(s =>
  !reviewedFeatureIds.includes(s.taskId || s.id)
)

IF pendingReview.length == 0:
  OUTPUT: "All shipped features have been reviewed."
  STOP

OUTPUT:
"""
## Features Pending Impact Review

| # | Feature | Version | Shipped | PRD |
|---|---------|---------|---------|-----|
{FOR EACH item in pendingReview:}
| {index + 1} | {item.name} | {item.version} | {item.shippedAt} | {item.prdId || 'N/A'} |
{END FOR}

Run `p. impact <feature-id>` to review a specific feature.
Or `p. impact` to review the most recent.
"""
```

---

### 3.2 Subcommand: summary

Show aggregate metrics from all outcomes.

```
IF outcomes.outcomes.length == 0:
  OUTPUT: "No outcomes recorded yet. Ship features and run `p. impact` to track them."
  STOP

# Calculate aggregates
SET: aggregates = aggregateOutcomes(outcomes.outcomes)

OUTPUT:
"""
## Impact Summary

### Overall Metrics

| Metric | Value |
|--------|-------|
| Features Reviewed | {aggregates.totalFeatures} |
| Estimation Accuracy | {aggregates.averageEstimationAccuracy}% |
| Success Rate | {aggregates.averageSuccessRate}% |
| Average ROI | {aggregates.averageROI} |

### Success Distribution

| Level | Count | Percentage |
|-------|-------|------------|
| Exceeded | {aggregates.bySuccessLevel.exceeded} | {pct_exceeded}% |
| Met | {aggregates.bySuccessLevel.met} | {pct_met}% |
| Partial | {aggregates.bySuccessLevel.partial} | {pct_partial}% |
| Failed | {aggregates.bySuccessLevel.failed} | {pct_failed}% |

### Common Variance Reasons

{FOR EACH pattern in aggregates.variancePatterns:}
- **{pattern.reason}**: {pattern.count} occurrences, avg {pattern.averageVariance}% variance
{END FOR}

### Top Learnings

{FOR EACH learning in aggregates.topLearnings.slice(0, 5):}
- {learning.insight} ({learning.frequency}x)
{END FOR}

---

Run `p. impact` to add more reviews.
"""
```

---

### 3.3 Default / Specific Feature

Review a specific feature or the most recently shipped.

```
IF featureId provided:
  SET: targetFeature = shipped.find(s => s.taskId == featureId || s.id == featureId)
ELSE:
  # Get most recently shipped feature without outcome
  SET: reviewedIds = outcomes.outcomes.map(o => o.featureId)
  SET: unreviewedShips = shipped.filter(s => !reviewedIds.includes(s.taskId || s.id))

  IF unreviewedShips.length == 0:
    OUTPUT: "All shipped features have been reviewed."
    OUTPUT: "Run `p. impact list` to see reviewed features."
    STOP

  SET: targetFeature = unreviewedShips[0]  # Most recent

IF NOT targetFeature:
  OUTPUT: "Feature not found: {featureId}"
  STOP

# Check if already reviewed
SET: existingOutcome = outcomes.outcomes.find(o => o.featureId == targetFeature.taskId)
IF existingOutcome:
  OUTPUT: "Feature already reviewed on {existingOutcome.reviewedAt}"

  USE AskUserQuestion:
    question: "What would you like to do?"
    options:
      - label: "View existing review"
        description: "Show the recorded outcome"
      - label: "Update review"
        description: "Modify the existing outcome"
      - label: "Cancel"
        description: "Exit"

  IF "View existing review":
    → Show existing outcome
    STOP
  IF "Cancel":
    STOP
  # Else continue to update

# Load related data
SET: roadmapFeature = roadmap.features.find(f => f.id == targetFeature.taskId)
SET: prd = roadmapFeature?.prdId
  ? prds.prds.find(p => p.id == roadmapFeature.prdId)
  : null
SET: isLegacy = roadmapFeature?.legacy || !prd

OUTPUT:
"""
## Impact Review: {targetFeature.name}

**Version:** {targetFeature.version}
**Shipped:** {targetFeature.shippedAt}
**Branch:** {targetFeature.branch}
**PRD:** {prd ? prd.title : 'None (legacy feature)'}
"""
```

---

## Step 4: Collect Effort Data

```
OUTPUT: "### Step 1: Effort Tracking"

# Get estimated hours
IF prd:
  SET: estimatedHours = prd.estimation.estimatedHours
  SET: estimateConfidence = prd.estimation.confidence
  OUTPUT: "PRD Estimate: {estimatedHours}h ({estimateConfidence} confidence)"
ELSE IF roadmapFeature?.effortTracking?.estimated:
  SET: estimatedHours = roadmapFeature.effortTracking.estimated.hours
  OUTPUT: "Roadmap Estimate: {estimatedHours}h"
ELSE:
  USE AskUserQuestion:
    question: "What was the original estimate for this feature?"
    options:
      - label: "< 4 hours"
        description: "XS task"
      - label: "4-8 hours"
        description: "S task"
      - label: "8-24 hours"
        description: "M task"
      - label: "24-40 hours"
        description: "L task"
      - label: "40+ hours"
        description: "XL task"

  SET: estimatedHours = midpoint of selected range

# Get actual hours
USE AskUserQuestion:
  question: "How many hours did this feature actually take?"
  options:
    - label: "About as estimated ({estimatedHours}h)"
      description: "Within 10% of estimate"
    - label: "Less than estimated"
      description: "Took less time"
    - label: "More than estimated"
      description: "Took more time"
    - label: "Enter specific hours"
      description: "Provide exact number"

IF "Enter specific hours":
  PROMPT for actual hours
ELSE IF "About as estimated":
  SET: actualHours = estimatedHours
ELSE IF "Less than estimated":
  USE AskUserQuestion:
    question: "How much less?"
    options:
      - label: "10-25% less"
      - label: "25-50% less"
      - label: "50%+ less"

  SET: actualHours based on selection
ELSE IF "More than estimated":
  USE AskUserQuestion:
    question: "How much more?"
    options:
      - label: "10-25% more"
      - label: "25-50% more"
      - label: "50-100% more"
      - label: "100%+ more"

  SET: actualHours based on selection

# Calculate variance
SET: variance = {
  hours: actualHours - estimatedHours,
  percentage: ((actualHours - estimatedHours) / estimatedHours) * 100
}

# If significant variance, ask why
IF abs(variance.percentage) > 20:
  USE AskUserQuestion:
    question: "What caused the {variance.percentage > 0 ? 'overrun' : 'savings'}?"
    options:
      - label: "Scope creep"
        description: "Requirements expanded during development"
      - label: "Underestimated complexity"
        description: "Technical challenges were harder than expected"
      - label: "Technical debt"
        description: "Had to fix existing issues first"
      - label: "External blockers"
        description: "Waited on dependencies or approvals"
      - label: "Learning curve"
        description: "New technology or domain"
      - label: "Requirements changed"
        description: "Stakeholder changes mid-development"
      - label: "Optimistic estimate"
        description: "Original estimate was unrealistic"

  SET: variance.reason = selected option

OUTPUT:
"""
**Effort:**
- Estimated: {estimatedHours}h
- Actual: {actualHours}h
- Variance: {variance.hours > 0 ? '+' : ''}{variance.hours}h ({variance.percentage.toFixed(1)}%)
{variance.reason ? '- Reason: ' + variance.reason : ''}
"""
```

---

## Step 5: Collect Success Metrics (if PRD exists)

```
IF prd AND prd.successCriteria:
  OUTPUT: "### Step 2: Success Metrics"

  SET: metricResults = []
  SET: acResults = []

  # Evaluate each metric
  FOR EACH metric in prd.successCriteria.metrics:
    USE AskUserQuestion:
      question: "What was the actual value for '{metric.name}'?"
      options:
        - label: "Target met ({metric.target} {metric.unit})"
          description: "Achieved or exceeded target"
        - label: "Partially met"
          description: "Some progress but below target"
        - label: "Not measured"
          description: "Unable to measure this metric"
        - label: "Enter specific value"
          description: "Provide exact measurement"

    IF "Enter specific value":
      PROMPT for actual value
    ELSE IF "Target met":
      SET: actual = metric.target
    ELSE IF "Partially met":
      SET: actual = metric.target * 0.7  # 70% of target
    ELSE:
      SET: actual = null

    IF actual != null:
      PUSH: metricResults ← {
        name: metric.name,
        baseline: metric.baseline,
        target: metric.target,
        actual: actual,
        unit: metric.unit,
        achieved: actual >= metric.target,
        percentOfTarget: (actual / metric.target) * 100
      }

  # Evaluate acceptance criteria
  FOR EACH ac in prd.successCriteria.acceptanceCriteria:
    USE AskUserQuestion:
      question: "Was this acceptance criteria met: '{ac}'?"
      options:
        - label: "Yes"
          description: "Fully met"
        - label: "Partially"
          description: "Met with caveats"
        - label: "No"
          description: "Not met"

    PUSH: acResults ← {
      criteria: ac,
      met: selected == "Yes",
      notes: selected == "Partially" ? "Partially met" : null
    }

  # Calculate success score
  SET: successScore = calculateSuccessScore(metricResults, acResults)
  SET: overallSuccess = determineSuccessLevel(successScore)

  OUTPUT:
  """
  **Success Metrics:**
  {FOR EACH result in metricResults:}
  - {result.name}: {result.actual} / {result.target} {result.unit} ({result.achieved ? '✅' : '❌'})
  {END FOR}

  **Acceptance Criteria:** {acResults.filter(ac => ac.met).length}/{acResults.length} met

  **Overall Success:** {overallSuccess} ({successScore}%)
  """
ELSE:
  SET: successScore = null
  SET: overallSuccess = null
  OUTPUT: "### Step 2: Success Metrics (Skipped - no PRD)"
```

---

## Step 6: Collect Learnings

```
OUTPUT: "### Step 3: Learnings"

USE AskUserQuestion:
  question: "What worked well on this feature?"
  multiSelect: true
  options:
    - label: "Clear requirements"
      description: "PRD/spec was well-defined"
    - label: "Good estimation"
      description: "Estimate was accurate"
    - label: "Effective tooling"
      description: "Tools/frameworks helped"
    - label: "Strong testing"
      description: "Tests caught issues early"

SET: whatWorked = selected options (allow custom input)

USE AskUserQuestion:
  question: "What didn't work well?"
  multiSelect: true
  options:
    - label: "Unclear requirements"
      description: "Had to clarify multiple times"
    - label: "Poor estimation"
      description: "Estimate was way off"
    - label: "Technical debt"
      description: "Existing code slowed us down"
    - label: "Missing tests"
      description: "Found issues late"

SET: whatDidnt = selected options (allow custom input)

USE AskUserQuestion:
  question: "Any surprises during development?"
  options:
    - label: "None"
      description: "Everything went as expected"
    - label: "Positive surprises"
      description: "Something was easier than expected"
    - label: "Negative surprises"
      description: "Unexpected challenges"
    - label: "Both"
      description: "Had both good and bad surprises"

IF surprises:
  PROMPT for surprise descriptions

SET: learnings = {
  whatWorked: whatWorked,
  whatDidnt: whatDidnt,
  surprises: surprises,
  recommendations: []
}

# Generate recommendations based on learnings
IF "Poor estimation" in whatDidnt:
  PUSH: learnings.recommendations ← {
    category: "estimation",
    insight: "Estimation was inaccurate",
    actionable: true,
    action: "Add buffer for similar features, use historical data"
  }

IF "Technical debt" in whatDidnt:
  PUSH: learnings.recommendations ← {
    category: "technical",
    insight: "Technical debt slowed development",
    actionable: true,
    action: "Schedule tech debt cleanup before next major feature"
  }

OUTPUT:
"""
**Learnings:**
- Worked: {whatWorked.join(', ')}
- Didn't work: {whatDidnt.join(', ')}
- Surprises: {surprises.join(', ') || 'None'}
"""
```

---

## Step 7: ROI Assessment

```
OUTPUT: "### Step 4: ROI Assessment"

USE AskUserQuestion:
  question: "How much value did this feature deliver? (1-10)"
  options:
    - label: "1-3 (Low)"
      description: "Minimal user/business impact"
    - label: "4-6 (Medium)"
      description: "Moderate impact"
    - label: "7-8 (High)"
      description: "Significant impact"
    - label: "9-10 (Critical)"
      description: "Essential, major impact"

SET: valueDelivered = midpoint of selected range

USE AskUserQuestion:
  question: "Knowing what you know now, would you build this feature again?"
  options:
    - label: "Definitely"
      description: "Absolutely worth it"
    - label: "Probably"
      description: "Worth it with some changes"
    - label: "Maybe"
      description: "Uncertain, would need to reconsider"
    - label: "No"
      description: "Would not build it again"

SET: worthIt = selected option

IF worthIt == "Maybe" OR worthIt == "No":
  PROMPT: "Why?"
  SET: worthItReason = response

# Calculate ROI score
SET: roiScore = (valueDelivered * 10) / actualHours

SET: roi = {
  valueDelivered: valueDelivered,
  userImpact: mapValueToImpact(valueDelivered),
  businessImpact: mapValueToImpact(valueDelivered),
  roiScore: roiScore,
  worthIt: worthIt,
  worthItReason: worthItReason
}

OUTPUT:
"""
**ROI:**
- Value Delivered: {valueDelivered}/10
- ROI Score: {roiScore.toFixed(2)} (value per hour)
- Worth It: {worthIt}
{worthItReason ? '- Reason: ' + worthItReason : ''}
"""
```

---

## Step 8: Overall Rating

```
USE AskUserQuestion:
  question: "Overall, how would you rate this feature delivery? (1-5)"
  options:
    - label: "5 - Excellent"
      description: "Exceeded expectations"
    - label: "4 - Good"
      description: "Met expectations"
    - label: "3 - Okay"
      description: "Room for improvement"
    - label: "2 - Poor"
      description: "Significant issues"
    - label: "1 - Failed"
      description: "Did not meet goals"

SET: rating = selected value
```

---

## Step 9: Save Outcome

```
SET: {timestamp} = GetTimestamp()

# Generate outcome ID
BASH: bun -e "console.log('out_feat_' + crypto.randomUUID().slice(0,8))" 2>/dev/null || node -e "console.log('out_feat_' + require('crypto').randomUUID().slice(0,8))"
SET: outcomeId = result

SET: newOutcome = {
  id: outcomeId,
  featureId: targetFeature.taskId || targetFeature.id,
  featureName: targetFeature.name,
  prdId: prd?.id || null,
  version: targetFeature.version,
  branch: targetFeature.branch,
  prUrl: targetFeature.prUrl,

  effort: {
    estimated: {
      hours: estimatedHours,
      confidence: estimateConfidence || "medium",
      source: prd ? "prd" : "manual"
    },
    actual: {
      hours: actualHours,
      commits: await getCommitCount(targetFeature.branch),
      linesAdded: await getLinesAdded(targetFeature.branch),
      linesRemoved: await getLinesRemoved(targetFeature.branch)
    },
    variance: variance
  },

  success: prd ? {
    metrics: metricResults,
    acceptanceCriteria: acResults,
    overallSuccess: overallSuccess,
    successScore: successScore
  } : undefined,

  learnings: learnings,
  roi: roi,
  rating: rating,

  startedAt: roadmapFeature?.createdAt || targetFeature.shippedAt,
  shippedAt: targetFeature.shippedAt,
  reviewedAt: timestamp,
  reviewedBy: "user",
  legacy: isLegacy
}

# Update or add outcome
IF existingOutcome:
  REPLACE existingOutcome with newOutcome in outcomes.outcomes
ELSE:
  PUSH: outcomes.outcomes ← newOutcome

# Update aggregates
SET: outcomes.aggregates = aggregateOutcomes(outcomes.outcomes)
SET: outcomes.lastUpdated = timestamp
SET: outcomes.lastAggregated = timestamp

WRITE: {globalPath}/storage/outcomes.json

# Update PRD with outcomes (if exists)
IF prd:
  SET: prd.outcomes = {
    actualHours: actualHours,
    metricsAchieved: metricResults,
    learnings: learnings.whatWorked.concat(learnings.whatDidnt),
    surprises: learnings.surprises,
    wouldDoAgain: worthIt == "Definitely" || worthIt == "Probably",
    rating: rating,
    completedAt: timestamp
  }

  WRITE: {globalPath}/storage/prds.json
```

---

## Step 10: Generate Context

```
WRITE: {globalPath}/context/impact.md

"""
# Impact Report: {targetFeature.name}

**Reviewed:** {timestamp}
**Version:** {targetFeature.version}

---

## Summary

| Metric | Value |
|--------|-------|
| Estimated | {estimatedHours}h |
| Actual | {actualHours}h |
| Variance | {variance.percentage.toFixed(1)}% |
| Success | {overallSuccess || 'N/A'} |
| ROI Score | {roiScore.toFixed(2)} |
| Rating | {rating}/5 |

---

## Effort Analysis

**Estimated:** {estimatedHours}h ({estimateConfidence} confidence)
**Actual:** {actualHours}h
**Variance:** {variance.hours > 0 ? '+' : ''}{variance.hours}h ({variance.percentage.toFixed(1)}%)

{IF variance.reason:}
**Reason:** {variance.reason}
{variance.explanation || ''}
{END IF}

---

{IF success:}
## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
{FOR EACH metric in metricResults:}
| {metric.name} | {metric.target} {metric.unit} | {metric.actual} {metric.unit} | {metric.achieved ? '✅' : '❌'} |
{END FOR}

### Acceptance Criteria

{FOR EACH ac in acResults:}
- [{ac.met ? 'x' : ' '}] {ac.criteria}
{END FOR}

**Overall:** {overallSuccess} ({successScore}%)
{END IF}

---

## Learnings

### What Worked
{FOR EACH item in learnings.whatWorked:}
- {item}
{END FOR}

### What Didn't Work
{FOR EACH item in learnings.whatDidnt:}
- {item}
{END FOR}

### Surprises
{FOR EACH item in learnings.surprises:}
- {item}
{END FOR}

### Recommendations
{FOR EACH rec in learnings.recommendations:}
- **{rec.category}**: {rec.insight}
  - Action: {rec.action}
{END FOR}

---

## ROI Assessment

| Factor | Value |
|--------|-------|
| Value Delivered | {valueDelivered}/10 |
| User Impact | {roi.userImpact} |
| Business Impact | {roi.businessImpact} |
| ROI Score | {roiScore.toFixed(2)} |
| Worth Building | {worthIt} |

{IF worthItReason:}
**Note:** {worthItReason}
{END IF}

---

## Overall Rating: {rating}/5

{rating == 5 ? '⭐⭐⭐⭐⭐ Excellent' : ''}
{rating == 4 ? '⭐⭐⭐⭐ Good' : ''}
{rating == 3 ? '⭐⭐⭐ Okay' : ''}
{rating == 2 ? '⭐⭐ Poor' : ''}
{rating == 1 ? '⭐ Failed' : ''}

---

*Generated by prjct-cli | https://prjct.app*
"""
```

---

## Step 11: Log to Memory

```
APPEND to {globalPath}/memory/events.jsonl:
{"ts":"{timestamp}","action":"impact_recorded","outcomeId":"{outcomeId}","featureId":"{targetFeature.taskId}","rating":{rating},"roiScore":{roiScore},"variance":{variance.percentage}}
```

---

## Step 12: Output

```
OUTPUT:
"""
## Impact Recorded: {targetFeature.name}

| Metric | Value |
|--------|-------|
| Effort | {actualHours}h (est: {estimatedHours}h, {variance.percentage > 0 ? '+' : ''}{variance.percentage.toFixed(0)}%) |
| Success | {overallSuccess || 'N/A'} ({successScore || '-'}%) |
| ROI | {roiScore.toFixed(2)} |
| Rating | {rating}/5 |
| Worth It | {worthIt} |

### Key Learnings
{learnings.recommendations.length > 0 ?
  learnings.recommendations.map(r => '- ' + r.insight).join('\n') :
  '- No specific recommendations'
}

---

📄 Full report: `{globalPath}/context/impact.md`

Next: Run `p. impact summary` to see aggregate metrics
"""
```

---

## Helper Functions

### getCommitCount(branch)
```bash
git rev-list --count main..{branch} 2>/dev/null || echo "0"
```

### getLinesAdded(branch)
```bash
git diff --stat main...{branch} | tail -1 | awk '{print $4}' 2>/dev/null || echo "0"
```

### getLinesRemoved(branch)
```bash
git diff --stat main...{branch} | tail -1 | awk '{print $6}' 2>/dev/null || echo "0"
```

### mapValueToImpact(value)
```javascript
if (value >= 9) return 'critical'
if (value >= 7) return 'high'
if (value >= 4) return 'medium'
if (value >= 2) return 'low'
return 'none'
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No project | "Run `p. init` first" |
| No shipped features | "No shipped features. Run `p. ship` first" |
| Feature not found | "Feature not found: {id}" |
| Already reviewed | Offer to view or update |

---

## Related Commands

| Command | Relationship |
|---------|--------------|
| `p. ship` | Creates shipped entry that impact reviews |
| `p. prd` | Provides estimates and success criteria |
| `p. dashboard` | Shows aggregate impact metrics |
| `p. plan` | Uses learnings to improve future estimates |
