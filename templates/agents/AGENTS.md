# AGENTS.md

AI assistant guidance for **prjct-cli** - developer momentum tool for solo builders & small teams (2-5 people). Just ship. No BS.

## What This Is

**NOT** project management. NO sprints, story points, ceremonies, or meetings.

**IS** frictionless progress tracking. Talk naturally, ship features, celebrate wins.

## Talk Naturally

**Zero memorization** - just describe what you want!

Works in **any language** via semantic understanding.

**Examples:**
```
Start working:
→ "I want to build the login page"
→ "Voy a hacer el dashboard"
→ Command: /p:now

Finished:
→ "I'm done" | "terminé" | "completed"
→ Command: /p:done

Ship:
→ "ship this" | "deploy it" | "ready to launch"
→ Command: /p:ship
```

**Both work:**
- Natural: "I want to start building auth"
- Direct: `/p:now "building auth"`

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

## Quick Start

1. `/p:init` - Initialize
2. `/p:help` - Guide
3. Or talk: "I want to start [task]"

## Commands

**💡 Tip**: `/p:help` for interactive guide

| Command | Say This | Action |
|---------|----------|--------|
| `/p:help` | "help" | Interactive guide |
| `/p:init` | - | Create structure |
| `/p:now [task]` | "start [task]" | Set current task |
| `/p:done` | "I'm done" | Complete & next |
| `/p:ship <feature>` | "ship [feature]" | Celebrate win |
| `/p:next` | "what's next?" | Show queue |
| `/p:idea <text>` | "idea about [x]" | Capture ideas |
| `/p:recap` | "show progress" | Overview |
| `/p:progress [period]` | "how am I doing?" | Metrics |
| `/p:stuck <issue>` | "I'm stuck" | Get help |
| `/p:context` | "show context" | Display state |
| `/p:analyze` | "analyze repo" | Generate summary |
| `/p:design` | "design [x]" | Generate specs |
| `/p:cleanup` | "clean up" | Remove dead code |

## How It Works

**Natural conversation:**
- Detect intent
- Map to command
- Respond with options
- Suggest next steps

**Every response:**
- What you did
- Natural options
- Command alternatives

**Zero memorization!**

## Intent Detection

Semantic understanding, not pattern matching.

| Intent | Command | Examples |
|--------|---------|----------|
| Start task | `/p:now` | "work on X", "starting API", "voy a hacer X" |
| Finish | `/p:done` | "done", "finished", "terminé", "listo" |
| Ship | `/p:ship` | "ship this", "deploy X", "it's ready" |
| Idea | `/p:idea` | "I have an idea", "what if we..." |
| Progress | `/p:recap` | "show progress", "how am I doing" |
| Stuck | `/p:stuck` | "I'm stuck", "help with X" |
| Next | `/p:next` | "what's next", "qué sigue" |

**Any language works** - if you understand intent, execute the command.

### Example

**User:** "I want to start building the login page"

**Your reasoning:**
- Intent: Start working
- Command: `/p:now`
- Param: "building the login page"

**Response:**
```
💬 Understood: "start building the login page"
⚡ Executing: /p:now "building the login page"

✅ Starting: building the login page

Next:
• Say "I'm done" when finished
• Or: /p:done
```

## Implementation

- All ops atomic
- Log to `memory/context.jsonl`
- Conversational responses
- Intent detection (any language)
- Handle missing files

## MCP Servers

- **Context7**: Library docs (always on)
- **Filesystem**: File ops
- **Memory**: Persistence
- **Sequential**: Complex reasoning
