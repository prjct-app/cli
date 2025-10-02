# AGENTS.md

AI assistant guidance for prjct-cli.

## Talk Naturally

You don't need to memorize commands. Just talk:

**Natural Language**:
- "I want to start building the login page"
- "I'm done with that"
- "ship the authentication system"
- "what should I work on next?"

**Or use commands**:
- `/p:now "task"` or `prjct now "task"`
- `/p:done` or `prjct done`
- `/p:ship "feature"` or `prjct ship "feature"`

The system understands both!

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

## Implementation

- All ops atomic
- Log to `memory/context.jsonl` with author
- Conversational responses with clear options
- Intent detection (English + Spanish)
- Handle missing files gracefully
