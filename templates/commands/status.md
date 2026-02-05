---
allowed-tools: [Read, Bash]
---

# p. status

Visual workflow status showing current position in the prjct lifecycle.

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read State and Context

READ:
- `{globalPath}/storage/state.json` → current task, paused, previous
- `{globalPath}/storage/queue.json` → upcoming tasks
- `{globalPath}/storage/shipped.json` → recent ships
- `{globalPath}/project.json` → lastSync timestamp

```bash
# Get staleness info
prjct status --json 2>/dev/null || echo '{"isStale": false}'
```

## Step 3: Determine Workflow Position

Based on state.json, determine current position:

```
IF no currentTask AND no previousTask:
  position = "ready"  # Ready to start (after sync)
ELSE IF currentTask.status == "active":
  position = "working"  # In task
ELSE IF currentTask.status == "in_review":
  position = "reviewing"  # PR open, waiting for merge
ELSE IF currentTask.status == "shipped":
  position = "shipped"  # Ready for next task
ELSE:
  position = "idle"
```

## Step 4: Calculate Progress

```
IF currentTask.subtasks exists:
  completed = count where status == "completed"
  total = subtasks.length
  percent = (completed / total) * 100
  progressBar = generateBar(percent, 10)  # 10 chars wide
```

Progress bar generation:
```
filled = floor(percent / 10)
empty = 10 - filled
bar = "█" × filled + "░" × empty
```

## Step 5: Format Subtask Tree

```
FOR EACH subtask in currentTask.subtasks:
  IF index == currentSubtaskIndex:
    prefix = "🔄"  # Current
  ELSE IF subtask.status == "completed":
    prefix = "✅"  # Done
  ELSE:
    prefix = "⬜"  # Pending

  connector = (index == last) ? "└─" : "├─"
  OUTPUT: "   {connector} {prefix} {subtask.description}"
```

---

## Output: Workflow Diagram

```
📊 WORKFLOW STATUS

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   sync ──▶ task ──▶ [work] ──▶ done ──▶ ship           │
│    ○        ○         ●         ○        ○             │
│                       ▲                                 │
│                    YOU ARE HERE                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Position indicators:
- `○` = not active
- `●` = current position
- Arrow indicates flow direction

---

## Output: Full Status

```
📊 WORKFLOW STATUS

┌─────────────────────────────────────────────────────────┐
│   sync ──▶ task ──▶ work ──▶ done ──▶ ship             │
│    {s}       {t}      {w}      {d}      {h}            │
└─────────────────────────────────────────────────────────┘

🎯 Current: {currentTask.parentDescription}
   Branch: {currentTask.branch}
   Type: {currentTask.type} | Started: {elapsed}
   {IF linearId: "Linear: {linearId}"}

   Progress: {progressBar} {completed}/{total} subtasks
   {subtask tree}

⏸️ Paused: {pausedTasks[0].description or "none"}

📋 Queue: {queueCount} tasks
{IF queueCount > 0:}
   • {queue[0].description}
   • {queue[1].description}
   {... up to 3}

🚀 Last ship: {previousTask.description} ({daysSince})
   {IF previousTask.prUrl: "PR: {prUrl}"}

📡 Context: {staleness status}
   Last sync: {timeSinceSync}
   {IF isStale: "⚠️ Run `p. sync` to refresh"}
```

---

## Output: Compact (`p. status compact`)

Single-line summary:

```
{position_emoji} {currentTask.description} │ {progressBar} {completed}/{total} │ 📋 {queueCount} │ {staleness_emoji}
```

Position emojis:
- 🔄 = working
- 👀 = reviewing
- ✅ = shipped
- 💤 = idle

Staleness emojis:
- ✅ = fresh
- ⚠️ = stale

---

## Output: No Active Task

```
📊 WORKFLOW STATUS

┌─────────────────────────────────────────────────────────┐
│   sync ──▶ task ──▶ work ──▶ done ──▶ ship             │
│    ●        ○        ○        ○        ○               │
└─────────────────────────────────────────────────────────┘

💤 No active task

📋 Queue: {queueCount} tasks
{IF queueCount > 0:}
   • {queue[0].description}

🚀 Last ship: {previousTask.description} ({daysSince})

Next: `p. task "description"` or `p. task PRJ-XXX`
```

---

## Elapsed Time Formatting

```
IF minutes < 60: "{minutes}m"
ELSE IF hours < 24: "{hours}h {minutes}m"
ELSE: "{days}d {hours}h"
```

---

## Context Staleness

From `prjct status --json`:
```json
{
  "isStale": true,
  "commitsSinceSync": 15,
  "daysSinceSync": 3,
  "significantChanges": ["package.json", "tsconfig.json"]
}
```

Display:
- Fresh (< 10 commits, < 3 days): `✅ Fresh (synced {time} ago)`
- Stale: `⚠️ Stale ({commits} commits, {days}d) - run p. sync`
