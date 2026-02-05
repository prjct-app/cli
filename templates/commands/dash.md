---
allowed-tools: [Read, Bash]
---

# p. dash

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read All Storage Files

READ all storage files:
- `{globalPath}/storage/state.json` → current/paused tasks
- `{globalPath}/storage/queue.json` → queue (or empty array)
- `{globalPath}/storage/shipped.json` → shipped features (or empty array)
- `{globalPath}/storage/ideas.json` → ideas (or empty array)

## Step 3: Calculate Metrics

```
currentTask = state.currentTask
pausedTasks = state.pausedTasks || []
queueCount = queue.length
shippedCount = shipped.length
ideasCount = ideas.length

IF currentTask:
  elapsed = time since currentTask.startedAt (or resumedAt)

IF shipped.length > 0:
  lastShip = shipped[0]
  daysSinceLastShip = days since lastShip.shippedAt
```

---

## Output (default)

```
📊 DASHBOARD

🎯 Current: {currentTask.parentDescription or currentTask.description} ({elapsed})
   Subtask: {current subtask if exists}
⏸️ Paused: {pausedTasks[0].description or "None"}

📋 Queue ({queueCount})
• {queue[0].description}
• {queue[1].description}
{... up to 5 items}

🚀 Recent: {lastShip.description} ({daysSinceLastShip}d ago)
💡 Ideas: {ideasCount}

Next:
- Finish → `p. done`
- Ship → `p. ship`
- Queue → `p. next`
```

---

## Compact View (`p. dash compact`)

```
🎯 {currentTask.description} | 📋 {queueCount} | 🚀 {daysSinceLastShip}d ago
```

---

## Week View (`p. dash week`)

Calculate from events.jsonl:
- Tasks completed this week
- Time spent (sum of task durations)
- Velocity (tasks/day)

```
📊 This Week

Completed: {count} tasks
Time: {hours}h focused
Velocity: {tasks_per_day}/day

Top areas:
- {area_1}: {count} tasks
- {area_2}: {count} tasks
```

---

## Month View (`p. dash month`)

Same as week, but for last 30 days. Show weekly trends.
