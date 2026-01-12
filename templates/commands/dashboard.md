---
allowed-tools: [Read, Write, Bash, Glob, Grep]
description: 'Project health dashboard with analytics'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
claude-context: 'context/dashboard.md'
---

# p. dashboard - Project Health Dashboard

**Purpose**: Display comprehensive project health metrics, progress, and analytics.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{timestamp}`: Current timestamp (GetTimestamp())

---

## Usage

```
p. dashboard                 # Full dashboard view
p. dashboard velocity        # Velocity and throughput metrics
p. dashboard estimates       # Estimation accuracy analysis
p. dashboard learnings       # Aggregated learnings
p. dashboard quarter [id]    # Quarter-specific view
```

---

## Step 1: Validate Project

```
READ: .prjct/prjct.config.json
EXTRACT: projectId, projectName

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

SET: globalPath = ~/.prjct-cli/projects/{projectId}
```

---

## Step 2: Load All Data

```
READ: {globalPath}/storage/state.json
READ: {globalPath}/storage/roadmap.json
READ: {globalPath}/storage/prds.json (if exists)
READ: {globalPath}/storage/shipped.json (if exists)
READ: {globalPath}/storage/outcomes.json (if exists)
READ: {globalPath}/storage/queue.json (if exists)

# Set defaults for missing files
IF roadmap missing: SET roadmap = { features: [], quarters: [], backlog: [] }
IF prds missing: SET prds = { prds: [] }
IF shipped missing: SET shipped = []
IF outcomes missing: SET outcomes = { outcomes: [], aggregates: null }
IF queue missing: SET queue = { items: [] }
```

---

## Step 3: Calculate Metrics

### 3.1 Roadmap Progress

```
SET: totalFeatures = roadmap.features.length
SET: plannedFeatures = roadmap.features.filter(f => f.status == 'planned')
SET: activeFeatures = roadmap.features.filter(f => f.status == 'active')
SET: completedFeatures = roadmap.features.filter(f => f.status == 'completed')
SET: shippedFeatures = roadmap.features.filter(f => f.status == 'shipped')

SET: roadmapProgress = totalFeatures > 0
  ? ((completedFeatures.length + shippedFeatures.length) / totalFeatures) * 100
  : 0

SET: legacyFeatures = roadmap.features.filter(f => f.legacy)
SET: prdBackedFeatures = roadmap.features.filter(f => f.prdId)
```

### 3.2 Quarter Metrics

```
SET: currentQuarter = calculateCurrentQuarter()
SET: activeQuarter = roadmap.quarters.find(q => q.status == 'active') || null

IF activeQuarter:
  SET: quarterFeatures = roadmap.features.filter(f => f.quarter == activeQuarter.id)
  SET: quarterCompleted = quarterFeatures.filter(f =>
    f.status == 'completed' || f.status == 'shipped'
  )
  SET: quarterProgress = quarterFeatures.length > 0
    ? (quarterCompleted.length / quarterFeatures.length) * 100
    : 0

  SET: capacityUsed = activeQuarter.capacity?.allocatedHours || 0
  SET: capacityTotal = activeQuarter.capacity?.totalHours || 0
  SET: capacityUtilization = capacityTotal > 0
    ? (capacityUsed / capacityTotal) * 100
    : 0
```

### 3.3 Estimation Accuracy

```
IF outcomes.outcomes.length > 0:
  SET: accuracies = outcomes.outcomes.map(o =>
    100 - Math.abs(o.effort.variance.percentage)
  )
  SET: avgEstimationAccuracy = Math.round(
    accuracies.reduce((a, b) => a + b, 0) / accuracies.length
  )

  # Trend (last 5 vs previous 5)
  SET: recent5 = outcomes.outcomes.slice(0, 5)
  SET: previous5 = outcomes.outcomes.slice(5, 10)

  SET: recentAccuracy = calculateAvgAccuracy(recent5)
  SET: previousAccuracy = calculateAvgAccuracy(previous5)
  SET: accuracyTrend = recentAccuracy - previousAccuracy
ELSE:
  SET: avgEstimationAccuracy = 0
  SET: accuracyTrend = 0
```

### 3.4 Success Rate

```
IF outcomes.outcomes.length > 0:
  SET: successfulOutcomes = outcomes.outcomes.filter(o =>
    o.success?.overallSuccess == 'exceeded' || o.success?.overallSuccess == 'met'
  )
  SET: successRate = (successfulOutcomes.length / outcomes.outcomes.length) * 100
ELSE:
  SET: successRate = 0
```

### 3.5 Velocity Metrics

```
# Features shipped per week (last 4 weeks)
SET: fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
SET: recentShips = shipped.filter(s => new Date(s.shippedAt) > fourWeeksAgo)
SET: weeklyVelocity = recentShips.length / 4

# Hours per feature (average)
IF outcomes.outcomes.length > 0:
  SET: avgHoursPerFeature = Math.round(
    outcomes.outcomes.reduce((sum, o) => sum + o.effort.actual.hours, 0) /
    outcomes.outcomes.length
  )
ELSE:
  SET: avgHoursPerFeature = 0

# Cycle time (avg days from start to ship)
SET: cycleTimes = outcomes.outcomes
  .filter(o => o.startedAt && o.shippedAt)
  .map(o => daysBetween(o.startedAt, o.shippedAt))

SET: avgCycleTime = cycleTimes.length > 0
  ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
  : 0
```

### 3.6 PRD Coverage

```
SET: totalPRDs = prds.prds.length
SET: approvedPRDs = prds.prds.filter(p => p.status == 'approved')
SET: inProgressPRDs = prds.prds.filter(p => p.status == 'in_progress')
SET: completedPRDs = prds.prds.filter(p => p.status == 'completed')
SET: draftPRDs = prds.prds.filter(p => p.status == 'draft')

SET: prdCoverage = totalFeatures > 0
  ? (prdBackedFeatures.length / totalFeatures) * 100
  : 0
```

---

## Step 4: Route by Subcommand

### 4.1 Default - Full Dashboard

```
OUTPUT:
"""
┌─────────────────────────────────────────────────────────────────────────┐
│  {projectName} DASHBOARD                                                 │
│  Last Updated: {timestamp}                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ROADMAP PROGRESS                                                        │
│  {progressBar(roadmapProgress)} {roadmapProgress.toFixed(0)}%            │
│                                                                          │
│  Features: {shippedFeatures.length} shipped / {completedFeatures.length} done / {activeFeatures.length} active / {plannedFeatures.length} planned
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  {activeQuarter ? activeQuarter.id : 'NO ACTIVE QUARTER'}               │
│  {activeQuarter ? 'Theme: ' + activeQuarter.theme : ''}                 │
│                                                                          │
│  Progress: {progressBar(quarterProgress)} {quarterProgress.toFixed(0)}% │
│  Capacity: {progressBar(capacityUtilization)} {capacityUsed}h / {capacityTotal}h ({capacityUtilization.toFixed(0)}%)
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  KEY METRICS                                                             │
│                                                                          │
│  Estimation Accuracy   {progressBar(avgEstimationAccuracy)} {avgEstimationAccuracy}% {trendArrow(accuracyTrend)}
│  Success Rate          {progressBar(successRate)} {successRate.toFixed(0)}%
│  PRD Coverage          {progressBar(prdCoverage)} {prdCoverage.toFixed(0)}%
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  VELOCITY                                                                │
│                                                                          │
│  Weekly Throughput: {weeklyVelocity.toFixed(1)} features/week           │
│  Avg Hours/Feature: {avgHoursPerFeature}h                               │
│  Avg Cycle Time:    {avgCycleTime} days                                 │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ACTIVE WORK                                                             │
│                                                                          │
{FOR EACH feature in activeFeatures.slice(0, 5):}
│  ├─ {feature.name}                                                       │
│  │  {progressBar(feature.progress)} {feature.progress}%                  │
│  │  Quarter: {feature.quarter || 'Unassigned'} | PRD: {feature.prdId ? '✓' : '✗'}
{END FOR}
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRDs                                                                    │
│  Draft: {draftPRDs.length} | Approved: {approvedPRDs.length} | In Progress: {inProgressPRDs.length} | Done: {completedPRDs.length}
│                                                                          │
│  BACKLOG                                                                 │
│  {roadmap.backlog.length} items waiting                                  │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CURRENT TASK                                                            │
│                                                                          │
{IF state.currentTask:}
│  {state.currentTask.description}                                         │
│  Type: {state.currentTask.type} | Started: {timeSince(state.currentTask.startedAt)}
{ELSE:}
│  No active task. Run `p. task <description>` to start.                  │
{END IF}
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

Commands:
- p. dashboard velocity    → Detailed velocity metrics
- p. dashboard estimates   → Estimation accuracy analysis
- p. dashboard learnings   → Aggregated learnings
- p. dashboard quarter     → Current quarter details
"""
```

---

### 4.2 Subcommand: velocity

```
OUTPUT:
"""
## Velocity Metrics

### Throughput

| Period | Features Shipped | Avg Hours |
|--------|------------------|-----------|
| This Week | {thisWeekShips} | {thisWeekHours}h |
| Last Week | {lastWeekShips} | {lastWeekHours}h |
| This Month | {thisMonthShips} | {thisMonthHours}h |
| All Time | {shipped.length} | {avgHoursPerFeature}h |

### Weekly Trend (Last 8 Weeks)

```
{FOR i = 0 to 7:}
W-{i}: {barChart(weeklyShips[i])} {weeklyShips[i]} features
{END FOR}
```

### Cycle Time Distribution

| Range | Count | Percentage |
|-------|-------|------------|
| < 1 day | {under1Day} | {pctUnder1Day}% |
| 1-3 days | {days1to3} | {pctDays1to3}% |
| 3-7 days | {days3to7} | {pctDays3to7}% |
| 1-2 weeks | {weeks1to2} | {pctWeeks1to2}% |
| > 2 weeks | {over2Weeks} | {pctOver2Weeks}% |

**Average Cycle Time:** {avgCycleTime} days
**Median Cycle Time:** {medianCycleTime} days

### By Feature Type

| Type | Count | Avg Hours | Avg Cycle |
|------|-------|-----------|-----------|
{FOR EACH type in ['feature', 'bug', 'improvement', 'refactor', 'chore']:}
| {type} | {countByType[type]} | {avgHoursByType[type]}h | {avgCycleByType[type]}d |
{END FOR}

---

**Insights:**
{IF weeklyVelocity > previousWeeklyVelocity:}
- Velocity trending up ({((weeklyVelocity - previousWeeklyVelocity) / previousWeeklyVelocity * 100).toFixed(0)}% increase)
{ELSE IF weeklyVelocity < previousWeeklyVelocity:}
- Velocity trending down ({((previousWeeklyVelocity - weeklyVelocity) / previousWeeklyVelocity * 100).toFixed(0)}% decrease)
{END IF}
{IF avgCycleTime > 7:}
- Consider breaking down features - cycle time over 1 week
{END IF}
"""
```

---

### 4.3 Subcommand: estimates

```
OUTPUT:
"""
## Estimation Accuracy Analysis

### Overall Accuracy

**Current Accuracy:** {avgEstimationAccuracy}%
**Trend:** {accuracyTrend > 0 ? '↑' : accuracyTrend < 0 ? '↓' : '→'} {Math.abs(accuracyTrend).toFixed(0)}%

### Accuracy Over Time (Last 10 Features)

```
{FOR EACH outcome in outcomes.outcomes.slice(0, 10):}
{outcome.featureName.slice(0, 20).padEnd(20)} | Est: {outcome.effort.estimated.hours.toString().padStart(3)}h | Act: {outcome.effort.actual.hours.toString().padStart(3)}h | {accuracyBar(outcome)} {calculateAccuracy(outcome)}%
{END FOR}
```

### Variance Distribution

| Variance | Count | Features |
|----------|-------|----------|
| Under by 50%+ | {underBy50Plus} | {underBy50Features.join(', ')} |
| Under by 20-50% | {underBy20to50} | ... |
| Within ±20% | {within20} | ... |
| Over by 20-50% | {overBy20to50} | ... |
| Over by 50%+ | {overBy50Plus} | {overBy50Features.join(', ')} |

### Common Variance Reasons

{FOR EACH pattern in outcomes.aggregates?.variancePatterns || []:}
| **{pattern.reason.replace(/_/g, ' ')}** | {pattern.count}x | avg {pattern.averageVariance > 0 ? '+' : ''}{pattern.averageVariance}% |
{END FOR}

### By Feature Size

| Size | Count | Avg Variance | Accuracy |
|------|-------|--------------|----------|
| XS (< 4h) | {xsCount} | {xsVariance}% | {xsAccuracy}% |
| S (4-8h) | {sCount} | {sVariance}% | {sAccuracy}% |
| M (8-24h) | {mCount} | {mVariance}% | {mAccuracy}% |
| L (24-40h) | {lCount} | {lVariance}% | {lAccuracy}% |
| XL (40h+) | {xlCount} | {xlVariance}% | {xlAccuracy}% |

---

**Recommendations:**
{IF avgEstimationAccuracy < 60:}
- Estimation accuracy below 60% - consider using historical data for estimates
{END IF}
{IF overBy50Plus > 2:}
- Multiple features over 50% - complexity often underestimated
- Add 30% buffer to future estimates
{END IF}
{IF mostCommonVarianceReason == 'scope_creep':}
- Scope creep is common - lock requirements before starting
{END IF}
"""
```

---

### 4.4 Subcommand: learnings

```
OUTPUT:
"""
## Aggregated Learnings

### What Works (Top 10)

{FOR i = 0 to 9:}
{i + 1}. {topWhatWorked[i].insight} ({topWhatWorked[i].frequency}x)
{END FOR}

### What Doesn't Work (Top 10)

{FOR i = 0 to 9:}
{i + 1}. {topWhatDidnt[i].insight} ({topWhatDidnt[i].frequency}x)
{END FOR}

### Common Surprises

{FOR EACH surprise in topSurprises:}
- {surprise.insight} ({surprise.frequency}x)
{END FOR}

### Actionable Recommendations

| Category | Recommendation | Frequency |
|----------|----------------|-----------|
{FOR EACH rec in aggregatedRecommendations:}
| {rec.category} | {rec.action} | {rec.frequency}x |
{END FOR}

### Learning Patterns

**Most Improved Areas:**
{FOR EACH area in improvedAreas:}
- {area.name}: {area.improvement}% improvement
{END FOR}

**Areas Needing Attention:**
{FOR EACH area in attentionAreas:}
- {area.name}: {area.issue}
{END FOR}

---

**Key Insight:** {topInsight}

**Action Items:**
1. {actionItem1}
2. {actionItem2}
3. {actionItem3}
"""
```

---

### 4.5 Subcommand: quarter [id]

```
SET: targetQuarter = id
  ? roadmap.quarters.find(q => q.id == id)
  : activeQuarter

IF NOT targetQuarter:
  OUTPUT: "Quarter not found. Available: {roadmap.quarters.map(q => q.id).join(', ')}"
  STOP

SET: qFeatures = roadmap.features.filter(f => f.quarter == targetQuarter.id)
SET: qOutcomes = outcomes.outcomes.filter(o =>
  qFeatures.some(f => f.id == o.featureId)
)

OUTPUT:
"""
## {targetQuarter.id}: {targetQuarter.name}

**Status:** {targetQuarter.status}
**Theme:** {targetQuarter.theme}
**Period:** {targetQuarter.startDate} → {targetQuarter.endDate}

---

### Capacity

| Metric | Value |
|--------|-------|
| Total | {targetQuarter.capacity?.totalHours || 0}h |
| Allocated | {targetQuarter.capacity?.allocatedHours || 0}h |
| Buffer | {targetQuarter.capacity?.bufferPercent || 0}% |
| Available | {availableHours}h |
| Utilization | {progressBar(utilization)} {utilization.toFixed(0)}% |

---

### Goals

{FOR EACH goal in targetQuarter.goals || []:}
- [ ] {goal}
{END FOR}

---

### Features ({qFeatures.length})

| Feature | Status | Progress | Est | Act | Variance |
|---------|--------|----------|-----|-----|----------|
{FOR EACH feature in qFeatures:}
| {feature.name} | {feature.status} | {feature.progress}% | {feature.effortTracking?.estimated?.hours || '?'}h | {getActualHours(feature)}h | {getVariance(feature)} |
{END FOR}

**Total Estimated:** {totalEstimated}h
**Total Actual:** {totalActual}h
**Quarter Variance:** {quarterVariance > 0 ? '+' : ''}{quarterVariance}%

---

### Success Metrics (from Outcomes)

{IF qOutcomes.length > 0:}
| Metric | Value |
|--------|-------|
| Features Completed | {qCompleted}/{qFeatures.length} |
| Avg Success Score | {qAvgSuccess}% |
| Avg ROI | {qAvgROI} |
| Avg Estimation Accuracy | {qAvgAccuracy}% |

**Success Distribution:**
- Exceeded: {qExceeded}
- Met: {qMet}
- Partial: {qPartial}
- Failed: {qFailed}
{ELSE:}
*No outcomes recorded yet for this quarter.*
{END IF}

---

### Burndown

```
Week 1: {bar(week1Remaining)} {week1Remaining}h remaining
Week 2: {bar(week2Remaining)} {week2Remaining}h remaining
...
Week 12: {bar(week12Remaining)} {week12Remaining}h remaining
```

**Projected Completion:** {projectedCompletion}
**On Track:** {onTrack ? '✅ Yes' : '⚠️ No - ' + daysOff + ' days behind'}
"""
```

---

## Step 5: Generate Context

```
WRITE: {globalPath}/context/dashboard.md

"""
# Dashboard

**Generated:** {timestamp}

---

## Summary

| Metric | Value | Trend |
|--------|-------|-------|
| Roadmap Progress | {roadmapProgress.toFixed(0)}% | {roadmapTrend} |
| Quarter Progress | {quarterProgress.toFixed(0)}% | {quarterTrend} |
| Estimation Accuracy | {avgEstimationAccuracy}% | {accuracyTrend > 0 ? '↑' : '↓'} |
| Success Rate | {successRate.toFixed(0)}% | {successTrend} |
| Weekly Velocity | {weeklyVelocity.toFixed(1)} | {velocityTrend} |

---

## Current State

**Active Quarter:** {activeQuarter?.id || 'None'}
**Active Features:** {activeFeatures.length}
**Current Task:** {state.currentTask?.description || 'None'}

---

## Recent Activity

{FOR EACH ship in shipped.slice(0, 5):}
- [{ship.shippedAt}] Shipped: {ship.name} v{ship.version}
{END FOR}

---

## Alerts

{IF capacityUtilization > 90:}
- ⚠️ Quarter capacity nearly full ({capacityUtilization.toFixed(0)}%)
{END IF}
{IF avgEstimationAccuracy < 60:}
- ⚠️ Estimation accuracy below 60%
{END IF}
{IF activeFeatures.length > 3:}
- ⚠️ {activeFeatures.length} features in progress - consider focusing
{END IF}
{IF draftPRDs.length > 3:}
- 📋 {draftPRDs.length} PRDs in draft - review and approve
{END IF}

---

*Generated by prjct-cli | https://prjct.app*
"""
```

---

## Helper Functions

### progressBar(percentage)
```javascript
const filled = Math.round(percentage / 10)
const empty = 10 - filled
return '█'.repeat(filled) + '░'.repeat(empty)
```

### trendArrow(value)
```javascript
if (value > 5) return '↑'
if (value < -5) return '↓'
return '→'
```

### barChart(value, max = 10)
```javascript
const bars = Math.round((value / max) * 20)
return '▓'.repeat(bars)
```

### timeSince(isoDate)
```javascript
const diff = Date.now() - new Date(isoDate).getTime()
const hours = Math.floor(diff / (1000 * 60 * 60))
if (hours < 1) return 'just now'
if (hours < 24) return `${hours}h ago`
return `${Math.floor(hours / 24)}d ago`
```

### daysBetween(start, end)
```javascript
const diff = new Date(end) - new Date(start)
return Math.ceil(diff / (1000 * 60 * 60 * 24))
```

### calculateCurrentQuarter()
```javascript
const now = new Date()
const quarter = Math.floor(now.getMonth() / 3) + 1
return `Q${quarter}-${now.getFullYear()}`
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No project | "Run `p. init` first" |
| No data | Show empty dashboard with setup tips |
| Invalid quarter | List available quarters |

---

## Output Format

Dashboard uses ASCII art for terminal display:
- Progress bars: `████████░░`
- Trend arrows: `↑ ↓ →`
- Status icons: `✅ ⚠️ ❌ 📋`
- Box drawing: `┌ ┐ └ ┘ │ ─ ├ ┤`

---

## Related Commands

| Command | Relationship |
|---------|--------------|
| `p. plan` | Feeds quarter data to dashboard |
| `p. impact` | Feeds outcome data to dashboard |
| `p. ship` | Feeds shipped data to dashboard |
| `p. sync` | Refreshes project state |
