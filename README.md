```
   ██████╗ ██████╗      ██╗ ██████╗████████╗
   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝
   ██████╔╝██████╔╝     ██║██║        ██║
   ██╔═══╝ ██╔══██╗██   ██║██║        ██║
   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║
   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝
   prjct/cli
```

**Ship fast, track progress, stay focused.**

Developer momentum tool for indie hackers and small teams.

[![Claude Code Ready](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)](CLAUDE.md)
[![Claude Desktop Compatible](https://img.shields.io/badge/Claude%20Desktop-Compatible-6366f1)]()
[![Tests](https://github.com/jlopezlira/prjct-cli/actions/workflows/test.yml/badge.svg)](https://github.com/jlopezlira/prjct-cli/actions/workflows/test.yml)
[![Website Build](https://img.shields.io/badge/website-deployed-success)](https://prjct.app)

> **New to prjct?** You don't need to memorize commands. Just use `p.` and talk naturally:
> - `p. start working on user auth`
> - `p. I'm done`
> - `p. ship the authentication`

## 💬 p. Trigger - Zero Memorization

**You don't need to memorize commands.** Just use the `p.` prefix and talk naturally!

The system detects your intent and maps it to the right command - **works in any language**:

```
Instead of:                      Just say:
/p:now "implement auth"    →     "p. I want to start building the auth system"
/p:done                    →     "p. I'm done" or "p. finished"
/p:ship "feature"          →     "p. ship the authentication"
/p:stuck "error"           →     "p. I'm stuck on this error"
/p:idea "add feature"      →     "p. I have an idea about dark mode"
```

**How it works:**

- Simple `p.` prefix signals prjct context
- Works in English, Spanish, German, French - any language
- System detects intent and executes the right command
- Auto-validates you're in a prjct project before execution
- Every command response suggests what to do next

## 🤖 Claude-Native Architecture

**prjct-cli is purpose-built for Claude's unique capabilities:**

- **Dynamic AI Agents** - Auto-generated specialists based on your stack
- **MCP Integration** - Native Model Context Protocol support
- **Slash Commands** - `/p:*` commands in Claude Code and Desktop
- **Git Validation** - Last commit as source of truth
- **Natural Language** - Talk naturally, commands adapt

### Why Claude-Only?

We chose to focus 100% on Claude to deliver:

- **Deep Integration** - Leverage Claude's agent system and MCP
- **Better Quality** - Optimized for Claude's strengths
- **Simpler Codebase** - No multi-platform compromises
- **Honest Compatibility** - We only support what we can validate

## ⚡ Installation

### Using Bun (Recommended)

prjct-cli is built with Bun for maximum performance:

```bash
bun install -g prjct-cli
```

### Alternative Package Managers

```bash
# Using npm
npm install -g prjct-cli

# Using yarn
yarn global add prjct-cli

# Using pnpm
pnpm add -g prjct-cli
```

### From GitHub Packages

You can also install from GitHub Packages:

```bash
npm install -g @jlopezlira/prjct-cli --registry=https://npm.pkg.github.com
```

For easier installation from GitHub Packages, see [GitHub Packages Setup](docs/GITHUB_PACKAGES.md).

**Requirements**: Bun 1.0+ or Node.js 18+

> **Note**: The CLI automatically detects updates and notifies you when a new version is available. Simply run `npm update -g prjct-cli` to upgrade.

### Auto-Setup (NEW in v0.8.2)

After `npm install -g prjct-cli`, setup runs automatically:

- ✅ Installs `/p:*` commands to `~/.claude`
- ✅ Migrates legacy projects to global storage
- ✅ Syncs commands (removes orphans, adds new ones)
- ✅ Shows beautiful ASCII art with quick start

**That's it!** No manual setup required.

If you need to reconfigure later:

```bash
prjct setup          # Reconfigure and sync commands
prjct setup --force  # Force reinstall all commands
```

**Installation Location**: `~/.claude/commands/p/`

All 25+ slash commands (`/p:*`) are automatically installed to Claude Code and Claude Desktop.

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
- ✅ **Detects Claude** (Code or Desktop)
- ✅ **Installs slash commands** to `~/.claude/commands/p/`
- ✅ **Creates global structure** in `~/.prjct-cli/`
- ✅ **Version management** with automatic update detection
- ✅ **Configures MCP integration** (Context7, Sequential, Magic, Playwright)
- ✅ **Sets up the** `prjct` **command**
- ✅ **Creates project structure** in `.prjct/`
- ✅ **Auto-detects your environment** (Claude or Terminal fallback)
- ✅ **Configures shell** (bash/zsh) automatically

## ⚡ 5-Minute Quick Start

Get productive with prjct-cli in under 5 minutes.

### Step 1: Initialize Your Project

```bash
cd your-project
```

In Claude Code or Claude Desktop:
```
/p:init
```

Or just say: `p. initialize this project`

### Step 2: Start Your First Task

```
/p:now "implement user login"
```

Or naturally: `p. I want to start working on user login`

### Step 3: Work on Your Task

Just code! prjct tracks your focus.

### Step 4: Complete Your Task

```
/p:done
```

Or naturally: `p. finished`

### Step 5: Ship It!

```
/p:ship "user authentication"
```

Or naturally: `p. ship the authentication`

**That's it!** You now know the core workflow.

### What's Next?

- `/p:recap` - See your progress
- `/p:help` - Get contextual guidance
- `/p:idea "something cool"` - Capture ideas without interrupting

> **Pro tip:** You don't need to memorize commands. Just use `p.` and describe what you want!

## 🚀 Built for Claude - Ship Fast, No BS

### Track Progress, Not Meetings

**prjct-cli helps you ship products fast.** Built for creators and small teams who prefer coding over meetings.

**What it does:**

- ✅ Track what you're working on
- ✅ See what you've shipped
- ✅ Stay focused on one thing
- ✅ No meetings needed

**What it doesn't do:**

- ❌ Not like Jira or ClickUp
- ❌ No sprint planning
- ❌ No story points
- ❌ No charts or reports
- ❌ No meetings

**Philosophy: Just Ship It**

```
/p:now "build auth"     → Focus
work work work          → Ship
/p:done                 → Next
/p:ship "authentication" → Celebrate
```

No planning sessions. No standups. No retrospectives. Just **ship fast, track progress, stay focused**.

**Who uses this:**

- 🎯 **Solo creators** - Build products without meetings or BS overhead
- 👥 **Small teams** (2-5 people) - Coordinate without meetings
- 🚀 **Product builders** - Ship features fast
- 💪 **Makers** - Focus on building, not planning

### Why 100% Claude-Focused?

**This isn't a limitation - it's a superpower.**

By focusing exclusively on Claude Code and Claude Desktop, we can build features that would be impossible with multi-platform support:

**🤖 Smart AI Helpers**

- Get help from specialized AI assistants (for frontend, backend, UX, security, etc.)
- They activate automatically when you need them
- Works with Claude's AI system

**🔗 AI Tools Built-In**

- Context7 - Gets documentation for any library automatically
- Sequential - Helps solve complex problems
- Magic - Creates UI components for you
- Playwright - Tests your app in a real browser

**✅ Code Change Verification**

- Checks your actual code changes
- Makes sure you actually completed what you said
- No fake progress

**💬 Talk Naturally**

- Just describe what you want to do
- Works in any language
- No commands to memorize

**Why it works better:**

- ⚡ **Simpler code** - Faster to add features and fix bugs
- 🎯 **Built for Claude** - Uses Claude's special features
- 💯 **Everything tested** - We only support what actually works
- 🤝 **Honest about compatibility** - We tell you what works and what doesn't

**See [MIGRATION.md](MIGRATION.md) for v0.5.0 upgrade guide.**

## 📱 Platform Usage

### Claude Code & Claude Desktop

Built exclusively for Claude with native slash commands:

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

All data is stored in `~/.prjct-cli/projects/` and shared seamlessly between Claude Code and Claude Desktop.

### Terminal / CLI (Fallback)

```bash
prjct init                 # Initialize project
prjct now "implement auth"  # Set current task
prjct done                 # Complete task
prjct ship "authentication" # Ship feature
prjct recap                # Show progress
```

> **Note**: Terminal mode works but has limited features (no AI agents, MCP, or natural language). **We strongly recommend Claude Code** for the full experience.

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

> 💡 **Tip:** Visit [prjct.app/commands](https://prjct.app/commands) for interactive command guide or [prjct.app/workflows-guide](https://prjct.app/workflows-guide) for step-by-step examples

## 📖 Complete Command Reference

### Core Commands (Essential) 🎯

| Command             | When to use?                  | What does it do?                     | Example Output                            |
| ------------------- | ----------------------------- | ------------------------------------ | ----------------------------------------- |
| `/p:init`           | Starting a new project        | Creates complete `.prjct/` structure | `✅ Project initialized!`                 |
| `/p:now [task]`     | To set your current focus     | Defines ONE single active task       | `🎯 Current: implement auth`              |
| `/p:done`           | When finishing current task   | Marks complete and clears focus      | `✅ Task complete! Next: API integration` |
| `/p:ship <feature>` | When completing something big | Celebrates and records the WIN       | `🚀 SHIPPED: User auth! 🎉`               |
| `/p:recap`          | To see complete overview      | Shows progress and current state     | `📊 3 shipped, 1 active, 5 queued`        |

### Planning Commands 📋

| Command             | When to use?            | What does it do?                   | Example Output                 |
| ------------------- | ----------------------- | ---------------------------------- | ------------------------------ |
| `/p:idea <text>`    | When you have an idea   | Quick capture without interrupting | `💡 Idea captured!`            |
| `/p:roadmap`        | View strategic plan     | Shows complete roadmap             | `🚀 Sprint: 23% complete`      |
| `/p:roadmap add`    | Add new feature         | Automatically prioritizes          | `✅ Added: Priority #3`        |
| `/p:next`           | See what's next         | Lists prioritized tasks            | `1. Fix auth bug 2. Add tests` |
| `/p:task <complex>` | Break down complex task | Divides into manageable subtasks   | `📋 Split into 5 subtasks`     |

### Development Commands 🛠️

| Command             | When to use?             | What does it do?                   | Example Output                        |
| ------------------- | ------------------------ | ---------------------------------- | ------------------------------------- |
| `/p:analyze`        | Understand project state | Auto-analyze & sync with real code | `🔍 14 commands, 8 features detected` |
| `/p:analyze --sync` | After git pull or clone  | Sync .prjct/ with implemented code | `✅ Synced 5 tasks, 3 features`       |
| `/p:git`            | Quick commit             | Smart message + commit             | `✅ feat: add auth system`            |
| `/p:test`           | Run tests                | Run + auto-fix simple errors       | `✅ 42 passing, 2 fixed`              |
| `/p:fix <error>`    | Solve errors             | Diagnosis and solutions            | `🔧 Solution: check null first`       |

### Metrics Commands 📊

| Command            | When to use?       | What does it do?          | Example Output                    |
| ------------------ | ------------------ | ------------------------- | --------------------------------- |
| `/p:progress`      | View productivity  | Weekly metrics            | `📈 7 shipped, velocity: 1.4/day` |
| `/p:context`       | Project info       | Current state and context | `📚 Sprint 3, Day 12, 67% done`   |
| `/p:stuck <issue>` | When you need help | Contextual solutions      | `💡 Try: npm install cors`        |

## 🔄 Common Workflows

**First day:** `/p:init` → `/p:recap` → `/p:now "first task"`

**Daily session:** `/p:recap` → Work → `/p:done` → `/p:git` → `/p:progress`

**Complex features:** `/p:task "feature"` → Break into subtasks → `/p:now` each → `/p:ship` when complete

**Sprint planning:** `/p:roadmap` → Add features → `/p:now` top priority → `/p:ship` → `/p:roadmap next`

> 📚 **More workflows:** Visit [prjct.app/workflows-guide](https://prjct.app/workflows-guide) for detailed interactive examples

## 🧪 Testing

prjct-cli uses **Bun** (`bun test`) for unit tests.

### Quick Start

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Generate coverage report
bun test --coverage
```

### Test Suites

- **Core CLI** (Node.js) - Agentic system, commands, and utilities

### CI/CD

Tests run automatically on every push and pull request via GitHub Actions.

[![Tests](https://github.com/jlopezlira/prjct-cli/actions/workflows/test.yml/badge.svg)](https://github.com/jlopezlira/prjct-cli/actions/workflows/test.yml)

> 📖 **Full testing guide:** See [docs/TESTING.md](docs/TESTING.md) for detailed documentation, configuration, and best practices.

## ❓ FAQ

**Can I work on multiple tasks?**
No, by design. Single-focus philosophy. Use `/p:done` before switching.

**Difference between `/p:done` and `/p:ship`?**
`/p:done` clears focus. `/p:ship` celebrates important features with metrics.

**Where is my data stored?**
Everything is local in `~/.prjct-cli/projects/{id}/`. Never leaves your machine.

**Does it work with teams?**
Designed for creators and small teams (2-5 people). Each member has their own local data in `~/.prjct-cli/projects/{id}/`, with shared `.prjct/prjct.config.json` in the repo for project identification.

**How do I migrate from Jira/Trello?**
No migration needed. Just `/p:init` and start working.

> 💬 **More questions?** Check [prjct.app/faq](https://prjct.app/faq) or [open an issue](https://github.com/jlopezlira/prjct-cli/issues)

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

- **Node.js 18+** - Required for CLI operation
- **Claude Code or Claude Desktop** - Recommended for full features (works with free tier or Pro)
- **Terminal/CLI** - Fallback mode (limited features)

### What You Get

**With Claude Code/Desktop (Recommended):**

- ✅ Smart AI helpers for different tasks
- ✅ AI tools that help you code
- ✅ Checks your actual code changes
- ✅ Talk naturally - no commands to memorize
- ✅ Use slash commands (`/p:*`) in Claude
- ✅ Everything works

**With Terminal/CLI Only:**

- ⚠️ Basic commands work (`prjct now`, `prjct done`, etc.)
- ❌ No AI helpers
- ❌ No AI tools
- ❌ Can't talk naturally
- ❌ Doesn't check code changes
- ❌ Many features missing

**Get Claude Code at https://claude.ai/code** - Works with whatever subscription you have (free tier or Pro). No extra costs, tokens, or API keys to configure.

## ❓ FAQ

### Why Claude-only? What about Cursor/Windsurf?

**TL;DR**: By focusing 100% on Claude, we deliver features that would be impossible with multi-platform support.

**The Long Answer:**

Starting with v0.5.0, prjct-cli only supports Claude Code and Claude Desktop. This isn't a limitation - **it's a strategic decision that makes the tool better**.

**What We Gain:**

1. **🤖 Smart AI Helpers** - Get specialized help (for frontend, backend, UX, security, etc.) that activates automatically. Only works with Claude's AI system.

2. **🔗 AI Tools Built-In** - Gets library docs automatically, helps solve complex problems, creates UI components, and tests your app in a browser. Only works with Claude.

3. **✅ Code Change Verification** - Checks your actual code changes to make sure you completed what you said. Needs Claude to work.

4. **💬 Talk Naturally** - Just describe what you want - works in any language. Uses Claude's language understanding.

5. **⚡ Simpler Code** - Less code = faster features, faster bug fixes, better quality.

6. **💯 Everything Tested** - We only support what actually works and what we can test.

**But What About...**

**"I prefer Cursor/Windsurf"**

We get it! But consider:

- **No extra setup** - Works with whatever Claude subscription you have (free tier or Pro)
- **Better AI** - Latest Claude 3.5 Sonnet (Cursor/Windsurf use older models)
- **prjct-cli features** - Designed specifically for Claude's capabilities

Give Claude Code a try - you might prefer it! And if not, you can stay on v0.4.10 (last multi-editor version), though we don't recommend it.

**"This feels limiting"**

It's actually the opposite. By specializing, we can:

- Build features impossible with multi-platform (agents, MCP, git validation)
- Ship updates 2x faster (less code to maintain)
- Deliver higher quality (proper testing of everything we support)

**"What about my team?"**

prjct-cli is designed for **creators and small teams** (1-5 people) who ship fast.

For best results, standardize your team on Claude Code. Consistent tools = better collaboration. Works with whatever Claude subscription each team member has.

**"Is this a money grab?"**

**No.** There's zero financial incentive. prjct-cli works with whatever Claude subscription you have (free tier or Pro) - no extra costs, no tokens to buy, no API keys to configure.

This decision is purely **technical** - to build the best possible tool for developers who ship fast by leveraging Claude's unique capabilities.

**"Will you add back multi-editor support?"**

**No.** This was a deliberate architectural decision for v0.5.0, not a temporary change.

However, **v0.4.10 still exists** if you need multi-editor support. You can lock to that version with:

```bash
npm install -g prjct-cli@0.4.10
```

Just know you'll miss all the new features (agents, MCP, git validation, natural language).

### Can I work on multiple tasks?

No, by design. Single-focus philosophy. Use `/p:done` before switching.

### Difference between `/p:done` and `/p:ship`?

`/p:done` clears focus. `/p:ship` celebrates important features with metrics.

### Where is my data stored?

Everything is local in `~/.prjct-cli/projects/{id}/`. Never leaves your machine.

### Does it work with teams?

Designed for creators and small teams (2-5 people). Each member has their own local data in `~/.prjct-cli/projects/{id}/`, with shared `.prjct/prjct.config.json` in the repo for project identification.

### How do I migrate from Jira/Trello?

No migration needed. Just `/p:init` and start working.

> 💬 **More questions?** Check [MIGRATION.md](MIGRATION.md) or [open an issue](https://github.com/jlopezlira/prjct-cli/issues)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/Developer-Guide/contributing.md).

## 📜 License

MIT - Build something amazing!

---

**Built for builders who ship, not managers who meet.**
