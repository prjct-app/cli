# prjct

**Context layer for AI coding agents.**

Works with Claude Code, Gemini CLI, OpenAI Codex, Antigravity, Cursor IDE, Windsurf, and more.

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)](CLAUDE.md)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![OpenAI Codex](https://img.shields.io/badge/OpenAI%20Codex-Ready-10A37F)]()
[![Antigravity](https://img.shields.io/badge/Antigravity-Ready-EA4335)]()
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Ready-00D4AA)]()
[![Windsurf](https://img.shields.io/badge/Windsurf-Ready-7C3AED)]()
[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)

## What is prjct?

prjct gives AI coding agents the context they need about your project. It maintains state between sessions, tracks progress, and ensures agents understand your codebase.

```
Your AI Agent                              prjct
(Claude/Gemini/Codex/Cursor/Windsurf)        |
         |                                   |
         |  "What am I working on?"          |
         | --------------------------------> |
         |                                   | Reads project context
         |  Task: "Add user auth"            |
         |  Branch: feature/auth             |
         |  Subtask 2/5: API routes          |
         | <-------------------------------- |
         |                                   |
         v                                   |
    Writes code with full context            |
```

## Install

```bash
npm install -g prjct-cli
```

## Quick Start

### Claude Code / Gemini CLI / OpenAI Codex

```bash
# 1. One-time global setup
prjct start

# 2. Initialize your project
cd my-project
prjct init

# 3. Open in Claude Code, Gemini CLI, or Codex and use:
p. sync                    # Analyze project
p. task "add user auth"    # Start a task
p. done                    # Complete task
p. ship                    # Ship with PR
```

### Cursor IDE / Windsurf

```bash
# 1. Initialize your project (no global setup needed)
cd my-project
prjct init

# 2. Open in Cursor or Windsurf and use:
/sync                      # Analyze project
/task "add user auth"      # Start a task
/done                      # Complete task
/ship                      # Ship with PR
```

> Cursor uses `.cursor/commands/`, Windsurf uses `.windsurf/` with YAML frontmatter. Run `/sync` to regenerate if deleted.

### Core Workflow

```
Claude/Gemini/Codex:  p. sync  ->  p. task "..."  ->  [code]  ->  p. done  ->  p. ship
Cursor/Windsurf:      /sync    ->  /task "..."    ->  [code]  ->  /done    ->  /ship
```

## How It Works

| Component | Claude Code | Gemini CLI | OpenAI Codex | Antigravity | Cursor IDE | Windsurf |
|-----------|-------------|------------|--------------|-------------|------------|----------|
| Router | `~/.claude/commands/p.md` | `~/.gemini/commands/p.toml` | `~/.codex/skills/prjct/SKILL.md` | Skill | `.cursor/commands/*.md` | `.windsurf/*.md` |
| Config | `~/.claude/CLAUDE.md` | `~/.gemini/GEMINI.md` | `AGENTS.md` | `~/.gemini/antigravity/skills/prjct/` | `.cursor/rules/prjct.mdc` | `.windsurf/` (YAML) |
| Storage | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` |
| Syntax | `p. command` | `p. command` | `p. command` | `p. command` | `/command` | `/command` |

All agents share the same SQLite-backed project storage, so you can switch between them freely.

## Commands

### Core Workflow

| Claude/Gemini | Cursor/Windsurf | Description |
|---------------|-----------------|-------------|
| `p. sync` | `/sync` | Analyze project, build indexes, generate skills |
| `p. task "desc"` | `/task "desc"` | Start task with auto-classification |
| `p. done` | `/done` | Complete current task |
| `p. ship "name"` | `/ship "name"` | Ship feature with PR + version bump |
| `p. pause` | `/pause` | Pause current task |
| `p. resume` | `/resume` | Resume paused task |
| `p. next` | `/next` | Show priority queue or roadmap |
| `p. bug "desc"` | `/bug "desc"` | Report and track a bug |
| `p. idea "desc"` | `/idea "desc"` | Transform idea into technical architecture |
| `p. spec` | `/spec` | Create detailed spec for complex features |
| `p. dash` | `/dash` | Unified dashboard (status, progress, roadmap) |
| `p. suggest` | `/suggest` | Smart recommendations based on project state |

### Analysis & Performance

| Command | Description |
|---------|-------------|
| `p. status` | Check if context is stale |
| `p. perf` | Performance dashboard (startup, memory, context) |
| `p. velocity` | Sprint-based velocity with trend detection |
| `p. tokens <in> <out>` | Record token usage on active task |
| `p. stats` | Value dashboard (token savings, impact) |
| `p. sessions` | Show recent sessions across projects |
| `p. diff` | Diff between draft and sealed analysis |
| `p. seal` | Seal analysis with commit-hash signature |
| `p. verify` | Verify integrity (cryptographic or `--semantic`) |
| `p. rollback` | Rollback to previous sealed analysis |

### Advanced

| Command | Description |
|---------|-------------|
| `p. design` | Design system architecture, APIs, components |
| `p. enrich "issue"` | Build enrichment context for an issue |
| `p. workflow` | Configure workflow hooks via natural language |
| `p. git` | Smart git operations with context |
| `p. test` | Run tests with auto-fix |
| `p. undo` / `p. redo` | Snapshot-based undo/redo |
| `p. recover` | Recover abandoned session with context |
| `p. linear` | Linear integration via MCP |
| `p. jira` | Jira integration via MCP |

### Parallel Agent Sessions

Run multiple AI agents on different tasks simultaneously, each in an isolated git worktree.

| Command | Description |
|---------|-------------|
| `p. parallel spawn "task"` | Spawn agent in isolated worktree |
| `p. parallel status` | Show all active agents |
| `p. parallel join` | Merge completed branches back |
| `p. worktree create` | Create worktree (auto-copies .env, installs deps) |
| `p. worktree list` | List active worktrees |
| `p. worktree remove` | Clean up completed worktrees |
| `p. conductor init` | Scaffold Conductor.build integration |

## CLI Commands

Commands you run directly in the terminal (outside your AI agent):

```bash
prjct start              # First-time setup wizard
prjct init               # Initialize project
prjct sync               # Analyze project and build indexes
prjct doctor             # Check system health and dependencies
prjct serve              # Start web dashboard (port 3478)
prjct watch              # Auto-sync on file changes
prjct hooks              # Manage git hooks for auto-sync
prjct context            # Smart context filtering tools
prjct enrich             # Prepare issue enrichment context
prjct linear             # Linear MCP gateway
prjct jira               # Jira MCP gateway
prjct login              # Authenticate with prjct cloud (opens browser)
prjct logout             # Sign out from prjct cloud
prjct update             # Update CLI system-wide
prjct stop               # Stop the background daemon
prjct restart            # Restart the background daemon
prjct uninstall          # Complete system removal
prjct --version          # Show version + provider status
prjct --help             # Show help
```

## Code Intelligence

`prjct sync` builds a triple-index system over your codebase:

| Index | Purpose |
|-------|---------|
| **BM25** | Full-text search over file names, symbols, comments |
| **Import Graph** | Dependency graph with forward and reverse edges |
| **Git Co-change** | Files that frequently change together |

These indexes power file ranking, impact analysis, and related-context suggestions for your AI agent.

## MCP Server

prjct exposes an MCP server with tools that AI agents can call directly:

| Category | Tools | Examples |
|----------|-------|---------|
| **Memory** | 8 | Save/search memories, record decisions, manage preferences |
| **Session** | 4 | Start sessions, recover context, record outcomes |
| **Code Intelligence** | 3 | Impact analysis, related files, staleness check |
| **Workflow** | 4 | Task and session management |
| **File** | 3 | File reading and filtering |
| **Pattern** | 3 | Pattern extraction and matching |
| **Review** | 3 | Code review context |
| **Project** | 4 | Project-level operations |

The memory system uses FTS5 full-text search, tracks decision outcomes ("did this work before?"), and auto-captures patterns during normal workflow.

## Web Dashboard

```bash
prjct serve
```

Starts an HTTP server on port 3478 with:

- REST API for project state, task queue, ideas, roadmap, shipped features
- SSE (Server-Sent Events) for real-time updates
- Status bar endpoint for IDE integration (`/api/status-bar/compact`)
- Global statistics across all projects

Built with Hono, supports both Bun and Node.js runtimes.

## Cloud Sync

```bash
prjct login              # Browser-based OTP authentication
prjct sync               # Bidirectional push/pull with prjct cloud
```

Cloud sync enables:
- Cross-device project state synchronization
- Event-sourced bidirectional push/pull
- Automatic sync on task completion

## Issue Tracker Integration

Issue trackers are configured via MCP (OAuth in your AI client), not API tokens.

```bash
# Linear
prjct linear setup       # Configure Linear MCP server
prjct linear status      # Verify config
# Then use: p. linear sync|list|get|create|update|start|done|comment

# Jira
prjct jira setup         # Configure Jira MCP server
prjct jira status        # Verify config
# Then use: p. jira sync|list|get|create|update|start|done|transition|comment
```

## Analysis Verification

```bash
prjct verify             # Cryptographic: hash signature integrity
prjct verify --semantic  # Semantic: frameworks, languages, file counts match reality
```

Both modes support `--json` for programmatic use.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PRJCT_CLI_HOME` | `~/.prjct-cli` | Override global storage location |
| `PRJCT_DEBUG` | _(unset)_ | Enable debug logging (`1`, `true`, or log level) |
| `DEBUG` | _(unset)_ | Fallback debug flag (`1`, `true`, or `prjct`) |
| `CI` | _(unset)_ | Set in CI environments; skips interactive prompts |

## Architecture

```
prjct-cli/
  core/
    commands/       # CLI command handlers
    domain/         # BM25, import graph, co-change, velocity
    infrastructure/ # Config, path manager, AI provider detection
    mcp/            # MCP server (48 tools)
    schemas/        # Zod schemas (PRD, model, etc.)
    server/         # Hono HTTP server + SSE
    services/       # Memory, sync, code intel, skills, doctor
    storage/        # SQLite via better-sqlite3
    sync/           # Cloud sync client + event mapping
    types/          # TypeScript type definitions
    utils/          # Shared utilities
  templates/        # Skill templates per editor
```

## Requirements

- Node.js 18+ or Bun 1.0+
- One of: Claude Code, Gemini CLI, OpenAI Codex, Antigravity, Cursor IDE, or Windsurf

## Links

- [Website](https://prjct.app)
- [GitHub](https://github.com/jlopezlira/prjct-cli)
- [npm](https://www.npmjs.com/package/prjct-cli)

## License

MIT
