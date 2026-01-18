---
allowed-tools: [Read]
---

# p. dash

```bash
prjct context dash
```

READ all storage files:
- `{globalPath}/storage/state.json` → current/paused task
- `{globalPath}/storage/queue.json` → queue
- `{globalPath}/storage/shipped.json` → ships
- `{globalPath}/storage/ideas.json` → ideas

**Output (default)**:
```
📊 DASHBOARD

🎯 Current: {task} ({elapsed})
⏸️ Paused: {paused_task or "None"}

📋 Queue ({count})
• {task_1}
• {task_2}

🚀 Recent: {last_ship} ({days}d ago)
💡 Ideas: {count}

Next:
- Finish → `p. done`
- Ship → `p. ship`
- Queue → `p. next`
```

**Compact** (`p. dash compact`):
```
🎯 {task} | 📋 {queue} | 🚀 {days}d ago
```

**Week/Month** (`p. dash week`):
Show completed tasks, velocity, focus time
