---
allowed-tools: [Read]
---

# p. next

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read State

READ `{globalPath}/storage/queue.json` (or empty array if doesn't exist)
READ `{globalPath}/storage/state.json`

## Step 3: Show Active Task Warning

```
IF state.currentTask exists AND currentTask.status == "active":
  OUTPUT:
  """
  ⚠️ Active task: {currentTask.description}

  Consider: `p. done` or `p. pause` before starting new work
  """
```

## Step 4: Display Queue

**Output (queue has items)**:
```
📋 Queue ({count})

1. {task_1.description} [{task_1.type}] {priority badge if high/critical}
2. {task_2.description} [{task_2.type}]
3. {task_3.description} [{task_3.type}]
...

Next:
- Start task → `p. task "{task_1.description}"`
- Add task → `p. task "description"`
- Report bug → `p. bug "description"`
```

**Output (empty queue)**:
```
📋 Queue is empty

Next:
- Add task → `p. task "description"`
- Report bug → `p. bug "description"`
- Capture idea → `p. idea "note"`
```

## Step 5: Roadmap View (if `p. next roadmap`)

IF arguments include "roadmap":

Group tasks by feature/epic and show completion percentage:

```
📊 Roadmap

Feature A (75% complete)
├─ ✅ Task 1
├─ ✅ Task 2
├─ ✅ Task 3
└─ ⬜ Task 4

Feature B (0% complete)
├─ ⬜ Task 5
└─ ⬜ Task 6

Next: `p. task` to continue work
```
