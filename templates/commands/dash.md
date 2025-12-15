---
allowed-tools: [Read, GetTimestamp, GetDate]
description: 'Unified dashboard - project status, progress, and roadmap'
timestamp-rule: 'ALWAYS use GetTimestamp() and GetDate() tools for timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/*.json'
claude-context: 'context/*.md'
---

# /p:dash - Unified Dashboard

## Architecture: Write-Through Pattern

Reads from **Storage (JSON)** as source of truth.

**Source of Truth**:
- `storage/state.json` - Current/paused tasks
- `storage/queue.json` - Task queue
- `storage/ideas.json` - Ideas list
- `storage/shipped.json` - Shipped features

## Usage

```
/p:dash                    # Full dashboard (default view)
/p:dash week               # Weekly progress focus
/p:dash month              # Monthly progress focus
/p:dash roadmap            # Roadmap and planning focus
/p:dash compact            # Minimal status only
```

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{queuePath}`: `{globalPath}/storage/queue.json`
- `{ideasPath}`: `{globalPath}/storage/ideas.json`
- `{shippedPath}`: `{globalPath}/storage/shipped.json`

## Flow

1. **Read all storage files**:
   - `storage/state.json` → Active and paused tasks
   - `storage/queue.json` → Priority queue
   - `storage/shipped.json` → Recent ships
   - `storage/ideas.json` → Recent ideas

2. **Calculate metrics**:
   - Current task and elapsed time
   - Tasks completed today/week/month
   - Paused tasks count
   - Queue depth
   - Days since last ship
   - Velocity (tasks/week)

3. **Generate view based on param**:
   - Default → Balanced overview
   - Week/Month → Progress focused
   - Roadmap → Planning focused
   - Compact → Just essentials

## Response Formats

### Default Dashboard

```
┌─────────────────────────────────────────┐
│           📊 PROJECT DASHBOARD          │
├─────────────────────────────────────────┤
│ 🎯 Current Focus                        │
│ {active_task}                           │
│ Started: {time_ago} | Session: {id}     │
├─────────────────────────────────────────┤
│ ⏸️  Paused: {paused_task or "None"}     │
├─────────────────────────────────────────┤
│ 📋 Queue ({queue_count})                │
│ • {next_task_1}                         │
│ • {next_task_2}                         │
│ • {next_task_3}                         │
├─────────────────────────────────────────┤
│ 🚀 Recent Ships                         │
│ • {ship_1} - {date}                     │
│ • {ship_2} - {date}                     │
├─────────────────────────────────────────┤
│ 💡 Ideas ({ideas_count})                │
└─────────────────────────────────────────┘

Next: /p:now | /p:done | /p:ship
```

### Compact View

```
🎯 {active_task} ({time_elapsed})
📋 Queue: {queue_count} | ⏸️ Paused: {paused ? "Yes" : "No"}
🚀 Last ship: {days}d ago
💡 Ideas: {ideas_count}

→ /p:done | /p:next | /p:ship
```

### Weekly Progress View

```
📊 WEEKLY PROGRESS - Week of {week_start}

## Completed Tasks ({count})
✅ {task_1} - {duration}
✅ {task_2} - {duration}

## Features Shipped ({count})
🚀 {feature_1} - {date}

## Metrics
**Velocity**: {tasks_per_day} tasks/day
**Focus Time**: {total_hours} hours
```

## Data Sources

| Data | Storage File | Field |
|------|--------------|-------|
| Current Task | `storage/state.json` | `currentTask` |
| Paused Task | `storage/state.json` | `pausedTask` |
| Queue Tasks | `storage/queue.json` | `tasks[]` |
| Ideas | `storage/ideas.json` | `ideas[]` |
| Shipped | `storage/shipped.json` | `shipped[]` |

## Error Handling

| Error | Response |
|-------|----------|
| No project | "No prjct project. Run /p:init first." |
| No storage files | Show empty dashboard |
| Parse error | Skip that section |

## Natural Language Support

Detect intent:
- "p. dashboard" → Full dashboard
- "p. dash" → Full dashboard
- "p. status" → Compact view (absorbed /p:status)
- "p. progress" → Weekly view (absorbed /p:progress)
- "p. recap" → Full dashboard (absorbed /p:recap)
- "p. how am I doing" → Default view
- "p. weekly" → Weekly progress

## Absorbed Commands

This command consolidates:
- `/p:status` → Use `/p:dash compact`
- `/p:progress` → Use `/p:dash week` or `/p:dash month`
- `/p:recap` → Use `/p:dash` (default)
- `/p:roadmap` → Use `/p:next roadmap`

## KPI Metrics (from /p:status)

Calculate and display:
```
Sprint: [████░] {%}
Tasks: {done}/{total}
Ship: {days} ago
Focus: {task}
```

## Progress Metrics (from /p:progress)

For week/month views:
```
📈 {period} | 🚀 {N} shipped | ⚡ {velocity}/day | Trend: {↗%}
```

### Velocity Calculation
```
velocity = shipped_count / days_in_period
trend = (current_velocity - previous_velocity) / previous_velocity * 100
```
