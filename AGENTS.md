# AGENTS.md - OpenAI Codex Configuration

This file provides guidance to OpenAI Codex agents when working with code in this repository.

## Project Overview

**prjct-cli** is an AI-integrated project management framework designed for indie hackers and solopreneurs. It provides frictionless progress tracking through AI assistant commands without traditional project management overhead.

## Architecture

The system operates as an AI Assistant Enhancement Framework using:
- **Local filesystem storage** in `.prjct/` directory
- **Slash commands** (`/p:*`) executed within AI context
- **Cross-platform compatibility** for both OpenAI Codex and Claude Code

## Core File Structure

```
.prjct/
├── now.md       # Current focus (single task)
├── next.md      # Prioritized queue
├── shipped.md   # Completed features (wins)
├── ideas.md     # Brain dump
└── memory.jsonl # Decision history
```

## Command System

The project implements a slash command system for AI assistants. When users type `/p:` commands, execute these actions using file operations:

### Work Commands
- `/p:now [task]` - Set/show current task
- `/p:next` - Show priority queue
- `/p:done` - Complete current task
- `/p:ship <feature>` - Ship & celebrate a feature

### Planning Commands
- `/p:idea <text>` - Capture ideas quickly
- `/p:recap` - Overview of progress
- `/p:progress [period]` - Show progress metrics

### Context Commands
- `/p:init` - Initialize project
- `/p:stuck <issue>` - Get help with problems
- `/p:context` - Show project context

## Command Implementation Details

### `/p:init`
Create project management structure:
```
.prjct/
├── now.md       # Current task
├── next.md      # Task queue
├── shipped.md   # Completed features
├── ideas.md     # Idea capture
└── memory.jsonl # Activity log
```

Copy templates from `~/.prjct-cli/templates/` and customize with project info.

### `/p:now [task]`
Current task management:
- **Read mode** (no args): Display content of `.prjct/now.md`
- **Write mode** (with task): Update `.prjct/now.md`:
  ```markdown
  # NOW: [task]
  Started: [timestamp]

  ## Task
  [Full task description]

  ## Notes
  [Empty for user notes]
  ```

### `/p:done`
Mark task complete:
1. Get current task from `.prjct/now.md`
2. Reset file to "No current task"
3. Append to `.prjct/memory.jsonl`:
   ```json
   {"action":"done","task":"[task]","timestamp":"[ISO_8601]"}
   ```
4. Check `.prjct/next.md` for queued tasks

### `/p:ship <feature>`
Ship and celebrate a feature:
1. Find or create week section in `.prjct/shipped.md`:
   ```markdown
   ## Week [N], [YYYY]
   ```
2. Add entry:
   ```markdown
   - ✅ **[feature]** _(YYYY-MM-DD HH:MM)_
   ```
3. Update statistics section
4. Return celebration message with total count

### `/p:next`
Show task queue from `.prjct/next.md`:
- Display as numbered list
- If empty, suggest using `/p:idea` to capture tasks

### `/p:idea <text>`
Quick capture to `.prjct/ideas.md`:
```markdown
- [text] _(date)_
```
If text matches `^(implement|add|fix|create|build|update)`, also add to `.prjct/next.md`

### `/p:recap`
Generate project summary:
```
📊 Project Recap
🎯 Current: [from now.md]
📦 Shipped: [count] features
📝 Queued: [count] tasks
💡 Ideas: [count]
```

### `/p:progress [period]`
Calculate metrics for period (day/week/month):
- Parse `.prjct/shipped.md` for date range
- Count features in period
- Calculate velocity
- Show trend and recent features

### `/p:stuck <issue>`
Provide help based on issue type:
- **Debugging**: Step-by-step isolation approach
- **Design**: Start simple, iterate approach
- **Performance**: Measure-first optimization approach
- **General**: Task breakdown strategy

### `/p:context`
Project awareness:
1. Detect project type from files
2. Show current task
3. Display recent activity from `.prjct/memory.jsonl`

## Development Guidelines

When implementing commands:
1. Commands should execute via filesystem operations
2. Update relevant `.prjct/` files atomically
3. Return formatted responses with appropriate emojis
4. Always suggest next actions to maintain momentum

## Testing and Validation

To test the prjct command system:
1. Initialize a project with `/p:init`
2. Set a current task with `/p:now [task]`
3. Complete tasks with `/p:done`
4. Ship features with `/p:ship [feature]`
5. Check progress with `/p:recap` and `/p:progress`

## File Formats

### memory.jsonl
```json
{"action":"now","task":"implement auth","timestamp":"2024-12-28T10:00:00Z"}
{"action":"done","task":"implement auth","timestamp":"2024-12-28T14:30:00Z"}
{"action":"ship","feature":"authentication","timestamp":"2024-12-28T14:31:00Z"}
```

### Week Calculation
Use ISO 8601 week date system for consistent week numbering across features.

## Response Style

- Use emojis for visual feedback
- Confirm actions clearly
- Show relevant metrics
- Suggest next steps
- Keep messages concise and motivating

## Key Design Principles

- **Zero friction**: Commands integrate into existing AI workflow
- **Single task focus**: One task in `now.md` at a time
- **Celebration of progress**: The `/p:ship` command celebrates wins
- **Local-first**: All data stays on the developer's machine
- **No ceremonies**: No sprints, story points, or traditional PM overhead

## Environment Setup

The prjct-cli system requires:
- Node.js environment for the CLI tool (if using the binary)
- Access to local filesystem for `.prjct/` directory operations
- Ability to read/write JSON and Markdown files

## Repository Structure

```
prjct-cli/
├── AGENTS.md           # This file (OpenAI Codex configuration)
├── CLAUDE.md           # Claude Code configuration
├── README.md           # Project documentation
├── bin/                # CLI executables
├── commands/           # Command documentation
├── instructions/       # AI-specific instructions
│   ├── claude.md      # Claude-specific guide
│   └── codex.md       # Codex-specific guide
├── adapters/           # AI platform adapters
│   ├── claude/        # Claude Code adapter
│   ├── codex/         # OpenAI Codex adapter
│   └── warp/          # Warp terminal adapter
└── templates/          # Project template files
```

## Contributing

When adding new features or commands:
1. Update this AGENTS.md file with new command documentation
2. Update CLAUDE.md for Claude Code compatibility
3. Add tests for new functionality
4. Update relevant adapter documentation
5. Ensure cross-platform compatibility

## Support

For issues or questions about prjct-cli:
- Check the documentation in `/commands/` directory
- Review existing implementations in `/adapters/`
- Consult the project README.md for setup instructions