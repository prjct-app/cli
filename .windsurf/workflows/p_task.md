---
title: prjct task
invocable_name: p:task
description: Break down and execute complex tasks systematically using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Parse task description from arguments
4. Analyze task complexity and requirements
5. Break down into subtasks with dependencies
6. Create task breakdown in `~/.prjct-cli/projects/{projectId}/planning/tasks/{task-id}.md`
7. Add subtasks to `~/.prjct-cli/projects/{projectId}/core/next.md` with priority
8. Set first subtask to `~/.prjct-cli/projects/{projectId}/core/now.md`
9. Log task creation to memory
10. Display execution plan

# Response Format

```
📋 Task Breakdown: {task description}

🔍 Analysis:
- Complexity: {High/Medium/Low}
- Estimated Time: {timeframe}
- Dependencies: {list or "None"}

📦 Subtasks Created:

1. 🎯 {subtask 1} (Starting now)
   - Why: {reason}
   - Deliverable: {outcome}
   - Estimate: {time}

2. ⏳ {subtask 2}
   - Why: {reason}
   - Deliverable: {outcome}
   - Estimate: {time}
   - Depends on: #1

3. ⏳ {subtask 3}
   - Why: {reason}
   - Deliverable: {outcome}
   - Estimate: {time}
   - Depends on: #2

Total Estimate: {total time}

✅ Actions Taken:
- Created task breakdown file
- Added subtasks to priority queue
- Set first subtask as current focus

🎯 Let's start! Current task:
{subtask 1 description}

Use /p:done when complete to move to next subtask.
```

# Task Breakdown Strategy

1. **Understand Requirements**: Analyze what needs to be done
2. **Identify Dependencies**: What must happen first?
3. **Define Milestones**: Key deliverables within the task
4. **Chunk into Subtasks**: Each subtask should be ~1-4 hours
5. **Sequence Execution**: Order by dependencies and logic
6. **Estimate Effort**: Realistic time estimates per subtask

# Subtask Characteristics

Good subtasks are:
- **Atomic**: Can be completed in one session
- **Testable**: Clear success criteria
- **Valuable**: Produces tangible progress
- **Independent**: Minimal blocking dependencies
- **Sized Right**: 1-4 hours of focused work

# Task Tracking

Task breakdown file created at:
`~/.prjct-cli/projects/{id}/planning/tasks/{task-id}.md`

Contains:
- Original task description
- Analysis and breakdown
- Subtask list with status
- Dependencies map
- Progress tracking
- Completion notes

# Progress Workflow

1. `/p:task "Complex feature"` - Break down
2. `/p:now` shows first subtask (auto-set)
3. `/p:done` when complete → auto-advances to next subtask
4. Repeat until all subtasks complete
5. Final `/p:done` marks entire task complete
6. `/p:ship` to celebrate the feature

# Global Architecture Notes

- **Task Files**: `~/.prjct-cli/projects/{id}/planning/tasks/*.md`
- **Queue Integration**: `~/.prjct-cli/projects/{id}/core/next.md`
- **Current Task**: `~/.prjct-cli/projects/{id}/core/now.md`
- **Memory Logging**: `~/.prjct-cli/projects/{id}/memory/context.jsonl`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Use Case**: Complex features, refactoring, large implementations
