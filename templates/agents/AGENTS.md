# AGENTS.md

AI assistant guidance for prjct-cli.

## Talk Naturally

**You don't need to memorize commands** - just describe what you want to do!

The AI assistant uses **semantic understanding** to map your intent to commands. Works in **any language** the LLM understands (primarily English and Spanish).

**Examples:**
```
Intent: Start working on something
→ "I want to build the login page"
→ "Let me work on authentication"
→ "Voy a hacer el dashboard"
→ Command: /p:now

Intent: Finished current work
→ "I'm done" | "finished" | "terminé" | "completed"
→ Command: /p:done

Intent: Ship a feature
→ "ship this" | "deploy it" | "ready to launch"
→ Command: /p:ship
```

**Both work simultaneously:**
- Talk naturally: "I want to start building auth"
- Use commands directly: `/p:now "building auth"`

## Architecture

**Global**: `~/.prjct-cli/projects/{id}/`
```
core/        # now.md, next.md, context.md
progress/    # shipped.md, metrics.md
planning/    # ideas.md, roadmap.md
analysis/    # repo-summary.md
memory/      # context.jsonl
```

**Local**: `.prjct/prjct.config.json`

## MCP Servers

- **Context7**: Library docs (always on)
- **Filesystem**: File ops
- **Memory**: Persistence
- **Sequential**: Complex reasoning

## Quick Start

1. Initialize: `/p:init`
2. Type: `/p:help` for interactive guide
3. Or just talk: "I want to start [task]"

## Commands

**💡 Tip**: Type `/p:help` anytime for an interactive guide with natural language options.

| Command | Say This Instead | Action |
|---------|------------------|--------|
| `/p:help` | "help" or "what can I do?" | Interactive guide |
| `/p:init` | - | Create global dirs + config |
| `/p:now [task]` | "start [task]" | Update `core/now.md` |
| `/p:done` | "I'm done" or "finished" | Clear focus, suggest next |
| `/p:ship <feature>` | "ship [feature]" | Add to `progress/shipped.md` |
| `/p:next` | "what's next?" | Read `core/next.md` |
| `/p:idea <text>` | "I have an idea about [x]" | Append to `planning/ideas.md` |
| `/p:recap` | "show my progress" | Aggregate all metrics |
| `/p:progress [period]` | "how am I doing?" | Filter by timeframe |
| `/p:stuck <issue>` | "I'm stuck on [issue]" | Context-based guidance |
| `/p:context` | "show project context" | Display config + activity |
| `/p:roadmap` | "show the plan" | Read `planning/roadmap.md` |
| `/p:analyze` | "analyze this repo" | Generate `analysis/repo-summary.md` |
| `/p:task` | "break this down" | Multi-step execution |
| `/p:git` | - | Smart commits with context |
| `/p:fix` | "help me fix [x]" | Quick problem solving |
| `/p:test` | "run tests" | Execute + report |
| `/p:design` | "design [x]" | Generate diagrams + specs |
| `/p:cleanup` | "clean up code" | Remove dead code/deps |

## How It Works

**You can talk naturally:**
- System detects intent from your message
- Maps to appropriate command automatically
- Responds conversationally with options
- Always suggests what to do next

**Every response includes:**
- What you just did
- Natural language options for next steps
- Command alternatives if you prefer

**Zero memorization needed** - just describe what you want!

## Natural Language Detection

The AI assistant uses **semantic understanding** to map user intent to commands.

### How It Works

**You're an LLM** - use your natural language understanding, not pattern matching!

1. **Check if direct command**: Does message start with `/p:`? → Execute directly
2. **Understand user intent**: What is the user trying to accomplish?
3. **Map to appropriate command**: Based on semantic meaning
4. **Extract parameters**: Pull relevant information from the message
5. **Show transparency**: Always say what you understood and what you'll execute

### Command Intent Map

| User Intent | Command | Examples of Natural Expression |
|-------------|---------|-------------------------------|
| Start/focus on task | `/p:now` | "let me work on X", "starting the API", "voy a hacer X" |
| Finished current work | `/p:done` | "done", "finished", "terminé", "completed", "listo" |
| Ship/deploy feature | `/p:ship` | "ship this", "deploy X", "it's ready", "let's launch" |
| Capture an idea | `/p:idea` | "I have an idea", "what if we...", "tengo una idea" |
| Check progress/status | `/p:recap` | "show progress", "how am I doing", "muéstrame el avance" |
| Stuck on problem | `/p:stuck` | "I'm stuck", "help with X", "estoy atascado" |
| What to work on next | `/p:next` | "what's next", "qué sigue", "what should I do" |

**Key principle**: If you understand what the user wants, map it to the right command. Don't rely on exact phrase matching.

### Example Flow

**User:** "I want to start building the login page"

**Your Reasoning:**
- Intent detected: User wants to begin working on something
- Appropriate command: `/p:now`
- Parameter to extract: "building the login page"

**Your Response:**
```
💬 I understood: "start working on building the login page"
⚡ Executing: /p:now "building the login page"

✅ Starting task: building the login page

What's next?
• Say "I'm done" when finished
• Or: /p:done
```

### Works in Any Language

If you understand the user's intent in **any language**, execute the command:
- English: "I want to start the API"
- Spanish: "Quiero empezar con la autenticación"
- Casual: "gonna work on that login thing"
- Formal: "I shall commence development of the authentication module"

All map to: `/p:now`

## Implementation

- All ops atomic
- Log to `memory/context.jsonl` with author
- Conversational responses with clear options
- Intent detection (English + Spanish)
- Handle missing files gracefully
