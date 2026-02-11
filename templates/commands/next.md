---
allowed-tools: [Bash]
---

# p. next

## ⚡ FAST COMMAND — Execute Immediately

```bash
prjct next
```

Parse the CLI output and display to the user.

If the current task is active, add:
```
⚠️ Active task detected. Consider `p. done` or `p. pause` first.
```

### Roadmap View (`p. next roadmap`)

If arguments include "roadmap":

```bash
prjct dash roadmap
```

---

## Output (queue has items)

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

## Output (empty queue)

```
📋 Queue is empty

Next:
- Add task → `p. task "description"`
- Report bug → `p. bug "description"`
- Capture idea → `p. idea "note"`
```
