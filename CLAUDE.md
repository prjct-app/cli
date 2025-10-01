# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**prjct-cli** is an AI-integrated project management framework designed for indie hackers, solopreneurs, and small collaborative teams (2-5 people). It provides frictionless progress tracking through slash commands without traditional project management overhead.

## Architecture

The system operates as an AI Assistant Enhancement Framework using:

- **Global data storage** in `~/.prjct-cli/projects/{project-id}/`
- **Local configuration** in `.prjct/prjct.config.json` (references global data)
- **Slash commands** (`/p:*`) executed within Claude Code
- **MCP (Model Context Protocol) servers** for AI integration

### Global Structure

```
~/.prjct-cli/projects/{id}/
├── core/           # Current focus and priorities
│   ├── now.md      # Single current task
│   ├── next.md     # Priority queue
│   └── context.md  # Project context
├── progress/       # Completed work
│   ├── shipped.md  # Shipped features
│   └── metrics.md  # Progress tracking
├── planning/       # Future planning
│   ├── ideas.md    # Brainstorm backlog
│   └── roadmap.md  # Strategic planning
├── analysis/       # Technical analysis
│   └── repo-summary.md
└── memory/         # Decision history
    └── context.jsonl
```

### Local Configuration

```
.prjct/
└── prjct.config.json  # Links to global data
```

## Command System for Claude Code

All commands use the `/p:*` syntax in Claude Code. When executed, they:
1. Read `.prjct/prjct.config.json` to get the project ID
2. Operate on files in `~/.prjct-cli/projects/{id}/`
3. Update relevant markdown files atomically
4. Return formatted responses with emojis

### Work Commands

- `/p:now [task]` - Set/show current task
- `/p:next` - Show priority queue
- `/p:done` - Complete current task
- `/p:ship <feature>` - Ship & celebrate a feature

### Planning Commands

- `/p:idea <text>` - Capture ideas quickly

### Design & Architecture

- `/p:design <target> --type` - Create system designs with diagrams (architecture|api|component|database|flow)

### Code Quality

- `/p:cleanup` - Basic cleanup of temp files and old entries
- `/p:cleanup --type code` - Advanced code cleanup (code|imports|files|deps|all)

### Progress Commands

- `/p:recap` - Overview of progress
- `/p:progress [period]` - Show progress metrics
- `/p:context` - Show project context

### Help Commands

- `/p:init` - Initialize project
- `/p:stuck <issue>` - Get help with problems
- `/p:analyze` - Analyze repository and sync tasks

### Additional Commands

- `/p:git` - Git operations with context
- `/p:task` - Complex task management
- `/p:test` - Test execution
- `/p:roadmap` - Strategic planning
- `/p:fix` - Quick troubleshooting

**Total: 18 Commands**

## Initialization Process

When you execute `/p:init` in Claude Code:

1. Generate unique project ID from path hash
2. Create global directory structure in `~/.prjct-cli/projects/{id}/`
3. Create local config at `.prjct/prjct.config.json` with:
   - version
   - projectId
   - dataPath (pointing to global location)
   - author info (from GitHub CLI or git config)
4. Initialize all markdown files with templates
5. Log initialization to `memory/context.jsonl`

## MCP Integration

**Context7 MCP is ALWAYS enabled** - automatic library documentation and framework patterns.

The system integrates with these MCP servers:

- **Context7**: Official library documentation lookup (ALWAYS available)
  - Use for: React, Vue, Angular, Next.js, Express, any npm package
  - Auto-activates when importing libraries or asking about frameworks
  - Examples: "implement React hooks", "Next.js routing patterns", "Express middleware"

- **Filesystem**: Direct file manipulation (ALWAYS available)
- **Memory**: Persistent decision storage (ALWAYS available)
- **Sequential**: Deep reasoning for complex problems (ALWAYS available)

### Using Context7 Effectively

**When to use**:
- Implementing features with external libraries
- Framework-specific questions and patterns
- API documentation lookup
- Best practices for any library

**How it works**:
- Automatically provides official docs when you import libraries
- Returns curated, version-specific documentation
- Includes code examples and implementation patterns

## Development Guidelines

When implementing commands in Claude Code:

1. Commands execute via MCP filesystem operations
2. Always read `.prjct/prjct.config.json` first to get project ID
3. Construct paths to global data: `~/.prjct-cli/projects/{id}/...`
4. Update relevant files atomically
5. Return formatted responses with appropriate emojis
6. Always suggest next actions to maintain momentum
7. Log all actions to `memory/context.jsonl` with timestamp and author

## Key Design Principles

- **Zero friction**: Commands integrate into existing AI workflow
- **Single task focus**: One task in `now.md` at a time
- **Celebration of progress**: The `/p:ship` command celebrates wins
- **Local-first**: All data stays on the developer's machine
- **Global architecture**: Centralized data, minimal project footprint
- **No ceremonies**: No sprints, story points, or traditional PM overhead
