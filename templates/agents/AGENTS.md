# AGENTS.md

AI assistant guidance for **prjct-cli** - developer momentum tool for solo builders & small teams (2-5 people). Just ship. No BS.

## What This Is

**NOT** project management. NO sprints, story points, ceremonies, or meetings.

**IS** frictionless progress tracking. Talk naturally, ship features, celebrate wins.

---

## Dynamic Agent Generation

**YOU decide** what specialists to generate based on project analysis. No predetermined lists.

### When to Generate Agents

From commands that analyze the project:

- `/p:sync` - Sync and generate agents
- `/p:init` - Initialize with existing code
- `/p:architect` - After generating project plan

### How to Generate

```javascript
const generator = new AgentGenerator(projectId)

await generator.generateDynamicAgent('agent-name', {
  role: 'Clear Role Description',
  expertise: 'Specific technologies, versions, tools',
  responsibilities: 'What they handle in this project',
  projectContext: {
    /* optional context */
  },
})
```

### Example Usage

**1. Read the analysis first:**

```javascript
// Read analysis/repo-summary.md to understand the stack
const analysis = await readAnalysis('analysis/repo-summary.md')
```

**2. Generate specialists for technologies YOU find:**

```javascript
// For EACH major technology found in the analysis, create a specialist
// Use descriptive names and specific details from the analysis

await generator.generateDynamicAgent('descriptive-name', {
  role: 'Clear role based on what you found',
  expertise: 'Specific versions, frameworks, tools from analysis',
  responsibilities: 'What this agent handles in THIS specific project',
  projectContext: {
    /* any relevant context from analysis */
  },
})
```

**You decide everything** - read the analysis, understand the stack, generate appropriate specialists. No predetermined lists, no assumptions, no limitations.

### Guidelines

1. **Read analysis** - Understand full stack from analysis/repo-summary.md
2. **Create specialists** - For each major technology found
3. **Name descriptively** - `go-backend` not `be`, `vuejs-frontend` not `fe`
4. **Be specific** - Include versions, frameworks, tools
5. **No predetermined list** - ANY stack works (Elixir, Phoenix, Svelte, etc.)
6. **Follow project plan** - Only generate agents for technologies found in project plan and related to your role
7. **Best practices** - Allways use best practices for your role

---

## Talk Naturally

**Zero memorization** - just describe what you want!

Works in **any language** via semantic understanding.

**Examples:**

```
Start working:
→ "I want to build the login page"
→ Command: /p:now

Finished:
→ "I'm done" | "completed"
→ Command: /p:done

Ship:
→ "ship this" | "deploy it" | "ready to launch"
→ Command: /p:ship
```

**Both work:**

- Natural: "I want to start building auth"
- Direct: `/p:now "building auth"`

## Architecture

**Global**: `~/.prjct-cli/projects/{id}/`

```
core/        # now.md, next.md, context.md
progress/    # shipped.md, metrics.md
planning/    # ideas.md, roadmap.md
analysis/    # repo-summary.md
memory/      # context.jsonl
```

**Local**: `.prjct/prjct.config.json`

## Quick Start

1. `/p:init` - Initialize
2. `/p:help` - Guide
3. Or talk: "I want to start [task]"

## Commands

**💡 Tip**: `/p:help` for interactive guide

| Command                | Say This          | Action            |
| ---------------------- | ----------------- | ----------------- |
| `/p:help`              | "help"            | Interactive guide |
| `/p:init`              | -                 | Create structure  |
| `/p:now [task]`        | "start [task]"    | Set current task  |
| `/p:done`              | "I'm done"        | Complete & next   |
| `/p:ship <feature>`    | "ship [feature]"  | Celebrate win     |
| `/p:next`              | "what's next?"    | Show queue        |
| `/p:idea <text>`       | "idea about [x]"  | Capture ideas     |
| `/p:recap`             | "show progress"   | Overview          |
| `/p:progress [period]` | "how am I doing?" | Metrics           |
| `/p:stuck <issue>`     | "I'm stuck"       | Get help          |
| `/p:context`           | "show context"    | Display state     |
| `/p:analyze`           | "analyze repo"    | Generate summary  |
| `/p:design`            | "design [x]"      | Generate specs    |
| `/p:cleanup`           | "clean up"        | Remove dead code  |

## How It Works

**Natural conversation:**

- Detect intent
- Map to command
- Respond with options
- Suggest next steps

**Every response:**

- What you did
- Natural options
- Command alternatives

**Zero memorization!**

## Intent Detection

Semantic understanding, not pattern matching.

| Intent     | Command    | Examples                                     |
| ---------- | ---------- | -------------------------------------------- |
| Start task | `/p:now`   | "work on X", "starting API", "begin auth"    |
| Finish     | `/p:done`  | "done", "finished", "completed", "all set"   |
| Ship       | `/p:ship`  | "ship this", "deploy X", "it's ready"        |
| Idea       | `/p:idea`  | "I have an idea", "what if we..."            |
| Progress   | `/p:recap` | "show progress", "how am I doing"            |
| Stuck      | `/p:stuck` | "I'm stuck", "help with X"                   |
| Next       | `/p:next`  | "what's next", "show queue", "priority list" |

**Any language works** - if you understand intent, execute the command.

### Example

**User:** "I want to start building the login page"

**Your reasoning:**

- Intent: Start working
- Command: `/p:now`
- Param: "building the login page"

**Response:**

```
💬 Understood: "start building the login page"
⚡ Executing: /p:now "building the login page"

✅ Starting: building the login page

Next:
• Say "I'm done" when finished
• Or: /p:done
```

## Implementation

- All ops atomic
- Log to `memory/context.jsonl`
- Conversational responses
- Intent detection (any language)
- Handle missing files

## MCP Servers

- **Context7**: Library docs (always on)
- **Filesystem**: File ops
- **Memory**: Persistence
- **Sequential**: Complex reasoning
