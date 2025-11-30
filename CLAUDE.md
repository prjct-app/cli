# CLAUDE.md

This file provides guidance to Claude Code when working with prjct-cli.

## Project Overview

**prjct-cli** is a developer momentum tool. Track progress through slash commands without meetings or traditional PM overhead.

## CRITICAL: Timestamp Management

**LLM DOES NOT KNOW CURRENT DATE/TIME** - Never generate timestamps manually.

### Tools (MUST USE)
- `GetTimestamp()` → ISO format: "2025-10-07T14:30:00.000Z"
- `GetDate()` → YYYY-MM-DD format: "2025-10-07"

### Rules
1. **NEVER** generate timestamps manually - All hardcoded dates are WRONG
2. **ALWAYS** call GetTimestamp() for session files (*.jsonl)
3. **ALWAYS** call GetDate() for index files (shipped.md, roadmap.md, ideas.md)

## Core Workflow

```
p. analyze    → Analyze stack, generate agents
p. feature    → Add feature with tasks
p. done       → Mark complete, next task
p. ship       → Lint/test/commit/push
```

## Architecture

### Global Storage
```
~/.prjct-cli/projects/{id}/
├── core/           # now.md, next.md, context.md
├── progress/       # shipped.md, metrics.md, sessions/
├── planning/       # ideas.md, roadmap.md, sessions/
├── analysis/       # repo-summary.md
├── memory/         # context.jsonl, sessions/
└── agents/         # Generated specialists
```

### Local Config
```
.prjct/prjct.config.json  # Links to global data via projectId
```

### Session Format (JSONL)
```jsonl
{"ts":"{GetTimestamp()}","type":"task_complete","task":"auth","duration":"2h15m"}
```

## Natural Language: p. Trigger

When message starts with `p.`:
1. Check `.prjct/prjct.config.json` exists
2. Detect intent from message
3. **USE SlashCommand tool** to execute the command

⚠️ **CRITICAL** - Always use SlashCommand, never work directly:
- ✅ `SlashCommand("/p:feature add dark mode")`
- ❌ Directly creating files without the command

If no project: "No prjct project. Run /p:init first."

### Intent Map

| User Intent | Command | What It Does |
|-------------|---------|--------------|
| Start/focus on task | `/p:now` | Sets current task |
| Finished work | `/p:done` | Marks complete |
| Ready to ship | `/p:ship` | Ship feature |
| Has an idea | `/p:idea` | Saves to backlog |
| See progress | `/p:recap` | Shows overview |
| What's next | `/p:next` | Priority queue |
| Need help | `/p:help` | Interactive guide |

**Any language works** - English, Spanish, etc.

## Command Execution

All `/p:*` commands:
1. Read `.prjct/prjct.config.json` → get projectId
2. Operate on `~/.prjct-cli/projects/{id}/`
3. Update files atomically
4. Return formatted response

### Confirmation Policy

**ALL commands MUST ask for confirmation before execution:**
1. User triggers command
2. Present plan of what will be done
3. User approves
4. Execute

### Command Distinctions

**`/p:idea`** - Quick idea capture (simple write)
**`/p:workflow`** - Multi-agent workflow management (state machine)

## Available Commands

### Work
- `/p:now [task]` - Set current task
- `/p:next` - Priority queue
- `/p:done` - Complete task
- `/p:ship <feature>` - Ship and celebrate
- `/p:bug <desc>` - Report bug

### Planning
- `/p:idea <text>` - Capture idea
- `/p:feature <desc>` - Add feature
- `/p:workflow` - Workflow status

### Progress
- `/p:recap` - Project overview
- `/p:progress [period]` - Metrics
- `/p:status` - KPI dashboard

### Help
- `/p:init` - Initialize project
- `/p:help` - Interactive guide
- `/p:ask <question>` - Intent translator
- `/p:suggest` - Smart recommendations
- `/p:analyze` - Analyze repository
- `/p:sync` - Sync state

### Quality
- `/p:cleanup` - Clean up
- `/p:design` - System design

## Agentic Architecture

prjct-cli is template-driven. Claude reads templates and executes using tools.

### Flow
```
Template (MD) → Claude reads → Claude decides → Claude uses tools → Result
```

### Structure
```
core/agentic/
├── template-loader.js    # Loads command templates
├── context-builder.js    # Builds project context
├── prompt-builder.js     # Generates prompts
├── command-executor.js   # Executes commands
└── tool-registry.js      # Maps tools

templates/commands/       # Command instructions
templates/workflows/      # Workflow guides
templates/analysis/       # Analysis instructions
```

### Templates as Source of Truth

Templates define what Claude should do:

```markdown
# /p:done

## Validation
- Requires: `core/now.md` has content

## Flow
1. Read `core/now.md` → calculate duration
2. Clear now.md
3. Update metrics

## Response
✅ {task} ({duration})
```

Claude reads this and:
1. Checks validation
2. Executes flow using tools
3. Generates response
4. Suggests next actions

## Git Commit Format

**ALL commits by prjct MUST use this footer:**

```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

**Never use:**
- "Generated with Claude Code"
- "Co-Authored-By: Claude"

## Agent Generation

Dynamic agents based on project analysis.

See `templates/agents/AGENTS.md` for reference.

Use: `generator.generateDynamicAgent(name, config)`

## Key Rules

1. **Read files before editing** - Never assume structure
2. **Use system timestamps** - Never hardcode dates
3. **Follow template instructions** - Templates are source of truth
4. **Confirm before executing** - Always show plan first
5. **Log actions** - Append to memory/context.jsonl
6. **Suggest next actions** - Maintain user momentum

## Output Philosophy

**Task completion responses MUST be concise (< 4 lines):**

Format:
```
✅ [What was done]

Files: [count] | Modified: [key file]
Next: [action]
```

**NEVER include in task summaries:**
- Tables listing files
- "Created Files" / "Modified Files" sections
- "How It Works" explanations
- Code snippets or implementation details
- Detailed breakdowns of what was done

**Example (GOOD):**
```
✅ Agentic checklists integrated

Files: 11 created | Modified: prompt-builder.js
Next: /p:ship or test with /p:now
```

**Example (BAD):**
```
Created Files:
| File | Purpose |
|------|---------|
| x.md | Does X  |
...

How It Works:
Claude reads → decides → applies...
```
