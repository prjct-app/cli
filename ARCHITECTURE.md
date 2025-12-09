# Architecture

prjct-cli uses a **template-driven agentic architecture** where JavaScript handles orchestration and Claude makes all decisions via templates.

## Core Principle

```
JS = Orchestrator (load files, build context, format data, I/O)
Claude = Decision Maker (via templates for all logic)
```

No scoring algorithms, no matching weights, no domain mappings in code. Claude decides everything.

## High-Level Flow

```
User Input → Slash Command → Command Executor → Template Loader
                                    ↓
                         Context Builder → Prompt Builder → Claude
                                    ↓
                         Tool Execution → Response → Next Action
```

## Directory Structure

### Core Runtime (`/core/`)

```
core/
├── agentic/                    # Agentic execution system
│   ├── command-executor.js     # Orchestrates command execution
│   ├── template-loader.js      # Loads command templates
│   ├── context-builder.js      # Builds project context
│   ├── prompt-builder.js       # Generates prompts for Claude
│   ├── tool-registry.js        # Maps tools Claude can use
│   ├── agent-router.js         # Routes to specialist agents
│   ├── memory-system.js        # Persistent memory (context.jsonl)
│   ├── loop-detector.js        # Prevents infinite loops
│   ├── ground-truth.js         # Git validation
│   ├── chain-of-thought.js     # Reasoning support
│   ├── semantic-compression.js # Context compression
│   ├── plan-mode.js            # Plan-before-execute mode
│   ├── parallel-tools.js       # Parallel tool execution
│   ├── think-blocks.js         # Thinking/reasoning blocks
│   ├── validation-rules.js     # Input validation
│   └── response-templates.js   # Output formatting
├── domain/                     # Domain-specific logic
│   └── agent-generator.js      # Generates specialist agents
├── infrastructure/             # Infrastructure utilities
├── command-registry.js         # Command metadata
└── index.js                    # CLI entry point
```

### Templates (`/templates/`)

Templates are the **source of truth** for what Claude should do:

```
templates/
├── commands/           # One per slash command (36 files)
│   ├── now.md          # /p:now
│   ├── done.md         # /p:done
│   ├── ship.md         # /p:ship
│   ├── init.md         # /p:init
│   └── ...
├── analysis/           # Analysis instructions
│   ├── complexity.md
│   ├── task-breakdown.md
│   └── patterns.md
├── design/             # Design guidance
│   ├── architecture.md
│   ├── api.md
│   └── component.md
├── agents/             # Agent generation
│   └── AGENTS.md
├── checklists/         # Quality checklists
│   ├── code-quality.md
│   ├── security.md
│   └── testing.md
└── agentic/            # Routing logic
    ├── agent-routing.md
    └── checklist-routing.md
```

## Data Storage

### Global Storage (`~/.prjct-cli/projects/{projectId}/`)

All project data lives in global storage, NOT in the repo:

```
{projectId}/
├── core/               # Current focus
│   ├── now.md          # Active task
│   ├── next.md         # Priority queue
│   └── context.md      # Project context
├── progress/           # Completed work
│   ├── shipped.md      # Ship history
│   └── metrics.md      # Velocity stats
├── planning/           # Future work
│   ├── ideas.md        # Brain dump
│   └── roadmap.md      # Feature roadmap
├── analysis/           # Technical analysis
│   └── repo-summary.md # Auto-generated analysis
├── memory/             # Activity log
│   └── context.jsonl   # Append-only event log
├── sessions/           # Session tracking
│   └── current.json    # Active session
└── agents/             # Generated specialists
    └── *.md            # fe.md, be.md, etc.
```

### Local Config (`.prjct/prjct.config.json`)

Only a small config file lives in the repo:

```json
{
  "version": "0.11.0",
  "projectId": "abc123def456",
  "dataPath": "~/.prjct-cli/projects/abc123def456"
}
```

This separation ensures:
- **No repo bloat** - Project data stays out of git
- **Privacy** - Personal productivity data stays local
- **Clean separation** - Only config in repo
- **Multi-machine ready** - Ready for future sync features

## Command Execution Flow

1. **Slash command invoked** - `/p:now "implement auth"`
2. **Command Executor** starts - Loads template from `templates/commands/now.md`
3. **Context Builder** gathers state - Reads now.md, next.md, config, etc.
4. **Prompt Builder** combines - Template + context → full prompt
5. **Claude executes** - Receives prompt, uses allowed tools
6. **Response formatted** - Per template instructions
7. **Memory logged** - Action appended to context.jsonl

## Template Anatomy

Templates use YAML frontmatter and procedural markdown:

```markdown
---
allowed-tools: [Read, Write, Bash]
description: 'Set current task with session tracking'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
---

# /p:now - Current Task

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{nowPath}`: `{globalPath}/core/now.md`

## Step 1: Read Config
READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Current State
READ: `{nowPath}`
...

## Response
🎯 {task}
```

### Frontmatter Fields

| Field | Purpose |
|-------|---------|
| `allowed-tools` | Tools Claude can use for this command |
| `description` | Command description |
| `timestamp-rule` | How to generate timestamps |

## Dynamic Agent System

Specialist agents are auto-generated based on project analysis:

1. `/p:sync` or `/p:init` triggers analysis
2. `repo-summary.md` identifies tech stack
3. `AgentGenerator` creates specialist agents
4. Agents stored in `agents/*.md`
5. `agent-router.js` routes tasks to specialists

### Example Agents

| Agent | Expertise |
|-------|-----------|
| `fe.md` | Frontend (React, Vue, etc.) |
| `be.md` | Backend (Node, Python, etc.) |
| `db.md` | Database (SQL, MongoDB, etc.) |
| `test.md` | Testing patterns |
| `devops.md` | CI/CD, deployment |

## Key Design Decisions

### Why Template-Driven?

- **No hardcoded logic** - Claude decides everything
- **Easy to modify** - Change behavior by editing markdown
- **Self-documenting** - Templates explain what they do
- **Language-agnostic** - Intent detection works in any language
- **Extensible** - Add commands by adding templates

### Why Global Storage?

- **No repo bloat** - Project data stays out of git
- **Privacy** - Personal productivity data stays local
- **Clean separation** - Only `prjct.config.json` in repo
- **Multi-machine** - Ready for future sync features

### Why Claude-Only?

- **Deep integration** - MCP, agents, natural language
- **Better quality** - Optimize for one platform
- **Simpler codebase** - No multi-editor abstractions
- **Honest compatibility** - Test what we support

## Adding New Commands

1. Create `templates/commands/{command}.md`
2. Define YAML frontmatter (allowed-tools, description)
3. Document validation, flow, and response format
4. Command automatically available via `/p:{command}`

No code changes needed - the system reads templates dynamically.

## Module Reference

| Module | Responsibility |
|--------|----------------|
| `command-executor.js` | Orchestrates full execution flow |
| `template-loader.js` | Loads and parses command templates |
| `context-builder.js` | Gathers project state for context |
| `prompt-builder.js` | Combines template + context into prompt |
| `tool-registry.js` | Defines available tools per command |
| `agent-router.js` | Routes to specialist agents |
| `memory-system.js` | Logs actions to context.jsonl |
| `ground-truth.js` | Validates against git state |
| `loop-detector.js` | Prevents infinite execution loops |

## Further Reading

- [CLAUDE.md](CLAUDE.md) - Claude-specific guidance
- [CONTRIBUTING.md](docs/Developer-Guide/contributing.md) - Contribution guide
- [TESTING.md](docs/TESTING.md) - Testing guide
- [docs/API.md](docs/API.md) - Data format reference
