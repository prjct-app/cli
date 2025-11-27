<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct Configuration

This section provides global context for all `/p:*` commands across any prjct project.

**Auto-managed by prjct-cli** - This section is automatically updated when you install or update prjct.

## 🚀 Quick Command Reference

| Command | Purpose | Example |
|---------|---------|---------|
| `/p:sync` | Analyze project & generate agents | Run first in any project |
| `/p:now [task]` | Set current focus | `/p:now "implement auth"` |
| `/p:done` | Complete current task | After finishing work |
| `/p:next` | Show priority queue | See what's pending |
| `/p:ship [feature]` | Ship & celebrate | `/p:ship "user login"` |
| `/p:feature [desc]` | Add feature to roadmap | `/p:feature "dark mode"` |
| `/p:idea [text]` | Quick idea capture | `/p:idea "add caching"` |
| `/p:recap` | Project overview | Status check |
| `/p:progress` | Show metrics | Weekly/monthly stats |

## 🎯 Recommended Workflow

```
1. /p:sync          → Analyze project, generate agents
2. /p:feature       → Plan what to build
3. /p:now           → Start working
4. [code...]        → Do the actual work
5. /p:done          → Mark complete
6. /p:ship          → Celebrate & commit
```

## 🤖 Project Context (CRITICAL)

**BEFORE working on any prjct project, READ the project context:**

1. Read `.prjct/prjct.config.json` → get `projectId`
2. Read `~/.prjct-cli/projects/{projectId}/CLAUDE.md` → dynamic project context

The project CLAUDE.md contains:
- Tech stack (languages, frameworks, dependencies)
- Project structure (directories)
- Available agents with their expertise
- Current task and priority queue
- Recent git activity
- Active roadmap features

**If CLAUDE.md doesn't exist**: Suggest running `/p:sync` to generate it.

## 📋 Common Usage Patterns

### Starting Work on a Project
```
User: "p. sync"
→ Analyze repo, generate agents, create context
→ Now Claude knows: stack, structure, agents available
```

### Adding a New Feature
```
User: "p. feature add user authentication"
→ Creates roadmap entry with tasks
→ Analyzes impact and effort
→ Suggests starting first task
```

### Daily Development Flow
```
User: "p. now implement login form"
→ Sets current focus
→ [User works on code]
User: "p. done"
→ Marks complete, suggests next task
User: "p. ship authentication"
→ Commits, celebrates, updates metrics
```

### Quick Idea Capture
```
User: "p. idea we should add dark mode later"
→ Saves to ideas.md
→ Doesn't interrupt current work
```

## ⚠️ Anti-Patterns (What NOT to Do)

| ❌ Don't | ✅ Do Instead |
|----------|---------------|
| Write to `.prjct/` folder | Write to `~/.prjct-cli/projects/{id}/` |
| Skip reading project context | Always read CLAUDE.md first |
| Execute without projectId | Check `.prjct/prjct.config.json` exists |
| Hardcode file paths | Use projectId to construct paths |
| Ignore agents | Use specialized agents for their domains |

## 🎯 Path Resolution for ALL /p:* Commands

**CRITICAL**: Every `/p:*` command operates on **global storage**, NOT local files.

### Resolution Steps:

1. **Detect prjct project**: Check if `.prjct/prjct.config.json` exists
2. **Read config**: Extract `projectId` from config
3. **Construct base path**: `~/.prjct-cli/projects/{projectId}/`
4. **Resolve all file operations**: Paths are relative to base path

### Examples:

```
Template says: "Write: core/now.md"
Actual path:  ~/.prjct-cli/projects/{projectId}/core/now.md

Template says: "Read: memory/context.jsonl"
Actual path:  ~/.prjct-cli/projects/{projectId}/memory/context.jsonl
```

### Validation Rules:

- ❌ **NEVER** write to `.prjct/core/now.md` (local project directory)
- ❌ **NEVER** write to `./core/now.md` (current working directory)
- ✅ **ALWAYS** write to `~/.prjct-cli/projects/{projectId}/core/now.md`

### When NOT in prjct Project:

If `.prjct/prjct.config.json` doesn't exist:
- Respond: "No prjct project detected. Initialize first with `/p:init`"
- Do NOT execute the command
- Do NOT create files

## 📁 File Structure

All prjct data lives in global storage:

```
~/.prjct-cli/projects/{projectId}/
├── CLAUDE.md            # ⭐ READ THIS FIRST - Rich project context
├── core/                # Current focus
│   ├── now.md          # Single current task
│   └── next.md         # Priority queue
├── progress/           # Completed work
│   ├── shipped.md      # Recent ships
│   └── metrics.md      # Aggregated metrics
├── planning/           # Future planning
│   ├── ideas.md        # Quick ideas
│   └── roadmap.md      # Feature roadmap
├── analysis/           # Technical analysis
│   └── repo-summary.md # Full repo analysis
├── memory/             # Decision history
│   └── context.jsonl   # Append-only log
└── agents/             # ⭐ Specialized AI agents
    ├── fe.md           # Frontend specialist
    ├── be.md           # Backend specialist
    └── ...             # More based on stack
```

## 🤖 Using Agents Effectively

When project has specialized agents:

1. **Read agent file** before working in that domain
2. **Follow agent patterns** for code style and architecture
3. **Agent expertise** is in CLAUDE.md summary

Example:
```
Task: "implement React component"
→ Check CLAUDE.md for frontend agent
→ Read agents/fe.md for React patterns
→ Follow detected conventions
```

## 🤖 Git Commit Format

**ALL commits made by prjct MUST use this footer:**

```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

**Never use:**
- ❌ "Generated with Claude Code"
- ❌ "Co-Authored-By: Claude"

## ⚠️ Common Validation Patterns

### Before /p:done:
```javascript
const nowContent = await Read('~/.prjct-cli/projects/{projectId}/core/now.md')
if (!nowContent || nowContent.trim() === '') {
  return "Not working on anything. Use /p:now to start a task."
}
```

### Before /p:ship:
```javascript
const nowContent = await Read('~/.prjct-cli/projects/{projectId}/core/now.md')
if (!nowContent || nowContent.trim() === '') {
  return "Nothing to ship yet. Build something first with /p:now."
}
```

## 🔧 Error Handling

| Error | Solution |
|-------|----------|
| File not found | Return empty state, don't fail |
| Invalid JSON config | Suggest `/p:init` again |
| Permission denied | Suggest `chmod -R u+w ~/.prjct-cli/` |
| No project detected | Suggest `/p:init` |

## 🎯 Command Execution Flow

Standard pattern for all `/p:*` commands:

1. **Validate**: Check `.prjct/prjct.config.json` exists
2. **Read config**: Extract projectId
3. **Read context**: Load `~/.prjct-cli/projects/{id}/CLAUDE.md`
4. **Execute**: Read/write files in global storage
5. **Log**: Append to `memory/context.jsonl`
6. **Respond**: Formatted response with next action suggestions

## 📚 Additional Context

- **Website**: https://prjct.app
- **Documentation**: https://prjct.app/docs
- **Support**: jlopezlira@gmail.com

---

**Last updated**: Auto-managed by prjct-cli
**Config version**: 0.10.5

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
