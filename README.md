```
   (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧
   ██████╗ ██████╗      ██╗ ██████╗████████╗
   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝
   ██████╔╝██████╔╝     ██║██║        ██║
   ██╔═══╝ ██╔══██╗██   ██║██║        ██║
   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║
   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝
   prjct/cli
```

**Ship fast, stay focused, no BS.**

**AI-integrated project management for indie hackers and small teams** - Ship fast, stay focused, no ceremonies.

Works with **Claude Code**, **Cursor AI**, **Codeium**, **OpenAI Codex**, and **Warp Terminal**.

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

Choose the installation method that works best for you:

### Homebrew (Recommended for macOS)

```bash
brew tap jlopezlira/prjct
brew install prjct
```

**Benefits**: Automatic updates via `brew upgrade`, clean uninstall, system integration.

### Bun (Lightning Fast)

```bash
curl -fsSL https://prjct.dev/install-bun.sh | bash
```

**Benefits**: 10x faster than npm, modern JavaScript runtime, zero-config.

### npm/Node.js

```bash
npm install -g @prjct/cli
```

**Benefits**: Standard npm ecosystem, works everywhere Node.js runs.

### Quick Install Script (Cross-platform)

```bash
curl -fsSL https://prjct.app/install.sh | bash
```

**Benefits**: Works on any Unix-like system, automatic platform detection.

#### Installation Options

```bash
# Force reinstall (even if up to date)
curl -fsSL https://prjct.app/install.sh | bash -s -- --force

# Auto-accept all prompts (unattended installation)
curl -fsSL https://prjct.app/install.sh | bash -s -- -y

# Install from development branch
curl -fsSL https://prjct.app/install.sh | bash -s -- --dev

# Show help
curl -fsSL https://prjct.app/install.sh | bash -s -- --help
```

> **Note**: For detailed installation instructions, troubleshooting, and platform-specific guidance, see [INSTALL.md](docs/INSTALL.md).

### Editor Command Installation

After initial installation, `prjct` can install commands to your AI editors:

```bash
# Interactive installation (default) - select which editors to use
prjct install

# Non-interactive - install to all detected editors
prjct install --no-interactive

# Install to specific editor only
prjct install --editor claude
prjct install --editor cursor
prjct install --editor codex
prjct install --editor windsurf

# Force update existing commands
prjct install --force

# Create templates from existing commands
prjct install --create-templates
```

**Detected Editors:**
- **Claude Code**: `~/.claude/commands/p/`
- **Cursor AI**: `~/.cursor/commands/p/`
- **OpenAI Codex**: `{project}/AGENTS.md`
- **Windsurf/Codeium**: `{project}/.windsurf/workflows/`

The interactive mode (default) will show checkboxes to select which editors to install to, optimizing for your actual workflow.

### Version Management

The installer automatically:
- **Detects existing installations** and checks for updates
- **Compares versions** between local and remote
- **Prompts for updates** when newer versions are available
- **Shows current version** during installation
- **Supports force reinstall** with `--force` flag

### Manual Installation

```bash
git clone https://github.com/jlopezlira/prjct-cli
cd prjct-cli
./setup.sh
```

### What the Installer Does

- ✅ **Installs to** `~/.prjct-cli/`
- ✅ **Checks prerequisites** (Node.js 18+, Git)
- ✅ **Detects AI editors** (Claude Code, Cursor, Codeium)
- ✅ **Installs slash commands** to all detected editors
- ✅ **Creates global structure** for cross-editor data sharing
- ✅ **Version management** with automatic update detection
- ✅ **Configures AI assistant integration** (MCP)
- ✅ **Sets up the** `prjct` **command**
- ✅ **Creates project structure** in `.prjct/`
- ✅ **Auto-detects your environment** (Claude/Codex/Terminal)
- ✅ **Configures shell** (bash/zsh) automatically

## 🗑️ Uninstallation

To completely remove prjct-cli from your system:

```bash
cd ~/.prjct-cli
./uninstall.sh
```

The uninstaller will:

- **Safely remove** all prjct-cli components
- **Offer options** for your project data:
  - Keep all `.prjct/` directories (recommended)
  - Back up before removal
  - Permanently delete (requires confirmation)
- **Clean up** shell configuration and paths
- **Remove** Claude Code commands

> ⚠️ **WARNING**: Uninstallation is irreversible. The script will ask for confirmation before removing anything.

## 💬 Talk Naturally - Zero Memorization

**You don't need to memorize commands.** Just talk to your AI assistant naturally!

The system detects your intent in **English** and **Spanish** and maps it to the right command:

```
✨ Natural Language Examples:

Instead of:                      Just say:
/p:now "implement auth"    →     "I want to start building the auth system"
/p:done                    →     "I'm done" or "finished"
/p:ship "feature"          →     "ship the authentication"
/p:stuck "error"           →     "I'm stuck on this error"
/p:idea "add feature"      →     "I have an idea about dark mode"
```

**How it works:**
- Type `/p:help` for an interactive guide with natural language options
- Every command response suggests what to do next
- System guides you conversationally - no guessing needed
- Gradually learn commands while talking naturally

**Available in:** 🇺🇸 English • 🇪🇸 Spanish

## 📱 Platform Usage

### Claude Code / Cursor AI / Codeium

All three editors support the same slash commands through automatic installation:

```
# Core Commands (or just talk naturally!)
/p:init                    # Initialize project
/p:now "implement auth"    # Set current task
/p:done                    # Complete task
/p:ship "authentication"   # Ship feature
/p:recap                   # Show progress

# Power Commands 🚀
/p:analyze                 # Auto-analyze codebase
/p:git                     # Smart git commit with context
/p:fix "error msg"         # Quick troubleshooting
/p:test                    # Run & fix tests
/p:task "complex feature"  # Break down & execute
/p:roadmap                 # Strategic planning
```

**Multi-Editor Workflow**: Switch between Claude Code, Cursor, and Codeium seamlessly - all commands access the same global data in `~/.prjct-cli/projects/`.

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

## 🎯 Quick Command Guide

**New idea or feature:**
- `/p:idea "add dark mode"` - Quick capture
- `/p:now "implement dark mode"` - Start working now

**Finished working:**
- `/p:done` - Mark complete, clear focus
- `/p:ship "feature name"` - Celebrate important milestones

**Lost context:**
- `/p:recap` - Complete overview
- `/p:next` - View task queue

**Need help:**
- `/p:stuck "error description"` - Get contextual solutions
- `/p:fix "error message"` - Auto-diagnosis

**Track progress:**
- `/p:progress week` - Weekly metrics
- `/p:context` - Project info

**Code quality:**
- `/p:cleanup` - Basic cleanup
- `/p:cleanup --type code` - Remove dead code, unused imports
- `/p:design "component" --type architecture` - Design before coding

**Version control:**
- `/p:git` - Smart commit
- `/p:git push` - Commit + push

**After cloning/pulling:**
- `/p:analyze` - Auto-analyze codebase
- `/p:analyze --sync` - Sync with implemented features

> 💡 **Tip:** Visit [prjct.dev/commands](https://prjct.dev/commands) for interactive command guide or [prjct.dev/workflows-guide](https://prjct.dev/workflows-guide) for step-by-step examples

## 📖 Complete Command Reference

### Core Commands (Essential) 🎯

| Command             | When to use?                   | What does it do?                  | Example Output                            |
| ------------------- | ------------------------------ | ---------------------------------- | ----------------------------------------- |
| `/p:init`           | Starting a new project         | Creates complete `.prjct/` structure | `✅ Project initialized!`                 |
| `/p:now [task]`     | To set your current focus      | Defines ONE single active task    | `🎯 Current: implement auth`              |
| `/p:done`           | When finishing current task    | Marks complete and clears focus   | `✅ Task complete! Next: API integration` |
| `/p:ship <feature>` | When completing something big  | Celebrates and records the WIN    | `🚀 SHIPPED: User auth! 🎉`               |
| `/p:recap`          | To see complete overview       | Shows progress and current state  | `📊 3 shipped, 1 active, 5 queued`        |

### Planning Commands 📋

| Command             | When to use?            | What does it do?               | Example Output                 |
| ------------------- | ----------------------- | ------------------------------ | ------------------------------ |
| `/p:idea <text>`    | When you have an idea   | Quick capture without interrupting | `💡 Idea captured!`            |
| `/p:roadmap`        | View strategic plan     | Shows complete roadmap         | `🚀 Sprint: 23% complete`      |
| `/p:roadmap add`    | Add new feature         | Automatically prioritizes      | `✅ Added: Priority #3`        |
| `/p:next`           | See what's next         | Lists prioritized tasks        | `1. Fix auth bug 2. Add tests` |
| `/p:task <complex>` | Break down complex task | Divides into manageable subtasks | `📋 Split into 5 subtasks`     |

### Development Commands 🛠️

| Command              | When to use?              | What does it do?                      | Example Output                        |
| -------------------- | ------------------------- | ------------------------------------- | ------------------------------------- |
| `/p:analyze`         | Understand project state  | Auto-analyze & sync with real code    | `🔍 14 commands, 8 features detected` |
| `/p:analyze --sync`  | After git pull or clone   | Sync .prjct/ with implemented code    | `✅ Synced 5 tasks, 3 features`       |
| `/p:git`             | Quick commit              | Smart message + commit                | `✅ feat: add auth system`            |
| `/p:test`            | Run tests                 | Run + auto-fix simple errors          | `✅ 42 passing, 2 fixed`              |
| `/p:fix <error>`     | Solve errors              | Diagnosis and solutions               | `🔧 Solution: check null first`       |

### Metrics Commands 📊

| Command            | When to use?            | What does it do?              | Example Output                    |
| ------------------ | ----------------------- | ----------------------------- | --------------------------------- |
| `/p:progress`      | View productivity       | Weekly metrics                | `📈 7 shipped, velocity: 1.4/day` |
| `/p:context`       | Project info            | Current state and context     | `📚 Sprint 3, Day 12, 67% done`   |
| `/p:stuck <issue>` | When you need help      | Contextual solutions          | `💡 Try: npm install cors`        |

## 🔄 Common Workflows

**First day:** `/p:init` → `/p:recap` → `/p:now "first task"`

**Daily session:** `/p:recap` → Work → `/p:done` → `/p:git` → `/p:progress`

**Complex features:** `/p:task "feature"` → Break into subtasks → `/p:now` each → `/p:ship` when complete

**Sprint planning:** `/p:roadmap` → Add features → `/p:now` top priority → `/p:ship` → `/p:roadmap next`

> 📚 **More workflows:** Visit [prjct.dev/workflows-guide](https://prjct.dev/workflows-guide) for detailed interactive examples

## ❓ FAQ

**Can I work on multiple tasks?**
No, by design. Single-focus philosophy. Use `/p:done` before switching.

**Difference between `/p:done` and `/p:ship`?**
`/p:done` clears focus. `/p:ship` celebrates important features with metrics.

**Where is my data stored?**
Everything is local in `.prjct/` directory. Never leaves your machine.

**Does it work with teams?**
Designed for indie hackers. For teams, each dev has their own `.prjct/` or shares via git.

**How do I migrate from Jira/Trello?**
No migration needed. Just `/p:init` and start working.

> 💬 **More questions?** Check [prjct.dev/faq](https://prjct.dev/faq) or [open an issue](https://github.com/jlopezlira/prjct-cli/issues)

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
