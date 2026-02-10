# prjct

**Context layer for AI coding agents.**

Works with Claude Code, Gemini CLI, Antigravity, Cursor IDE, and more.

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)](CLAUDE.md)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Ready-4285F4)]()
[![Antigravity](https://img.shields.io/badge/Antigravity-Ready-EA4335)]()
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Ready-00D4AA)]()
[![npm](https://img.shields.io/npm/v/prjct-cli)](https://www.npmjs.com/package/prjct-cli)

## What is prjct?

prjct gives AI coding agents the context they need about your project. It maintains state between sessions, tracks progress, and ensures agents understand your codebase.

```
Your AI Agent                              prjct
(Claude/Gemini/Antigravity/Cursor)           │
         │                                   │
         │  "What am I working on?"          │
         │ ────────────────────────────────► │
         │                                   │ Reads project context
         │  Task: "Add user auth"            │
         │  Branch: feature/auth             │
         │  Subtask 2/5: API routes          │
         │ ◄──────────────────────────────── │
         │                                   │
         ▼                                   │
    Writes code with full context            │
```

## Install

```bash
npm install -g prjct-cli
```

## Quick Start

### Claude Code / Gemini CLI

```bash
# 1. One-time global setup
prjct start

# 2. Initialize your project
cd my-project
prjct init

# 3. Open in Claude Code or Gemini CLI and use:
p. sync                    # Analyze project
p. task "add user auth"    # Start a task
p. done                    # Complete subtask
p. ship                    # Ship with PR
```

### Google Antigravity

```bash
# 1. One-time global setup (installs prjct as a skill)
prjct start

# 2. Initialize your project
cd my-project
prjct init

# 3. Open in Antigravity and use:
p. sync                    # Analyze project
p. task "add user auth"    # Start a task
p. done                    # Complete subtask
p. ship                    # Ship with PR
```

> **Note:** prjct integrates as a Skill (not MCP server) for zero-overhead operation.

### Cursor IDE

```bash
# 1. Initialize your project (no global setup needed)
cd my-project
prjct init

# 2. Open in Cursor and use:
/sync                      # Analyze project
/task "add user auth"      # Start a task
/done                      # Complete subtask
/ship                      # Ship with PR
```

> **Note:** Cursor uses `/command` syntax. Commands are installed per-project in `.cursor/commands/`. If deleted, run `/sync` to regenerate.

### Core Workflow

```
Claude/Gemini/Antigravity:  p. sync  →  p. task "..."  →  [code]  →  p. done  →  p. ship
Cursor:                     /sync    →  /task "..."    →  [code]  →  /done    →  /ship
```

## How It Works

| Component | Claude Code | Gemini CLI | Antigravity | Cursor IDE |
|-----------|-------------|------------|-------------|------------|
| Router | `~/.claude/commands/p.md` | `~/.gemini/commands/p.toml` | Skill | `.cursor/commands/*.md` |
| Config | `~/.claude/CLAUDE.md` | `~/.gemini/GEMINI.md` | `~/.gemini/antigravity/skills/prjct/` | `.cursor/rules/prjct.mdc` |
| Storage | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` | `~/.prjct-cli/projects/` |
| Scope | Global | Global | Global | Per-project |
| Syntax | `p. command` | `p. command` | `p. command` | `/command` |

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
prjct sync           # Analyze project and generate context
prjct verify         # Verify analysis integrity (cryptographic)
prjct verify --semantic  # Verify analysis consistency (semantic)
prjct --version      # Show version + provider status
prjct --help         # Show help
```

### Analysis Verification

prjct provides two types of analysis verification to ensure data integrity and logical consistency:

#### Cryptographic Verification (Default)
```bash
prjct verify [--json]
```

Verifies the integrity of sealed analysis results using cryptographic signatures. This ensures:
- Analysis data hasn't been tampered with
- Sealed analysis matches the original analysis
- Hash signatures are valid

**When to use:** After sealing an analysis (`prjct seal`) to confirm data integrity.

#### Semantic Verification (PRJ-270)
```bash
prjct verify --semantic [--json]
```

Validates that analysis results match the actual project state. This checks:
- ✓ **Frameworks** exist in `package.json` dependencies
- ✓ **Languages** match actual file extensions (.ts → TypeScript)
- ✓ **Pattern locations** reference real files in the project
- ✓ **File count** is accurate (within 10% tolerance)
- ✓ **Anti-pattern files** exist when referenced

**When to use:** Before sealing an analysis to catch logical inconsistencies or after project changes to validate analysis accuracy.

**Example output:**
```
Semantic Verification Report
────────────────────────────
  ✓ Framework verification: passed (2 frameworks validated)
  ✓ Language verification: passed (1 language validated)
  ✓ Pattern locations: passed (12 patterns verified)
  ✓ File count verification: passed (324 files, within tolerance)
  ✓ Anti-pattern files: passed (3 anti-patterns verified)

Result: PASSED (5/5 checks)
Total time: 145ms
```

Both verification modes support `--json` flag for programmatic use.

## Environment Variables

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PRJCT_CLI_HOME` | `~/.prjct-cli` | Override global storage location. Useful for tests or sandboxed environments. |
| `PRJCT_DEBUG` | _(unset)_ | Enable debug logging. Values: `1`, `true`, or a log level (`error`, `warn`, `info`, `debug`). |
| `DEBUG` | _(unset)_ | Fallback debug flag (used if `PRJCT_DEBUG` is not set). Values: `1`, `true`, or `prjct`. |
| `CI` | _(unset)_ | Set automatically in CI environments. Skips interactive prompts. |

### JIRA Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `JIRA_BASE_URL` | _(none)_ | JIRA instance URL (e.g., `https://myorg.atlassian.net`). |
| `JIRA_EMAIL` | _(none)_ | Email for JIRA API authentication. |
| `JIRA_API_TOKEN` | _(none)_ | API token for JIRA authentication. Generate at [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens). |

### Agent Detection (Auto-set)

These are typically set by the AI agent runtime, not by users:

| Variable | Description |
|----------|-------------|
| `CLAUDE_AGENT` | Set when running inside Claude Code. |
| `ANTHROPIC_CLAUDE` | Alternative Claude environment indicator. |
| `MCP_AVAILABLE` | Set when MCP (Model Context Protocol) is available. |
| `HOME` / `USERPROFILE` | Standard OS home directory (used for path resolution). |

### Usage Examples

```bash
# Enable debug logging
PRJCT_DEBUG=1 prjct sync

# Use a custom storage location
PRJCT_CLI_HOME=/tmp/prjct-test prjct init

# Configure JIRA integration via env vars
export JIRA_BASE_URL=https://myorg.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=your-api-token
prjct jira setup
```

## Requirements

- Node.js 18+ or Bun 1.0+
- One of: Claude Code, Gemini CLI, Antigravity, or Cursor IDE

## Links

- [Website](https://prjct.app)
- [GitHub](https://github.com/jlopezlira/prjct-cli)
- [npm](https://www.npmjs.com/package/prjct-cli)

## License

MIT
