# 🚀 prjct-cli

**AI-integrated project management for indie hackers** - Ship fast, stay focused, no ceremonies.

Works with **Claude Code**, **OpenAI Codex/GitHub OpenAI Codex**, and **Warp Terminal**.

[![OpenAI Codex Compatible](https://img.shields.io/badge/OpenAI%20Codex-Compatible-00a67e)](AGENTS.md)
[![Claude Code Ready](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)](CLAUDE.md)

## 🤖 Intelligent Agent Detection

**prjct-cli automatically detects and adapts to your environment** - No configuration needed!

The system intelligently identifies whether you're using:
- **Claude Code** → Rich markdown, MCP integration, interactive features
- **OpenAI Codex** → Structured output for sandboxed environments
- **Terminal/CLI** → ANSI colors, progress spinners, native experience

### How It Works
```javascript
// Automatic detection strategies:
1. Environment Variables (CLAUDE_AGENT, CODEX_AGENT)
2. Configuration Files (AGENTS.md, CLAUDE.md)
3. Runtime Capabilities (MCP availability)
4. Filesystem Characteristics (sandboxed paths)
```

Each agent gets optimized output:
- **Claude**: `✅ **Task complete!** Ready for the next challenge?`
- **Codex**: `[SUCCESS] Task complete. NEXT: Use /p:next`
- **Terminal**: `✅ Task complete! → Use prjct next`

## ⚡ Installation

### Option 1: Quick Install (Recommended)
```bash
curl -fsSL https://jlopezlira.github.io/prjct-cli/install.sh | bash
```

### Option 2: Clone from GitHub
```bash
git clone https://github.com/jlopezlira/prjct-cli
cd prjct-cli
./setup.sh
```

> The installer will:
> - Install to `~/.prjct-cli/`
> - Configure AI assistant integration (MCP)
> - Set up the `prjct` command
> - Create project structure in `.prjct/`
> - Auto-detect your environment (Claude/Codex/Terminal)

## 📱 Platform Usage

### Claude Code
```
# Core Commands
/p:init                    # Initialize project
/p:now "implement auth"    # Set current task
/p:done                    # Complete task
/p:ship "authentication"   # Ship feature
/p:recap                   # Show progress

# New Power Commands 🚀
/p:analyze                 # Auto-analyze codebase
/p:git                     # Smart git commit & push
/p:fix "error msg"         # Quick troubleshooting
/p:test                    # Run & fix tests
/p:task "complex feature"  # Break down & execute
/p:roadmap                 # Strategic planning
```

### OpenAI Codex / GitHub OpenAI Codex

The repository includes `AGENTS.md` for full OpenAI Codex compatibility.

```
# Codex automatically reads AGENTS.md for guidance
/p:init                    # Creates .prjct/ structure
/p:now "add API endpoint"  # Updates current focus
/p:ship "REST API"         # Celebrates shipped feature
/p:progress week           # Shows weekly metrics
/p:context                 # Show project context
/p:recap                   # Display project overview
```

> **Setup**: Authorize the Codex GitHub app for your organization, and Codex will automatically detect the AGENTS.md configuration.

### Warp Terminal
```bash
prjct init                 # Initialize project
prjct now "implement auth"  # Set current task
prjct done                 # Complete task
prjct ship "authentication" # Ship feature
prjct recap                # Show progress
```

> Warp AI also understands `/p:` commands in the terminal

## 🎯 Commands

| Command | Description | Example |
| **Core Commands** | | |
| `init` | Create .prjct/ structure with templates | `/p:init` |
| `now [task]` | Set or show current focus | `/p:now "add payments"` |
| `done` | Mark current task as complete | `/p:done` |
| `ship <feature>` | Ship feature with celebration 🎉 | `/p:ship "checkout flow"` |
| `next` | Display priority queue | `/p:next` |
| `idea <text>` | Quick capture to ideas.md | `/p:idea "add AI search"` |
| `recap` | Show project summary | `/p:recap` |
| `progress [period]` | Display metrics (day/week/month) | `/p:progress week` |
| `stuck <issue>` | Get contextual help | `/p:stuck "CORS error"` |
| `context` | Display project info and recent actions | `/p:context` |
| **Power Commands** 🚀 | | |
| `analyze` | Auto-analyze repository | `/p:analyze` |
| `git [action]` | Smart git operations | `/p:git commit` |
| `fix [error]` | Quick troubleshooting | `/p:fix "undefined error"` |
| `test [type]` | Run & auto-fix tests | `/p:test` |
| `task <description>` | Break down complex tasks | `/p:task "build auth"` |
| `roadmap [action]` | Strategic planning | `/p:roadmap add "AI feature"` |

## 📂 File Structure

### New Layered Architecture 🏗️
```
.prjct/
├── 🎯 core/        # Current focus & priorities
│   ├── now.md      # Current task
│   ├── next.md     # Priority queue
│   └── context.md  # Project context
├── 📈 progress/    # Metrics & achievements
│   ├── shipped.md  # Completed features
│   └── metrics.md  # Velocity & stats
├── 💡 planning/    # Ideas & strategy
│   ├── ideas.md    # Brain dump
│   ├── roadmap.md  # Strategic planning
│   └── tasks/      # Complex task plans
├── 🔍 analysis/    # Technical insights
│   └── repo-summary.md  # Auto-generated
└── 🧠 memory/      # History & learning
    ├── context.jsonl     # Activity log
    └── decisions.jsonl   # Decision history
```

### Migration from Old Structure
If you have an existing flat `.prjct/` structure, run:
```bash
./migrate.sh  # Automatic migration to layered structure
```

## 🎨 Philosophy

- **Zero friction**: Commands within your existing workflow
- **Single task focus**: One thing at a time
- **Celebration built-in**: Every ship is a win
- **No ceremonies**: No sprints, no story points, no meetings

## 📊 What We Track

✅ **Features shipped** - The only metric that matters
✅ **Current focus** - Stay on track
✅ **Ideas captured** - Never lose a thought
❌ ~~Story points~~ - We ship, not estimate
❌ ~~Hours logged~~ - Focus on outcomes
❌ ~~Burndown charts~~ - Ship and celebrate

## 🛠️ Requirements

- Node.js 18+
- One of: Claude Code, OpenAI Codex, Cursor, VS Code, or Warp Terminal

### AI Assistant Configuration

- **OpenAI Codex**: AGENTS.md file (included)
- **Claude Code**: CLAUDE.md file (included)
- **Warp Terminal**: Shell integration (via setup.sh)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/Developer-Guide/contributing.md).

## 📜 License

MIT - Build something amazing!

---

**Built for builders who ship, not managers who meet.**