---
allowed-tools: [Read, GetTimestamp, GetDate]
description: 'Unified dashboard - project status, progress, and roadmap'
timestamp-rule: 'ALWAYS use GetTimestamp() and GetDate() tools for timestamps'
---

# /p:dash

## Usage

```
/p:dash                    # Full dashboard (default view)
/p:dash week               # Weekly progress focus
/p:dash month              # Monthly progress focus
/p:dash roadmap            # Roadmap and planning focus
/p:dash compact            # Minimal status only
```

## Flow

1. **Read all relevant files**:
   - `core/stack.jsonl` → Active and paused tasks
   - `core/next.md` → Priority queue
   - `progress/shipped.md` → Recent ships
   - `planning/roadmap.md` → Active roadmap
   - `planning/ideas.md` → Recent ideas
   - `progress/metrics.md` → Velocity metrics

2. **Calculate metrics**:
   - Current task and elapsed time
   - Tasks completed today/week/month
   - Paused tasks count
   - Queue depth
   - Days since last ship
   - Velocity (tasks/week)
   - Sprint progress percentage

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
│ Started: {time_ago} | Agent: {agent}    │
├─────────────────────────────────────────┤
│ ⏸️  Paused Tasks: {count}               │
│ 1. {task} (paused {time} ago)          │
├─────────────────────────────────────────┤
│ 📋 Priority Queue                       │
│ • {next_task_1} ({estimate})           │
│ • {next_task_2} ({estimate})           │
│ • {next_task_3} ({estimate})           │
│ → /p:next for full queue                │
├─────────────────────────────────────────┤
│ 📈 Progress This Week                   │
│ Sprint: [████████░░] 80%                │
│ Completed: {N} tasks                    │
│ Shipped: {M} features                   │
│ Velocity: {V} tasks/week                │
├─────────────────────────────────────────┤
│ 🚀 Last Ship: {days} days ago          │
│ {last_shipped_feature}                  │
├─────────────────────────────────────────┤
│ 🗺️ Roadmap Status                      │
│ Phase: {current_phase} ({progress}%)    │
│ Next milestone: {milestone}             │
└─────────────────────────────────────────┘

💡 Suggestions:
{contextual_suggestions_based_on_state}
```

### Weekly Progress View

```
📊 WEEKLY PROGRESS - Week of {week_start}

## 🎯 This Week's Accomplishments

### Completed Tasks ({count})
✅ {task_1} - {duration}
✅ {task_2} - {duration}
✅ {task_3} - {duration}

### Features Shipped ({count})
🚀 {feature_1} - {complexity} - {date}
🚀 {feature_2} - {complexity} - {date}

## 📈 Metrics

**Velocity**: {tasks_per_day} tasks/day
**Focus Time**: {total_hours} hours
**Efficiency**: {completion_rate}%
**Interruptions**: {pause_count} pauses

## 🔄 Week-over-Week

Compared to last week:
• Tasks: {trend} ({percentage}%)
• Velocity: {trend} ({percentage}%)
• Ships: {trend} ({count_diff})

## 📋 Upcoming

Next week's priorities:
1. {priority_1}
2. {priority_2}
3. {priority_3}
```

### Roadmap View

```
🗺️ ROADMAP & PLANNING

## Current Phase: {phase_name}
Progress: [████████░░] {percentage}%
Timeline: {start_date} → {end_date}
Status: {on_track|at_risk|delayed}

### Phase Goals
• {goal_1} - {status}
• {goal_2} - {status}
• {goal_3} - {status}

### Completed Milestones
✅ {milestone_1} - {date}
✅ {milestone_2} - {date}

### Upcoming Milestones
🎯 {milestone_1} - {eta}
🎯 {milestone_2} - {eta}

## Future Phases

**Phase 2**: {name} ({estimate})
- {key_feature_1}
- {key_feature_2}

**Phase 3**: {name} ({estimate})
- {key_feature_1}
- {key_feature_2}

## 💡 Recent Ideas ({count})
• {idea_1} - {priority}
• {idea_2} - {priority}
• {idea_3} - {priority}

→ /p:idea for new ideas
→ /p:feature to add to roadmap
```

### Compact View

```
🎯 {active_task} ({time_elapsed})
📋 Queue: {queue_count} | ⏸️ Paused: {paused_count}
📈 Week: {tasks_done} done | {velocity}/day
🚀 Last ship: {days}d ago

→ /p:done | /p:next | /p:ship
```

## Contextual Suggestions

Based on project state, suggest next actions:

### If no active task
```
💡 Start working:
→ /p:work 1 (from queue)
→ /p:resume (paused task)
```

### If haven't shipped recently
```
⚠️ {days} days since last ship!
→ /p:ship "{feature}"
→ Find quick win in /p:next
```

### If velocity dropping
```
📉 Velocity trend down
→ Check if tasks too complex
→ Consider breaking down with /p:feature
```

### If many paused tasks
```
⏸️ {count} tasks paused
→ Review with /p:stack
→ Consider completing or dropping
```

## Natural Language Support

Detect intent:
- "p. dashboard" → Full dashboard
- "p. status" → Default view
- "p. progress" → Weekly view
- "p. how am I doing" → Default view
- "p. roadmap" → Roadmap view
- "p. weekly" → Weekly progress

## ASCII Art Helpers

For progress bars:
```
Empty: ░░░░░░░░░░
Full:  ██████████
Mixed: ████████░░
```

For borders:
```
┌─┬─┐
│ │ │
├─┼─┤
└─┴─┘
```

## Migration Note

This command replaces:
- `/p:status` → Use `/p:dash`
- `/p:recap` → Use `/p:dash`
- `/p:progress` → Use `/p:dash week`
- `/p:roadmap` → Use `/p:dash roadmap`

Old commands will show deprecation notice and redirect here.