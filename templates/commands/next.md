---
allowed-tools: [Read]
description: 'Show priority queue'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/queue.json'
claude-context: 'context/next.md'
---

# /p:next - Show Priority Queue

## Architecture: Write-Through Pattern

Reads from **Storage (JSON)** as source of truth.

**Source of Truth**: `storage/queue.json`
**Also reads**: `storage/state.json` for current task status

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{queuePath}`: `{globalPath}/storage/queue.json`
- `{statePath}`: `{globalPath}/storage/state.json`

## Flow

1. Read `storage/state.json` → Check if active task
2. Read `storage/queue.json` → Get queue tasks
3. Display top 5 non-blocked tasks

## Response

**If active task**:
```
⚠️ Active: {currentTask.description}

Complete with /p:done first, or:

📋 Queue ({count})
1. {task_1}
2. {task_2}
3. {task_3}
...

Start: /p:work {N}
```

**If no active task**:
```
📋 Queue ({count})

1. {task_1} {priority}
2. {task_2} {priority}
3. {task_3} {priority}
4. {task_4}
5. {task_5}

{IF count > 5: ... and {count - 5} more}

Start: /p:work 1 or /p:now "{task}"
```

**If empty queue**:
```
📋 Queue is empty

Add tasks:
• /p:feature "description"
• /p:bug "description"
• /p:idea "quick note"
```

## Data Source

| Data | Storage File | Field |
|------|--------------|-------|
| Current Task | `storage/state.json` | `currentTask` |
| Queue Tasks | `storage/queue.json` | `tasks[]` |
| Shipped | `storage/shipped.json` | `shipped[]` |

## Usage Variants

```
/p:next                    # Priority queue (default)
/p:next roadmap            # Feature-grouped view
/p:next --roadmap          # Same as above
```

## Roadmap View

When called with `roadmap` parameter, show feature-grouped view:

```
📍 PRODUCT ROADMAP

🚀 Current Sprint
├── ✅ {completed_feature} - shipped {date}
├── 🔄 {active_feature} ({X}% complete)
│   └── 🎯 {current_task}
└── ⏳ {pending_feature} ({N} tasks)

📅 Next Up ({N} features)
├── {feature_1} - {effort}
└── {feature_2} - {effort}

📊 Velocity: {X.X} features/week

/p:now "{next}" | /p:done
```

### Roadmap Data Aggregation

1. Group queue tasks by `featureId`
2. Calculate completion % per feature
3. Sort by priority/dependency
4. Show current task within active feature

## Natural Language Support

- "p. next" → Priority queue
- "p. queue" → Priority queue
- "p. what's next" → Priority queue
- "p. roadmap" → Roadmap view
- "p. features" → Roadmap view
