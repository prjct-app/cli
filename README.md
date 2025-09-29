# 🚀 prjct-cli

**AI-integrated project management for indie hackers** - Ship fast, stay focused, no ceremonies.

Works with **Claude Code**, **OpenAI Codex/GitHub Copilot**, and **Warp Terminal**.

## ⚡ Quick Install

```bash
curl -fsSL https://prjct-cli.vercel.app/install.sh | bash
```

> **Note:** This is a private tool, not open source. Installation requires authentication.

> The installer will:
> - Install to `~/.prjct-cli/`
> - Configure AI assistant integration (MCP)
> - Set up the `prjct` command
> - Create project structure in `.prjct/`

## 📱 Platform Usage

### Claude Code
```
/p:init                    # Initialize project
/p:now "implement auth"    # Set current task
/p:done                    # Complete task
/p:ship "authentication"   # Ship feature
/p:recap                   # Show progress
```

### OpenAI Codex / GitHub Copilot
```
/p:init                    # Creates .prjct/ structure
/p:now "add API endpoint"  # Updates current focus
/p:ship "REST API"         # Celebrates shipped feature
/p:progress week           # Shows weekly metrics
```

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

## 📂 File Structure

```
.prjct/
├── now.md       # Current task (single focus)
├── next.md      # Priority queue
├── shipped.md   # Completed features (wins!)
├── ideas.md     # Brain dump
└── memory.jsonl # Decision history
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
- One of: Claude Code, Cursor, VS Code, or Warp Terminal

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/Developer-Guide/contributing.md).

## 📜 License

MIT - Build something amazing!

---

**Built for builders who ship, not managers who meet.**