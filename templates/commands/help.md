---
allowed-tools: [Read]
description: 'Contextual help'
---

# /p:help

## Flow
Check state → Determine context → Show relevant help

## Contexts
1. **Not init**: Show `/p:init` guide
2. **Empty**: Suggest `/p:feature` or `/p:analyze`
3. **Active task**: Show task, suggest `/p:done`
4. **Has queue**: Suggest `/p:work 1`
5. **Lost**: Show all options with examples

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
