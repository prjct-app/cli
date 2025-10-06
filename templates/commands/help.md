---
allowed-tools: [Read]
description: 'Interactive contextual guide - helps users based on their current state'
---

# /p:help

## Purpose

Contextual help that analyzes project state and provides relevant guidance based on user's current situation.

## Flow

1. **Check project state**: Read core files if initialized
2. **Determine context**: What state is the user in?
3. **Provide relevant help**: Suggestions based on context
4. **Show examples**: Concrete examples for their situation

## Context-Based Responses

### 1. Not Initialized
→ Show welcome, explain `/p:init` vs `/p:init "idea"` (ARCHITECT MODE)

### 2. Empty Queue + No Active Task
→ Suggest: `/p:feature "{desc}"`, `/p:analyze`, `/p:roadmap`
→ Emphasize: Can talk naturally, no need to memorize commands

### 3. Has Active Task
→ Show: current task, duration, started time
→ Suggest: `/p:done` (finished?), `/p:stuck "{issue}"` (blocked?), `/p:next` (see queue?)
→ Emphasize: Focus on one task → Ship faster

### 4. Has Queue, No Active Task
→ Suggest: `/p:next` (see top 5), `/p:build 1` (start #1), `/p:build "{name}"` (start specific)
→ Show: queue size, last ship time
→ Tip: `/p:suggest` for personalized recommendations

### 5. Lost/Confused
→ Show 5 scenarios with examples:
  - Want to build? → `/p:feature "{desc}"`
  - Something broken? → `/p:bug "{desc}"`
  - Don't know what to do? → `/p:suggest`
  - See progress? → `/p:status` or `/p:recap`
  - Need guidance? → `/p:ask "{what you want}"`
→ Emphasize: Natural language works (English & Spanish)

## Response Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 HELP - {CONTEXT_TITLE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Your status:
  • {relevant_state_info}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMENDED ACTIONS:

1. {action_1}
   → {command_or_natural_language}

2. {action_2}
   → {command_or_natural_language}

3. {action_3}
   → {command_or_natural_language}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 OR JUST SAY:
  "{natural_example_1}"
  "{natural_example_2}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 CORE COMMANDS:
Planning: /p:feature, /p:roadmap, /p:bug
Working: /p:next, /p:build, /p:done
Shipping: /p:ship
Progress: /p:status, /p:recap
Help: /p:ask, /p:suggest, /p:stuck
```

## Validation

- **Optional**: Works before project initialized
- **Read-only**: Never modifies files
- **Adaptive**: Response changes based on state
