---
allowed-tools: [Read]
description: "Interactive guide - talk naturally, no memorization needed"
---

# /p:help

## Usage
```
/p:help
```

## Purpose
Interactive guide for users who want to talk naturally without memorizing commands.

## Response

```
🎯 What do you want to do?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🚀 Start working on something
   Say: "I want to start [task]"
   Or: /p:now "task description"

2. ✅ I finished a task
   Say: "I'm done" or "finished"
   Or: /p:done

3. 🎉 Ship a feature
   Say: "ship [feature name]"
   Or: /p:ship "feature"

4. 💡 Capture an idea
   Say: "I have an idea about [thing]"
   Or: /p:idea "idea text"

5. 📊 See my progress
   Say: "show me my progress"
   Or: /p:recap

6. 🗺️ Plan ahead
   Say: "show my roadmap"
   Or: /p:roadmap

7. 🆘 I'm stuck on something
   Say: "I'm stuck on [problem]"
   Or: /p:stuck "issue description"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Pro tip: Just talk naturally!

   Instead of memorizing commands, tell me what you want:
   • "let me start building the login"
   • "I finished that"
   • "ship the authentication system"
   • "what should I work on next?"

   I understand both natural language and /p:* commands.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?
```

## Implementation Notes
- Always respond conversationally
- Detect user intent from natural language
- Map to appropriate /p:* command
- Show example in both natural + command format
