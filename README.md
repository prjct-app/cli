# prjct

**Context layer for AI coding agents.**

Works with Claude Code, Gemini CLI, and more.

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)](CLAUDE.md)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)

## What is prjct?

prjct gives AI coding agents the context they need about your project. It maintains state between sessions, tracks progress, and ensures agents understand your codebase.

```
Your AI Agent (Claude/Gemini)     prjct
         │                          │
         │  "What am I working on?" │
         │ ───────────────────────► │
         │                          │ Reads project context
         │  Task: "Add user auth"   │
         │  Branch: feature/auth    │
         │  Subtask 2/5: API routes │
         │ ◄─────────────────────── │
         │                          │
         ▼                          │
    Writes code with full context   │
```

## Install

```bash
npm install -g prjct-cli
prjct start
```

## Usage

Inside Claude Code or Gemini CLI, use the `p.` prefix:

```
p. sync                    # Analyze project, generate agents
p. task "add user auth"    # Start a task
p. done                    # Complete current subtask
p. ship "user auth"        # Ship with PR + version bump
```

### Core Workflow

```
p. sync  →  p. task "..."  →  [code]  →  p. done  →  p. ship
```

## How It Works

| Component | Claude Code | Gemini CLI |
|-----------|-------------|------------|
| Router | `~/.claude/commands/p.md` | `~/.gemini/commands/p.toml` |
| Config | `~/.claude/CLAUDE.md` | `~/.gemini/GEMINI.md` |
| Storage | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` |

Both agents share the same project storage, so you can switch between them freely.

## Commands

| Command | Description |
|---------|-------------|
| `p. sync` | Analyze project, generate domain agents |
| `p. task "desc"` | Start task with auto-classification |
| `p. done` | Complete current subtask |
| `p. ship "name"` | Ship feature with PR + version bump |
| `p. pause` | Pause current task |
| `p. resume` | Resume paused task |
| `p. linear` | Linear integration |
| `p. github` | GitHub Issues integration |

## CLI Commands

```bash
prjct start          # First-time setup
prjct --version      # Show version + provider status
prjct --help         # Show help
prjct init           # Initialize project
prjct sync           # Sync project state
```

## Requirements

- Node.js 18+ or Bun 1.0+
- Claude Code and/or Gemini CLI

## Links

- [Website](https://prjct.app)
- [GitHub](https://github.com/jlopezlira/prjct-cli)
- [npm](https://www.npmjs.com/package/prjct-cli)

## License

MIT
