---
allowed-tools: [Read]
description: 'Interactive contextual guide - helps users based on their current state'
---

# /p:help

## Purpose

Contextual help system that analyzes project state and provides relevant guidance. Different responses based on user's current situation.

## Flow

1. **Check project state**: Read core files if initialized
2. **Determine context**: What state is the user in?
3. **Provide relevant help**: Suggestions based on context
4. **Show examples**: Concrete examples for their situation

## Response Based on Context

### Context 1: Project Not Initialized

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 WELCOME TO PRJCT!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ship Fast. No BS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 FIRST STEP: Initialize

For existing project:
  /p:init

For new blank project:
  /p:init "your idea here"
  → Activates ARCHITECT MODE
  → Conversational setup
  → Tech stack recommendations

━━━━━━━━━━━━━━━━━━━━━━━━━━━

After init, I'll help you:
  • Break down features into tasks
  • Track your progress
  • Ship faster

Let's start! 🎉
```

### Context 2: Initialized, No Active Task, Empty Queue

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WHAT DO YOU WANT TO DO?
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Your status:
  • Project: initialized ✅
  • Active task: none
  • Queue: empty
  • Ready to work!

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMENDED NEXT STEPS:

1. 🚀 Add a feature
   Tell me what you want to build:
   → /p:feature "add dark mode"
   → /p:feature "implement auth"
   → /p:feature "optimize performance"

   I'll analyze value, break it into tasks, and start working!

2. 🔍 Analyze your project
   → /p:analyze
   Find TODOs, improvements, and opportunities

3. 📋 See your roadmap
   → /p:roadmap
   View planned features and progress

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 TALK NATURALLY:

You can just tell me:
  "I want to add authentication"
  "Help me optimize the app"
  "What should I do?"

I understand! No need to memorize commands.

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆘 NEED MORE HELP?

→ /p:ask "what you want to do"
  (I'll guide you step by step)

→ /p:suggest
  (I'll analyze and recommend actions)
```

### Context 3: Initialized, Has Active Task

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 HELP - CURRENT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Your status:
  • Working on: "{current_task}"
  • Started: {time_ago}
  • Queue: {N} tasks waiting

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 WHAT YOU CAN DO:

1. ✅ Finished current task?
   → /p:done
   Marks complete, moves to next automatically

2. ❓ Stuck or need help?
   → /p:stuck "{what's blocking you}"
   I'll help troubleshoot

3. 📊 See what's next?
   → /p:next
   View your priority queue

4. 🎯 Check progress?
   → /p:status (visual dashboard)
   → /p:recap (detailed overview)

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 OR JUST TELL ME:

  "I'm done"
  "I'm stuck with X"
  "What's next?"
  "Show me my progress"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️  ACTIVE TASK INFO:

Task: {current_task}
Duration: {duration}
Started: {timestamp}

Focus on one task at a time → Ship faster!
```

### Context 4: Initialized, No Active Task, Has Queue

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 HELP - READY TO WORK!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Your status:
  • Active task: none
  • Queue: {N} tasks ready
  • Last ship: {time_ago}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMENDED ACTIONS:

1. ⚡ Start working (RECOMMENDED)
   → /p:next
   See your top 5 priority tasks

   → /p:build 1
   Start task #1 immediately

   → /p:build "task name"
   Start specific task

2. 📊 Check your progress
   → /p:status (visual dashboard)
   → /p:recap (detailed overview)

3. 💡 Add new feature
   → /p:feature "{description}"
   Analyze, break down, and start

4. 🐛 Report a bug
   → /p:bug "{description}"
   Auto-prioritized and queued

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 OR JUST SAY:

  "Show me what's next"
  "Start task 1"
  "I want to work on X"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TIP:

You have {N} tasks waiting!
→ /p:suggest for personalized recommendations
```

### Context 5: Lost/Confused

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆘 HOW CAN I HELP?
━━━━━━━━━━━━━━━━━━━━━━━━━━━

No worries! Let me guide you.

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CHOOSE YOUR SCENARIO:

1. 💡 "I want to build something new"
   → /p:feature "{what you want to build}"

   Examples:
   • /p:feature "add user authentication"
   • /p:feature "improve performance"
   • /p:feature "redesign homepage"

2. 🐛 "Something is broken"
   → /p:bug "{description}"

   Example:
   • /p:bug "login button not working"

3. ❓ "I don't know what to do"
   → /p:suggest
   I'll analyze your project and recommend

4. 📊 "I want to see my progress"
   → /p:status (visual)
   → /p:recap (detailed)

5. 🤔 "I need to understand something"
   → /p:ask "{what you want to do}"

   I'll translate your intent into actions!

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 REMEMBER:

You can talk naturally! Just tell me what you want:

  "I want to add dark mode"
  "Help me fix this bug"
  "What should I work on?"
  "I'm stuck with X"

I understand both:
  • Natural language ✅
  • Commands ✅
  • English & Spanish ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 PRJCT PHILOSOPHY:

Ship Fast. No BS.

  • One task at a time
  • Track progress automatically
  • Celebrate every ship
  • No ceremonies, no overhead

Just build and ship! 🎉
```

## Core Commands Reference

Always include at the end of contextual help:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 CORE COMMANDS (if you prefer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Planning:
  /p:feature "{desc}"  → Add feature with roadmap
  /p:roadmap          → View strategic plan
  /p:bug "{desc}"     → Report and track bug

Working:
  /p:next             → See priority queue
  /p:build {1-5}      → Start task
  /p:now              → Show current task
  /p:done             → Complete task

Shipping:
  /p:ship "{name}"    → Commit, push, celebrate

Progress:
  /p:status           → Visual dashboard
  /p:recap            → Detailed overview

Help:
  /p:ask "{intent}"   → Intent → Action guide
  /p:suggest          → Smart recommendations
  /p:stuck "{issue}"  → Get help

Setup:
  /p:init             → Initialize project
  /p:analyze          → Deep analysis

━━━━━━━━━━━━━━━━━━━━━━━━━━━

But remember: You can just talk naturally! 💬
```

## Key Principles

1. **Context-aware**: Different help based on state
2. **Actionable**: Always show what to do next
3. **Examples**: Concrete examples, not abstract
4. **Encouraging**: Positive, helpful tone
5. **Bilingual**: Support English and Spanish
6. **No jargon**: Simple, clear language
7. **Progressive**: Start simple, show depth if needed

## Validation

- **Optional**: Works before project initialized
- **Adaptive**: Response changes based on state
- **Read-only**: Never modifies files

## Success Criteria

After using `/p:help`, user should:
- ✅ Know exactly what to do next
- ✅ Understand they can talk naturally
- ✅ Feel confident to proceed
- ✅ Have concrete commands to try
- ✅ Not feel overwhelmed
