---
allowed-tools: [Read, Write, Bash, GetTimestamp, GetDate]
description: 'Value analysis + roadmap + task breakdown + auto-start'
timestamp-rule: 'CRITICAL - ALWAYS use GetTimestamp() and GetDate() tools for ALL timestamps and dates. NEVER generate dates manually. LLM does not know current date.'
---

# /p:feature

## Usage

```
/p:feature "<description>"    # Direct description
/p:feature                     # Interactive mode with templates
```

## What It Does

1. **Value analysis**: Impact/effort/timing analysis
2. **Roadmap**: Positioning in project roadmap
3. **Task breakdown**: Smart breakdown into logical tasks
4. **Auto-start**: First task starts automatically

## Interactive Mode (No Parameters)

When executed without parameters, show 6 category templates:

**1. 🎨 UI/UX**: dark mode, redesign, responsiveness, animations
**2. ⚡ Performance**: load time, memory leaks, code splitting, API speed
**3. 🔐 Features**: authentication, payments, admin dashboard, notifications
**4. 🧪 Quality**: unit tests, E2E testing, error tracking, coverage
**5. 🐛 Bug Fixes**: refactoring, memory leaks, deprecated code, error handling
**6. 📚 Docs**: API docs, onboarding, developer setup, examples

User can: choose category number OR describe freely

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

**Use GetTimestamp() and GetDate() tools to get real system time:**

```jsonl
{"ts":"{GetTimestamp()}","type":"feature_add","name":"{feature}","tasks":{N},"impact":"{high/med/low}","effort":"{Xh}","status":"queued"}
```

## Index Update

Append to `planning/roadmap.md` (keep only last 30 days):

**Use GetDate() tool for current date:**

```markdown
## Queued
- [ ] {feature_name} ({N} tasks, {Xh} estimated) - Added {GetDate()}
```

If roadmap.md > 30 days old entries, archive to `planning/archive/roadmap-{YYYY-MM}.md`

## Value Analysis Format

```
Feature: {description}

Value Analysis:
• Impact: {high/medium/low}
• Effort: {hours estimation}
• Timing: {now/later/blocked_by}
• Recommendation: {do_now/defer/needs_X_first}
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

Ready to start with task 1?

/p:done (when task complete) | /p:ship (when feature complete)
```
