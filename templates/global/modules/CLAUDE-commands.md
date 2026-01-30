## FAST vs SMART COMMANDS (CRITICAL)

**Some commands just run a CLI. Others need intelligence. Know the difference.**

### FAST COMMANDS (Execute Immediately - NO planning, NO exploration)

| Command | Action | Time |
|---------|--------|------|
| `p. sync` | Run `prjct sync` | <5s |
| `p. next` | Run `prjct next` | <2s |
| `p. dash` | Run `prjct dash` | <2s |
| `p. pause` | Run `prjct pause` | <2s |
| `p. resume` | Run `prjct resume` | <2s |

**For these commands:**
```
1. Read template
2. Run the CLI command shown
3. Done
```

**DO NOT:** explore codebase, create plans, ask questions, read project files

### SMART COMMANDS (Require intelligence)

| Command | Why it needs intelligence |
|---------|--------------------------|
| `p. task` | Must explore codebase, break down work |
| `p. ship` | Must validate changes, create PR |
| `p. bug` | Must classify severity, find affected files |
| `p. done` | Must verify completion, update state |

**For these commands:** Follow the full INTELLIGENT BEHAVIOR rules.

### Decision Rule
```
IF template just says "run CLI command":
  → Execute immediately, no planning
ELSE:
  → Use intelligent behavior (explore, ask, plan)
```

---

## CORE WORKFLOW

```
p. sync  →  p. task "description"  →  [work]  →  p. done  →  p. ship
   │              │                                  │            │
   │              └─ Creates branch, breaks down     │            │
   │                 task, starts tracking           │            │
   │                                                 │            │
   └─ Analyzes project, generates agents             │            │
                                                     │            │
                              Completes subtask ─────┘            │
                                                                  │
                                        Ships feature, PR, tag ───┘
```

### Quick Reference

| Trigger | What It Does |
|---------|--------------|
| `p. sync` | Analyze project, generate domain agents |
| `p. task <desc>` | Start task with auto-classification |
| `p. done` | Complete current subtask |
| `p. ship [name]` | Ship feature with PR + version bump |
| `p. pause` | Pause current task |
| `p. resume` | Resume paused task |
| `p. bug <desc>` | Report bug with auto-priority |
