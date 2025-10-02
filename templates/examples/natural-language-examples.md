# Natural Language Examples

Real-world examples showing how the **semantic intent detection** works.

> **Important**: These are examples, not the only valid phrases! The LLM understands intent semantically, so users can express themselves in countless ways.

## Example 1: Starting a Task

**User says (any of these work):**
- "I want to start building the user authentication system"
- "Let me work on the auth flow"
- "Starting the login feature now"
- "Voy a hacer la autenticación de usuarios"

**Claude Code understands:**
- Intent: User wants to start working on something
- Command: `/p:now`
- Parameter: [extracted task description]

**Claude Code response:**
```markdown
💬 I understood: "start working on building the user authentication system"
⚡ Executing: /p:now "building the user authentication system"

🎯 Working on: building the user authentication system
Started: 2:30 PM

When you're done:
• Say "I'm done" or "finished"
• Or: /p:done

Need help? Say "I'm stuck" or use /p:stuck
```

---

## Example 2: Completing a Task

**User says (any of these work):**
- "I'm done"
- "finished"
- "terminé"
- "all done with this"
- "completed it"

**Claude Code understands:**
- Intent: User finished their current work
- Command: `/p:done`

**Claude Code response:**
```markdown
💬 I understood: "task completion"
⚡ Executing: /p:done

✅ Task complete: building the user authentication system (2h 15m)

What's next?
• "start next task" → Begin working
• "ship this feature" → Track & celebrate
• "add new idea" → Brainstorm

Or use: /p:now | /p:ship | /p:idea
```

---

## Example 3: Shipping a Feature

**User says:**
```
ship the authentication system
```

**Claude Code response:**
```markdown
💬 I understood: "ship feature"
⚡ Executing: /p:ship "authentication system"

🚀 authentication system shipped!

📈 This week: 3 | Total: 12
Velocity: 1.2 features/day

Keep the momentum!
• "start next task" → Keep building
• "see my progress" → View stats
• "plan ahead" → Strategic thinking

Or use: /p:now | /p:recap | /p:roadmap
```

---

## Example 4: Capturing an Idea

**User says:**
```
I have an idea about adding dark mode to the dashboard
```

**Claude Code response:**
```markdown
💬 I understood: "capture idea"
⚡ Executing: /p:idea "adding dark mode to the dashboard"

💡 Idea captured: adding dark mode to the dashboard

Ready to start?
• "start this" → Begin now
• "plan more" → Keep brainstorming
• "see ideas" → View backlog

Or use: /p:now | /p:idea | /p:recap
```

---

## Example 5: Viewing Progress

**User says:**
```
show me my progress
```

**Claude Code response:**
```markdown
💬 I understood: "view progress"
⚡ Executing: /p:recap

📊 Recap

🎯 Current: building user dashboard
🚀 Shipped: 3
📝 Queue: 5
💡 Ideas: 8

Recent: authentication system (2h ago)
```

---

## Example 6: Getting Help

**User says:**
```
I'm stuck on this CORS error with the API
```

**Claude Code response:**
```markdown
💬 I understood: "need help"
⚡ Executing: /p:stuck "CORS error with the API"

🆘 Let's solve: CORS error with the API

Common solutions:
1. Add CORS headers to API responses
2. Configure proxy in development
3. Check credentials mode

Need to break this down?
• "start fixing CORS" → Focus on solution
• "add as task" → Queue for later
```

---

## Example 7: Viewing Queue

**User says:**
```
what should I work on next?
```

**Claude Code response:**
```markdown
💬 I understood: "view queue"
⚡ Executing: /p:next

📋 Priority Queue

1. Fix login bug (Priority: High)
2. Add user profile page
3. Implement password reset
4. Add email verification
5. Create admin dashboard

Ready to start?
• Say "start [task]"
• Or: /p:now "[task]"
```

---

## Example 8: Any Language Works

**User says (Spanish):**
```
quiero empezar a trabajar en la página de login
```

**Claude Code understands:**
- Intent: User wants to start working (expressed in Spanish)
- Command: `/p:now`
- Parameter: "trabajar en la página de login"

**Claude Code response:**
```markdown
💬 I understood: "start working on the login page"
⚡ Executing: /p:now "trabajar en la página de login"

🎯 Working on: trabajar en la página de login
Started: 2:30 PM

When you're done:
• Say "I'm done" or "terminé"
• Or: /p:done

Need help? Say "I'm stuck" or use /p:stuck
```

> **Note**: The LLM can respond in the user's language or English - both work!

---

## Example 9: Mixed Commands

**User says:**
```
I'm done with the login, now I want to start the API work
```

**Claude Code response:**
```markdown
💬 I understood: "complete task + start new task"
⚡ Executing: /p:done → /p:now "API work"

✅ Task complete: login page (1h 45m)

🎯 Working on: API work
Started: 4:15 PM

What's next?
• Say "I'm done" when finished
• Or: /p:done
```

---

## Example 10: Ambiguous Input

**User says:**
```
help
```

**Claude Code response:**
```markdown
💬 I need clarification:

Did you mean:
1. 📖 Interactive guide → Use /p:help
2. 🆘 I'm stuck on something → Say "I'm stuck on [problem]" or use /p:stuck

Which one?
```

---

## Implementation Notes

### Semantic Understanding (Not Pattern Matching!)

**Key Principle**: The LLM understands intent semantically, not through regex or hardcoded phrases.

```javascript
// ❌ DON'T DO THIS
if (message.includes("I want to start")) {
  // Too rigid!
}

// ✅ DO THIS
// Use your LLM understanding:
// "What is the user trying to accomplish?"
const intent = semanticallyUnderstand(message)
```

### Detection Flow
1. **Check for `/p:` commands** - Execute directly if present
2. **Understand user intent** - What are they trying to do?
3. **Map to appropriate command** - Based on semantic meaning
4. **Extract parameters** - Pull relevant information
5. **Show transparency** - Communicate what you understood
6. **Execute and respond** - Run command and guide next steps

### Transparency Format
Always show what you understood:
```
💬 I understood: "[your interpretation of their intent]"
⚡ Executing: /p:[command] [params]
```

### Multilingual Support
If you understand the intent in **any language**, execute it:
- **English**: "I want to start the API"
- **Spanish**: "Quiero empezar con la autenticación"
- **Casual**: "gonna work on that bug"
- **Formal**: "I shall commence development"
- **Mixed**: "voy a hacer the dashboard"

**All work!** Trust your semantic understanding.

### Parameter Extraction
Pull the meaningful information from the message:
- **For `/p:now`**: What task are they describing?
- **For `/p:ship`**: What feature are they shipping?
- **For `/p:idea`**: What's their idea?
- **For `/p:stuck`**: What problem are they facing?

Use context and understanding, not string manipulation!
