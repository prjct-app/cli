---
allowed-tools: [Read]
description: 'Context-aware suggestions based on project state and momentum'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/*.json'
---

# /p:suggest - Context-Aware Suggestions

## Architecture: Write-Through Pattern

Reads from **Storage (JSON)** as source of truth.

**Source of Truth**:
- `storage/state.json` - Current task
- `storage/queue.json` - Task queue
- `storage/shipped.json` - Shipped features

## Purpose

Analyze project state and recommend next actions based on current task, queue, last ship time, velocity, and momentum patterns.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{queuePath}`: `{globalPath}/storage/queue.json`
- `{shippedPath}`: `{globalPath}/storage/shipped.json`
- `{sessionsPath}`: `{globalPath}/progress/sessions`

## Flow

1. **Read storage files**: `storage/state.json`, `storage/queue.json`, `storage/shipped.json`, sessions (last 7 days)
2. **Calculate metrics**: Days since ship, active task duration, queue size, velocity (features/week), completion rate
3. **Detect patterns**: Long-running task (>1 day), stale queue, high velocity, low activity, blocked
4. **Generate recommendations**: Immediate action, urgency alerts, momentum tips, strategic suggestions

## Scenario Patterns

**1. No Active Task + Queue Has Tasks**
→ Ready to work: `/p:next` → `/p:build 1`

**2. Active Task + Long Duration (>4h)**
→ Might be stuck: `/p:stuck "{desc}"` or divide task into smaller parts
→ If forgot to mark: `/p:done`

**3. No Ships in 3+ Days**
→ Losing momentum: Complete something TODAY, pick quick win from `/p:next` → `/p:ship` same day

**4. Empty Queue + No Active Task**
→ Need planning: `/p:feature "{desc}"` or `/p:analyze` or `/p:roadmap` or `/p:bug "{desc}"`

**5. High Velocity (2+ ships/week)**
→ Great momentum: Maintain rhythm, consider tests/docs, quality checks

**6. Queue Growing (10+ tasks)**
→ Over-planning: STOP adding, START completing. Ship > Plan.

## Response Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 PERSONALIZED SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANALYSIS:
  • Active task: {current_task | "none"}
  • Queue: {N} tasks
  • Last ship: {time_ago}
  • Velocity: {X} features/week

━━━━━━━━━━━━━━━━━━━━━━━━━━━

{urgency_section_if_applicable}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 RECOMMENDATIONS:

1. ⚡ IMMEDIATE ACTION
   {immediate_action}
   → {command_1}
   → {command_2}

2. 💡 {category_2}
   {suggestion_2}
   → {command}

3. 🎯 {category_3}
   {suggestion_3}
   → {optional_command}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

{motivational_message}

What would you like to do?
```

## Urgency Levels

**🟢 Green** (All good): Active task or ready, shipped <2 days, velocity 2+ features/week → Positive reinforcement
**🟡 Yellow** (Attention): Task >4h, 3-4 days since ship, queue >7 tasks → Gentle nudge
**🔴 Red** (Urgent): 5+ days since ship, task >24h, queue >10 + no activity → Direct call to action

## Validation

- Requires: `.prjct/prjct.config.json` exists
- Read-only: Never modifies files
- No parameters: Analyzes current state

## Edge Cases

**Incomplete data**: Show partial analysis + tip to use prjct more
**First time**: Explain purpose + standard analysis
