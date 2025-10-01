# 🚀 prjct-cli

**AI-integrated project management for indie hackers** - Ship fast, stay focused, no ceremonies.

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

### Quick Install (Recommended)

```bash
curl -fsSL https://prjct.app/install.sh | bash
```

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

## 📱 Platform Usage

### Claude Code / Cursor AI / Codeium

All three editors support the same slash commands through automatic installation:

```
# Core Commands
/p:init                    # Initialize project
/p:now "implement auth"    # Set current task
/p:done                    # Complete task
/p:ship "authentication"   # Ship feature
/p:recap                   # Show progress

# Power Commands 🚀
/p:analyze                 # Auto-analyze codebase
/p:git                     # Smart git commit & push
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

## 🎯 Which Command to Use When...?

### 🆕 **"I have a new idea or unplanned feature"**

```bash
# Option 1: Just capture the idea so you don't forget
/p:idea "add dark mode to dashboard"
→ 💡 Saved to ideas.md for later review

# Option 2: Add it to the roadmap for planning
/p:roadmap add "implement dark mode"
→ 📋 Automatically prioritized in roadmap

# Option 3: Start working on it NOW
/p:now "implement dark mode in dashboard"
→ 🎯 Set as your current task (you can only have ONE)
```

### ✅ **"I finished what I was doing"**

```bash
# Mark task as complete
/p:done
→ ✅ Clears your current focus and suggests next task

# If it's an important feature, CELEBRATE it
/p:ship "OAuth authentication system"
→ 🚀 Recorded as a WIN with celebration 🎉
```

### 🤔 **"I don't know what to do" or "What was I working on?"**

```bash
/p:recap
→ 📊 Shows EVERYTHING: current task, progress, shipped, roadmap

/p:next
→ 📋 Shows your prioritized task queue

/p:context
→ 📚 Project info and recent actions
```

### 🆘 **"I'm stuck on a problem"**

```bash
/p:stuck "CORS error in API calls"
→ 💡 Contextual solutions based on your project

/p:fix "TypeError: undefined is not a function"
→ 🔧 Auto-diagnosis and possible solutions
```

### 📊 **"I want to see my progress"**

```bash
/p:progress week
→ 📈 Weekly metrics: shipped, velocity, trends

/p:progress month
→ 📊 Monthly view with detailed statistics
```

### 🧹 **"I need to clean up the code"**

```bash
/p:cleanup
→ 🧹 Basic cleanup of temp files and logs

/p:cleanup-advanced --type code
→ 🗑️ Remove console.logs, commented code, unused imports

/p:cleanup-advanced --aggressive
→ ⚡ Deep cleanup with dependency optimization
```

### 🎨 **"I need to design before coding"**

```bash
/p:design "authentication system" --type architecture
→ 🏗️ Generate architecture design with ASCII diagrams

/p:design "user API" --type api
→ 📋 Design REST/GraphQL endpoints with specifications

/p:design "dashboard" --type component
→ 🧩 Design UI component hierarchy

/p:design "database" --type database
→ 📊 Design schemas and database relationships
```

### 💻 **"I need to commit/push"**

```bash
/p:git
→ 📝 Generates smart commit message and commits

/p:git push
→ 🚀 Commit + push to origin

/p:git sync
→ 🔄 Pull + commit + push (complete sync)
```

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

| Command          | When to use?           | What does it do?              | Example Output                  |
| ---------------- | ---------------------- | ----------------------------- | ------------------------------- |
| `/p:analyze`     | Understand the project | Automatic repo analysis       | `🔍 Tech: Node.js, 45 files`    |
| `/p:git`         | Quick commit           | Smart message + commit        | `✅ feat: add auth system`      |
| `/p:test`        | Run tests              | Run + auto-fix simple errors  | `✅ 42 passing, 2 fixed`        |
| `/p:fix <error>` | Solve errors           | Diagnosis and solutions       | `🔧 Solution: check null first` |

### Metrics Commands 📊

| Command            | When to use?            | What does it do?              | Example Output                    |
| ------------------ | ----------------------- | ----------------------------- | --------------------------------- |
| `/p:progress`      | View productivity       | Weekly metrics                | `📈 7 shipped, velocity: 1.4/day` |
| `/p:context`       | Project info            | Current state and context     | `📚 Sprint 3, Day 12, 67% done`   |
| `/p:stuck <issue>` | When you need help      | Contextual solutions          | `💡 Try: npm install cors`        |

## 🔄 Complete Workflows

### 🌟 **My First Day with prjct**

```bash
# 1. Initialize structure
/p:init
→ ✅ Project configured with .prjct/ structure

# 2. Analyze the repository
/p:analyze
→ 🔍 Detected: Node.js, React, 45 files

# 3. View or create roadmap
/p:roadmap
→ 📋 Empty roadmap, use /p:roadmap add

# 4. Set first task
/p:now "setup development environment"
→ 🎯 Current focus set

# 5. When done, celebrate
/p:done
→ ✅ Task completed

/p:ship "environment configured"
→ 🚀 First WIN recorded! 🎉
```

### 💼 **Daily Work Session**

```bash
# Morning: See where I am
/p:recap
→ 📊 Overview: 1 active, 3 in queue, 5 shipped this week

# Confirm or change focus
/p:now
→ 🎯 Current: implement payment system

# During work
/p:stuck "Stripe webhook not working"
→ 💡 Solution: Verify endpoint URL and secrets

/p:idea "add transaction logs"
→ 💡 Idea saved for later

# At end of day
/p:done
→ ✅ Payment system completed

/p:git
→ 📝 Commit: feat: add Stripe payment system

/p:progress
→ 📈 Today: 1 shipped, velocity maintaining
```

### 🏗️ **Complex Feature Management**

```bash
# 1. Break down the large feature
/p:task "complete notification system"
→ 📋 Broken down into 5 subtasks:
   [1/5] Design event architecture
   [2/5] Implement WebSockets
   [3/5] Create notification UI
   [4/5] User preference system
   [5/5] Testing and documentation

# 2. Work on each subtask
/p:now "design event architecture"
→ 🎯 Subtask 1 active

# 3. Complete one by one
/p:done
→ ✅ Subtask 1 complete, next: WebSockets

/p:now "implement WebSockets"
→ 🎯 Subtask 2 active

# 4. When all complete, celebrate big
/p:ship "complete notification system"
→ 🚀 MEGA WIN: Notification system complete! 🎉🎊
```

### 🚀 **Sprint Planning with Roadmap**

```bash
# View current roadmap
/p:roadmap
→ 📋 Current sprint: 45% completed

# Add new prioritized features
/p:roadmap add "two-factor authentication"
→ ✅ Added as priority #2

/p:roadmap add "Slack integration"
→ ✅ Added as priority #5

# Complete roadmap items
/p:roadmap complete "payment system"
→ ✅ Marked as completed, progress: 67%

# View next priority
/p:roadmap next
→ 📍 Next: two-factor authentication
```

## ❓ FAQ - Frequently Asked Questions

### **"What happens if I use `/p:now` without finishing the previous task?"**

The previous task gets REPLACED. prjct uses a "single focus" philosophy - only ONE active task at a time. If you need to switch context, use `/p:done` first.

### **"Can I work on multiple tasks simultaneously?"**

NO by design. prjct forces focus on a single task. If you need to temporarily switch, use `/p:done` and then `/p:now` with the new task.

### **"What's the difference between `/p:done` and `/p:ship`?"**

- `/p:done` = Complete current task and clear focus
- `/p:ship` = Celebrate an important FEATURE (not all tasks are features)

```bash
/p:done                    # "I finished fixing that bug"
/p:ship "new dashboard"    # "LAUNCHED THE NEW DASHBOARD!" 🎉
```

### **"How do I modify something in the roadmap?"**

```bash
/p:roadmap                 # View everything
/p:roadmap add "feature"   # Add new
/p:roadmap complete "item" # Mark as done
/p:roadmap next           # View next priority
```

### **"Can I undo a command?"**

There's no automatic "undo", but you can:

- Manually edit files in `.prjct/`
- Use `/p:now` to change current task
- Files are simple markdown, easy to edit

### **"What happens with my data?"**

- EVERYTHING is stored locally in `.prjct/`
- No data leaves your machine
- You can version `.prjct/` with git if you want
- Backup = copy the `.prjct/` folder

### **"How do I migrate from Jira/Trello/etc?"**

You don't need to migrate anything. Simply:

```bash
/p:init                           # Start fresh
/p:roadmap add "current feature"  # Add what you're working on
/p:now "today's task"            # Start working
```

### **"Does it work with teams?"**

prjct is designed for indie hackers and solopreneurs. For teams, each developer can have their own `.prjct/` or share one via git.

### **"Can I customize the commands?"**

Commands are standardized to maintain simplicity. But files in `.prjct/` are markdown - you can edit them however you want.

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
