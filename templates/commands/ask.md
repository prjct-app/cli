---
allowed-tools: [Read]
description: 'Conversational intent to action translator - helps users understand what to do'
---

# /p:ask

## Purpose

Translate natural language intent into actionable prjct command flows. Helps users who know WHAT they want but don't know HOW.

## Flow

1. **Understand intent**: Parse user's natural language description
2. **Analyze context**: Read project state (`core/now.md`, `core/next.md`, `planning/roadmap.md`)
3. **Recommend flow**: Suggest specific command sequence with explanations
4. **Ask confirmation**: Interactive - don't execute automatically

## Intent Categories

**1. Feature Development**: "add", "implement", "create", "build"
→ `/p:feature "{desc}"` → `/p:done` (iterate) → `/p:ship "{name}"`

**2. Performance/Optimization**: "optimize", "improve", "faster", "memory leak"
→ `/p:feature "optimize {area}"` → `/p:build 1` → `/p:done` → `/p:ship "optimization"`

**3. Bug Fixing**: "bug", "error", "fix", "broken", "not working"
→ `/p:bug "{desc}"` → `/p:build "{bug task}"` → `/p:done` → `/p:ship "bug fixes"`

**4. Design/Architecture**: "design", "architecture", "structure", "plan"
→ `/p:design {target} --type {architecture|api|component|database|flow}` → `/p:feature "implement {design}"` → `/p:build 1`

**5. Lost/Confused**: "don't know", "help", "stuck", "what should"
→ `/p:suggest` (context-aware recommendations) OR `/p:help` (interactive guide)

## Response Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 I understand: {interpreted_intent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 YOUR CONTEXT:
  • Current state: {current_state}
  • Active tasks: {active_tasks}
  • Last ship: {time_ago}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMENDED FLOW:

{step_by_step_command_flow}

Each step explained:
→ {command_1}: {why_this_command}
→ {command_2}: {what_it_does}
→ {command_3}: {expected_outcome}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Would you like me to execute step 1?
```

## Validation

- **Optional**: Can run without project initialized (suggests `/p:init` if needed)
- **Read-only**: Never modifies files, only recommends

## Edge Cases

**No prjct project**: Suggest `/p:init` or `/p:init "idea"` first
**Vague request**: Ask for more details - feature? bug? optimization? not sure?
**Active task exists**: Offer options - finish first (recommended) or add to queue
