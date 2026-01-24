---
allowed-tools: [Read]
---

# p. next

```bash
prjct context next
```

READ `{globalPath}/storage/queue.json`
READ `{globalPath}/storage/state.json`

IF `currentTask` active → Show warning first

**Output (queue view)**:
```
📋 Queue ({count})

1. {task_1} [{priority}]
2. {task_2}
3. {task_3}
...

Next:
- Start task → `p. task "{task_1}"`
- Add task → `p. task "description"`
- Report bug → `p. bug "description"`
```

**Output (empty)**:
```
📋 Queue is empty

Next:
- Add task → `p. task "description"`
- Report bug → `p. bug "description"`
- Capture idea → `p. idea "note"`
```

**Roadmap view** (`p. next roadmap`):
Group by feature, show completion %
