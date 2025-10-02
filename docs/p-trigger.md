# p. Trigger - Zero Memorization Interface

## What is it?

The **p. trigger** is a simple prefix that signals you want to use prjct functionality, without memorizing any `/p:*` commands.

## How it works

Just start your message with `p.` and Claude Code will:
1. Check if you're in a prjct directory (`.prjct/prjct.config.json` exists)
2. Understand what you want to do from your message
3. Execute the appropriate command automatically

## Examples

### ✅ Instead of memorizing commands...

**Old way (requires memorization):**
```
/p:analyze
/p:done
/p:ship "authentication"
/p:progress week
```

**New way (just talk naturally):**
```
p. analiza todo este proyecto
p. terminé
p. shipea authentication
p. muéstrame progreso de la semana
```

### 🌍 Works in ANY language

**English:**
```
p. analyze this project
p. I'm done
p. show me my progress
p. start building the login page
```

**Spanish:**
```
p. analiza este proyecto
p. terminé
p. muéstrame mi progreso
p. empiezo a hacer la página de login
```

**German:**
```
p. analysiere dieses Projekt
p. fertig
p. zeige meinen Fortschritt
```

## Three Ways to Use prjct

You can choose what feels most natural:

### 1. p. Trigger (easiest)
```
p. [what you want]
```
No memorization needed!

### 2. Slash Commands (explicit)
```
/p:command [arguments]
```
For power users who want precision.

### 3. Natural Language (conversational)
```
I'm done
ship this feature
show me my progress
```
Just talk - Claude understands!

## Context-Aware Safety

The `p.` trigger **only works in prjct directories**:

✅ **In a prjct directory:**
```
You: p. muéstrame mi progreso
Claude: [Shows your progress]
```

❌ **In a non-prjct directory:**
```
You: p. muéstrame mi progreso
Claude: 🎯 No prjct project here! Run /p:init first.
```

This prevents accidental execution in the wrong directory.

## Common Use Cases

### Quick Status Check
```
p. progreso
p. recap
p. what's my current task
```

### Starting Work
```
p. start building authentication
p. empiezo con el dashboard
p. work on the API
```

### Completing Work
```
p. done
p. terminé
p. I'm finished
```

### Shipping Features
```
p. ship authentication system
p. deploy this
p. shipea la feature de pagos
```

### Getting Help
```
p. stuck on CORS error
p. need help with TypeScript
p. ayuda con este bug
```

### Planning
```
p. analyze this codebase
p. create a roadmap
p. add idea: dark mode
```

## Why This is Better

### Before (v0.4.x):
- ❌ Had to memorize 18 different `/p:*` commands
- ❌ Easy to forget syntax
- ❌ Felt rigid and technical

### After (v0.5.x with p. trigger):
- ✅ **Zero memorization** - Just say what you want
- ✅ **Natural** - Talk like a human
- ✅ **Safe** - Only works in prjct directories
- ✅ **Multi-language** - Works in any language
- ✅ **Flexible** - Three ways to use (p. | /p: | natural)

## Technical Details

The p. trigger is implemented in:
- `CLAUDE.md` - Instructions for Claude Code (and Desktop)
- `templates/examples/natural-language-examples.md` - Usage examples
- `docs/p-trigger.md` - Complete documentation

**How it works:**
- Claude Code and Claude Desktop automatically read `CLAUDE.md`
- Claude understands intent semantically (it's an LLM)
- Simple file checks validate context (`.prjct/prjct.config.json`, `core/now.md`)
- Conversational responses when context is missing

**Zero external dependencies:**
- No SDK required
- No API keys needed
- Uses Claude's existing session
- Works identically in Claude Code and Claude Desktop
- No additional costs for users

## Examples by Use Case

### Analysis & Planning
```
p. analiza este código
p. create a roadmap for Q1
p. what should I build next
p. estimate this feature
```

### Daily Work
```
p. now "building user dashboard"
p. I'm working on the API
p. done
p. ship user authentication
```

### Progress Tracking
```
p. progress this week
p. show shipped features
p. recap
p. context
```

### Problem Solving
```
p. stuck on authentication
p. help with database migration
p. fix CORS error
p. troubleshoot performance
```

### Ideation
```
p. idea: add dark mode
p. tengo una idea sobre notificaciones
p. brainstorm features
```

## Pro Tips

1. **Be natural** - The system understands intent, not keywords
2. **Any language works** - Spanish, English, German, whatever
3. **Mix and match** - Combine p. trigger with slash commands as needed
4. **Context-aware** - Always checks you're in the right directory
5. **Three ways work** - Pick what feels most natural to you

## Getting Started

1. Make sure you're in a prjct directory (run `/p:init` if not)
2. Start any message with `p.` followed by what you want
3. Claude Code handles the rest!

That's it. No memorization, no friction, just ship. 🚀
