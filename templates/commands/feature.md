---
allowed-tools: [Read, Write, Bash]
description: 'Value analysis + roadmap + task breakdown + auto-start'
---

# /p:feature

## Usage

```
/p:feature "<description>"
```

## What It Does

1. **Value analysis**: Impact/effort/timing analysis
2. **Roadmap**: Positioning in project roadmap
3. **Task breakdown**: Smart breakdown into logical tasks
4. **Auto-start**: First task starts automatically

## Flow

1. Analyze value (impact/effort/timing)
2. Position in roadmap
3. Break down into logical tasks (as many as needed)
4. **Write to session**: Append to `planning/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl`
5. **Update index**: Add to `planning/roadmap.md` (lightweight, last 30 days only)
6. **Queue tasks**: Write to `core/next.md`
7. Auto-start first task

## Session Log Format

Append to `planning/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl`:

```jsonl
{"ts":"2025-10-04T14:30:00Z","type":"feature_add","name":"{feature}","tasks":{N},"impact":"{high/med/low}","effort":"{Xh}","status":"queued"}
```

## Index Update

Append to `planning/roadmap.md` (keep only last 30 days):

```markdown
## Queued
- [ ] {feature_name} ({N} tasks, {Xh} estimated) - Added 2025-10-04
```

If roadmap.md > 30 days old entries, archive them to `planning/archive/roadmap-{YYYY-MM}.md`

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

Tasks:
1. [ ] {task_1}
2. [ ] {task_2}
3. [ ] {task_3}
... (as many as needed)

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
