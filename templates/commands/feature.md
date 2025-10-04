---
allowed-tools: [Read, Write, Bash]
description: "Add new feature with roadmap and tasks"
---

# /p:feature

## Usage
```
/p:feature "<description>"
```

## Flow
1. Analyze: if feature makes sense now vs later
2. Create: mini-roadmap for this feature only
3. Break down: into 5 tasks maximum
4. Write: tasks to `core/next.md`
5. Show: task list to user
6. Ask: "¿Empezamos con tarea 1?"
7. If yes: Auto-start first task

## Value Analysis
```
Feature: {description}

Value Analysis:
• Impact: {high/medium/low}
• Effort: {hours estimation}
• Timing: {now/later/blocked_by}
• Recommendation: {do_now/defer/needs_X_first}
```

## Task Breakdown
```
Roadmap: {feature_name}

Tasks (max 5):
1. [ ] {task_1}
2. [ ] {task_2}
3. [ ] {task_3}
4. [ ] {task_4}
5. [ ] {task_5}

Estimated: {total_hours}h
```

## Response
```
✅ Feature roadmap created!

{feature_name}
📊 Value: {impact} | Effort: {hours}h
⏰ Recommendation: {timing_advice}

Tasks:
1. {task_1}
2. {task_2}
...

¿Empezamos con tarea 1?

/p:done (when task complete) | /p:ship (when feature complete)
```

## Example
```
User: p. feature "agregar unit testing"

Claude analyzes:
- Impact: HIGH (quality improvement)
- Effort: 8h
- Timing: NOW (before shipping more features)

Tasks created:
1. Setup Jest/Vitest configuration
2. Write tests for core utilities
3. Write tests for components
4. Add CI/CD test runner
5. Update docs with testing guide

"¿Empezamos con tarea 1: Setup Jest/Vitest?"
```
