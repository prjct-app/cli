# Natural Language Examples

Real-world examples showing how **Claude Code** handles natural language with context validation.

> **Important**: These are examples, not the only valid phrases! Claude understands intent semantically, so users can express themselves in countless ways.

> **Note**: All examples show how **Claude Code automatically validates context** and provides conversational responses when context is missing.

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

## Example 2: Completing a Task (WITH Active Task)

**Context:** User has an active task in `core/now.md`

**User says (any of these work):**
- "I'm done"
- "finished"
- "terminé"
- "all done with this"
- "completed it"

**Claude Code checks:**
- Project exists: ✅
- Active task exists: ✅
- Context valid: Execute command

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

## Example 2b: Completing a Task (NO Active Task)

**Context:** User has NO active task (empty `core/now.md`)

**User says:**
- "I'm done"
- "finished"
- "terminé"

**Claude Code checks:**
- Project exists: ✅
- Active task exists: ❌
- Context invalid: Return conversational response

**Claude Code response (NO command execution):**
```markdown
✨ You're not working on anything right now!

Want to start something?
• Tell me what you want to build
• Say "show me what's next"
• Or use: /p:now | /p:next

Let's ship something!
```

**Why this is better:** Instead of showing a technical error like "⏺ No hay tarea activa en este momento...", Claude provides a friendly, actionable response that guides the user forward.

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

## Example 3b: Shipping a Feature (NO Work Done Yet)

**Context:** User has NO active task and NO shipped features

**User says:**
- "ship this"
- "deploy it"
- "let's launch"

**Claude Code checks:**
- Project exists: ✅
- Has work to ship (active task OR shipped features): ❌
- Context invalid: Return conversational response

**Claude Code response (NO command execution):**
```markdown
🚀 Nothing to ship yet!

First, let's build something:
• Tell me what feature you want to create
• Say "start building [feature]"
• Or use: /p:now "feature name"

Then we'll celebrate when you ship it!
```

**Why this is better:** Instead of confusing the user with an error, Claude guides them toward the correct workflow: build first, ship later.

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

## Example 11: p. Trigger (NEW - Zero Memorization)

**Context:** User doesn't want to memorize `/p:*` commands

**User says:**
```
p. analiza todo este documento y dame el roadmap
```

**Claude Code detects:**
- Trigger: `p.` detected
- Validates: `.prjct/prjct.config.json` exists ✅
- Intent: "analysis" + "roadmap"
- Command: `/p:analyze`

**Claude Code response:**
```markdown
💬 I understood: "analyze document and create roadmap" (prjct context)
⚡ Executing: /p:analyze

[Performs repository analysis]

📊 Analysis complete. Creating roadmap...

[Shows roadmap suggestions]

Ready to plan?
• Say "p. add to roadmap" or use /p:roadmap
• Or continue working on current task
```

---

## Example 12: p. Trigger Multi-Language

**User says (Spanish):**
```
p. estoy listo para shipear esta feature
```

**Claude Code detects:**
- Trigger: `p.` detected
- Validates: Project exists ✅
- Intent: "ship" (detected from "shipear")
- Command: `/p:ship`

**Claude Code response:**
```markdown
💬 I understood: "ready to ship this feature" (prjct context)
⚡ Executing: /p:ship

What feature did you ship?
• Tell me the feature name
• Or use: /p:ship "feature name"
```

---

## Example 13: p. Trigger Without Project

**Context:** User tries p. trigger in non-prjct directory

**User says:**
```
p. muéstrame mi progreso
```

**Claude Code checks:**
- Trigger: `p.` detected
- Validates: `.prjct/prjct.config.json` NOT found ❌

**Claude Code response (NO command execution):**
```markdown
🎯 No prjct project here!

This doesn't look like a prjct directory.

Want to initialize?
• Say "initialize prjct" or "set up project"
• Or use: /p:init

Then you can track progress with p. commands!
```

**Why this is better:** The `p.` trigger is **context-aware** - it only works in prjct directories, preventing accidental execution.

---

## Example 14: All Three Ways Work

**Scenario:** User can choose their preferred style

**Option 1 - p. Trigger (easiest):**
```
User: "p. terminé"
Claude: Detects completion intent → /p:done
```

**Option 2 - Direct slash command:**
```
User: "/p:done"
Claude: Executes directly
```

**Option 3 - Natural language:**
```
User: "I'm done"
Claude: Detects intent → /p:done
```

**All three execute the same command!** Users pick what feels natural to them.

---

## Implementation Notes

### How Claude Code Handles Natural Language

**Key Principle**: Claude Code (and Claude Desktop) automatically handle intent detection, context validation, and conversational responses through **CLAUDE.md instructions**. No SDK needed!

**How it works:**

1. **CLAUDE.md is automatically read** - Both Claude Code and Desktop read this file for context
2. **Claude understands intent naturally** - As an LLM, Claude semantically understands what users want
3. **Simple file checks validate context** - Read `core/now.md`, check if `.prjct/prjct.config.json` exists
4. **Conversational responses when context missing** - Friendly guidance instead of errors
5. **Multi-language support** - Works in any language Claude understands

**Implementation:**

```javascript
// NO SDK NEEDED - Just use Claude Code's native capabilities:

// 1. Detect p. trigger or natural language intent
if (message.startsWith('p. ')) {
  // Check if prjct project exists
  const configExists = await Read('.prjct/prjct.config.json')
  if (!configExists) {
    return "🎯 No prjct project here! Run /p:init first."
  }
  // Extract intent from rest of message
  const intent = message.slice(3).trim()
  // Continue with semantic understanding...
}

// 2. Validate context before execution
if (command === 'done') {
  const nowContent = await Read('core/now.md')
  if (!nowContent || nowContent.trim() === '') {
    return conversationalResponse() // Friendly guidance
  }
}

// 3. Execute command with transparency
console.log(`💬 I understood: "${intent}"`)
console.log(`⚡ Executing: /p:${command} ${params}`)
```

### Detection Flow (Natural)
1. **Check for p. trigger** - Highest priority
   - If starts with `p.` → Check if `.prjct/prjct.config.json` exists
   - If exists → Extract intent from rest of message
   - If not exists → Return "No prjct project" message
2. **Parse user input** - Direct slash command or natural language?
3. **Understand intent semantically** - What does the user want to do?
4. **Validate context** - Simple file reads to check prerequisites
5. **Respond**:
   - Context missing → Provide conversational guidance
   - Context valid → Execute command with transparency
   - No command intent → Normal conversation
6. **Show transparency** - Always communicate what you understood
7. **Execute and guide** - Run command and suggest next steps

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
