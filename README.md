# prjct

**Context layer for AI coding agents.**

Works with Claude Code, Gemini CLI, Cursor IDE, and more.

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)](CLAUDE.md)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Ready-00D4AA)]()
[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)

## What is prjct?

prjct gives AI coding agents the context they need about your project. It maintains state between sessions, tracks progress, and ensures agents understand your codebase.

```
Your AI Agent (Claude/Gemini/Cursor)     prjct
         │                                  │
         │  "What am I working on?"         │
         │ ───────────────────────────────► │
         │                                  │ Reads project context
         │  Task: "Add user auth"           │
         │  Branch: feature/auth            │
         │  Subtask 2/5: API routes         │
         │ ◄─────────────────────────────── │
         │                                  │
         ▼                                  │
    Writes code with full context           │
```

## Install

```bash
npm install -g prjct-cli
prjct start
```

## Usage

### Claude Code / Gemini CLI

Use the `p.` prefix:

```
p. sync                    # Analyze project, generate agents
p. task "add user auth"    # Start a task
p. done                    # Complete current subtask
p. ship "user auth"        # Ship with PR + version bump
```

### Cursor IDE

Use `/command` syntax:

```
/sync                      # Analyze project, generate agents
/task "add user auth"      # Start a task
/done                      # Complete current subtask
/ship "user auth"          # Ship with PR + version bump
```

### Core Workflow

```
Claude/Gemini:  p. sync  →  p. task "..."  →  [code]  →  p. done  →  p. ship
Cursor:         /sync    →  /task "..."    →  [code]  →  /done    →  /ship
```

## How It Works

| Component | Claude Code | Gemini CLI | Cursor IDE |
|-----------|-------------|------------|------------|
| Router | `~/.claude/commands/p.md` | `~/.gemini/commands/p.toml` | `.cursor/commands/*.md` |
| Config | `~/.claude/CLAUDE.md` | `~/.gemini/GEMINI.md` | `.cursor/rules/prjct.mdc` |
| Storage | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` |
| Scope | Global | Global | Per-project |
| Syntax | `p. command` | `p. command` | `/command` |

All agents share the same project storage, so you can switch between them freely.

## Commands

| Claude/Gemini | Cursor | Description |
|---------------|--------|-------------|
| `p. sync` | `/sync` | Analyze project, generate domain agents |
| `p. task "desc"` | `/task "desc"` | Start task with auto-classification |
| `p. done` | `/done` | Complete current subtask |
| `p. ship "name"` | `/ship "name"` | Ship feature with PR + version bump |
| `p. pause` | `/pause` | Pause current task |
| `p. resume` | `/resume` | Resume paused task |
| `p. bug "desc"` | `/bug "desc"` | Report a bug |
| `p. linear` | - | Linear integration |
| `p. github` | - | GitHub Issues integration |

## CLI Commands

```bash
prjct start          # First-time setup (Claude/Gemini)
prjct init           # Initialize project (+ Cursor setup)
prjct --version      # Show version + provider status
prjct --help         # Show help
```

## Requirements

- Node.js 18+ or Bun 1.0+
- One of: Claude Code, Gemini CLI, or Cursor IDE

## Links

- [Website](https://prjct.app)
- [GitHub](https://github.com/jlopezlira/prjct-cli)
- [npm](https://www.npmjs.com/package/prjct-cli)

## License

MIT
