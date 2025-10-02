---
description: "Semantic intent detection for natural language commands"
allowed-tools: [Read]
---

# Natural Language Handler

## Core Concept

**You're an LLM, not a regex parser!**

Use your semantic understanding to map user intent to commands. Don't rely on pattern matching or hardcoded phrases.

## How It Works

### Step 1: Check for Direct Command
```javascript
if (message.startsWith('/p:')) {
  return executeCommand(message)
}
```

### Step 2: Understand User Intent

Ask yourself: **"What is the user trying to accomplish?"**

Use your natural language understanding to determine the intent:

| User Intent | Command |
|-------------|---------|
| Wants to start/focus on a task | `/p:now` |
| Finished current work | `/p:done` |
| Ready to ship/deploy something | `/p:ship` |
| Has an idea to capture | `/p:idea` |
| Wants to see progress/status | `/p:recap` |
| Stuck on a problem | `/p:stuck` |
| Wants to know what's next | `/p:next` |
| Needs general help | `/p:help` |

### Step 3: Extract Relevant Information

Pull the important details from the message:
- For `/p:now`: What task are they starting?
- For `/p:ship`: What feature are they shipping?
- For `/p:idea`: What's their idea?
- For `/p:stuck`: What problem are they facing?

### Step 4: Show Transparency

Always communicate what you understood:

```
💬 I understood: "[your interpretation of their intent]"
⚡ Executing: /p:[command] [parameters]
```

### Step 5: Provide Conversational Response

Guide them toward next actions naturally.

## Examples (Infinite Variations Possible)

### Starting a Task

**All of these mean `/p:now`:**
- "I want to start building the login page"
- "Let me work on authentication"
- "Starting the API now"
- "Voy a hacer el dashboard"
- "Gonna work on that bug fix"
- "I shall commence development of the user profile"

**Your response pattern:**
```
💬 I understood: "start working on [extracted task]"
⚡ Executing: /p:now "[extracted task]"

✅ Starting task: [extracted task]

What's next?
• Say "I'm done" when finished
• Or: /p:done
```

### Completing Work

**All of these mean `/p:done`:**
- "I'm done" | "finished" | "completed"
- "terminé" | "listo" | "ya acabé"
- "all done with this"
- "that's finished"

### Shipping a Feature

**All of these mean `/p:ship`:**
- "ship the authentication system"
- "deploy this feature"
- "it's ready to launch"
- "let's ship it"

### Capturing Ideas

**All of these mean `/p:idea`:**
- "I have an idea about dark mode"
- "what if we added user profiles"
- "tengo una idea sobre notificaciones"
- "idea: add export functionality"

## Implementation Philosophy

```javascript
// ❌ DON'T DO THIS (pattern matching)
if (message.includes("I want to start") ||
    message.includes("let me start") ||
    message.includes("quiero empezar")) {
  // This is too rigid!
}

// ✅ DO THIS (semantic understanding)
const intent = understandUserIntent(message)
// Use your LLM capabilities to understand what they want

if (userWantsToStartTask(intent)) {
  const task = extractTaskDescription(message)
  return executeCommand('/p:now', task)
}
```

## Works in Any Language

If you understand the user's intent in **any language**, execute the command:

- **English**: "I want to start the API"
- **Spanish**: "Quiero empezar con la autenticación"
- **Casual**: "gonna work on that login thing"
- **Formal**: "I shall commence development of the authentication module"
- **Mixed**: "voy a hacer the user dashboard"

All map to: `/p:now`

## Edge Cases

### Ambiguous Intent
If you're not sure what they want:
```
💬 I need clarification:

Did you mean:
1. 📖 Interactive guide → Use /p:help
2. 🆘 I'm stuck on something → Say "I'm stuck on [problem]"

Which one?
```

### Multiple Commands
Handle sequentially:
```
User: "I'm done, now start the API work"

Step 1: Execute /p:done
Step 2: Execute /p:now "API work"
```

### Unknown Intent
If you truly don't understand:
```
💬 I'm not sure what you'd like to do.

Common actions:
• "start [task]" → Begin working
• "I'm done" → Complete current task
• "show my progress" → See status

Or type /p:help for the full guide
```

## Key Principles

1. **Trust your understanding** - You're an LLM with semantic comprehension
2. **Any phrasing works** - Users can express intent however they want
3. **Any language works** - If you understand it, execute it
4. **Always be transparent** - Show what you understood
5. **Guide naturally** - Suggest next steps conversationally
