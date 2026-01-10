# CLAUDE.md

This file provides guidance to Claude Code when working with prjct-cli.

## Project Overview

**prjct-cli** is a developer momentum tool. Track progress through natural language commands (`p. <command>`) without meetings or traditional PM overhead.

## HOW PRJCT WORKS

When user types `p. <command>`, load the template from `templates/commands/{command}.md` and execute it **intelligently** - templates are GUIDANCE, not rigid scripts.

```
p. sync     → Analyze project, generate domain agents
p. task X   → Start task with classification + breakdown
p. done     → Complete current subtask
p. ship X   → Ship feature with PR + version bump
```

---

## CRITICAL RULES

### 1. Path Resolution (MOST IMPORTANT)
**ALL writes go to global storage**: `~/.prjct-cli/projects/{projectId}/`
- **NEVER** write to `.prjct/` (config only, read-only)
- **NEVER** write to `./` (current directory)

### 2. Before Any Command
```
1. Read .prjct/prjct.config.json → get projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. Execute using globalPath for all writes
4. Log to {globalPath}/memory/events.jsonl
```

### 3. Timestamps & UUIDs
```bash
# Timestamp (NEVER hardcode)
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"

# UUID
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```

### 4. Git Commit Footer (CRITICAL - ALWAYS INCLUDE)

**Every commit MUST include the prjct signature:**

```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)

```

**NON-NEGOTIABLE: The `🤖 Generated with [p/]` line identifies prjct-powered commits.**

---

## ARCHITECTURE: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

| Layer | Path | Purpose |
|-------|------|---------|
| **Storage** | `storage/*.json` | Source of truth |
| **Context** | `context/*.md` | Claude-readable summaries |
| **Memory** | `memory/events.jsonl` | Audit trail (append-only) |
| **Agents** | `agents/*.md` | Domain specialists |

### File Structure
```
~/.prjct-cli/projects/{projectId}/
├── storage/
│   ├── state.json      # Current task (SOURCE OF TRUTH)
│   ├── queue.json      # Task queue
│   └── shipped.json    # Shipped features
├── context/
│   ├── now.md          # Current task (generated)
│   └── next.md         # Queue (generated)
├── memory/
│   └── events.jsonl    # Audit trail
├── agents/             # Domain specialists
└── sync/
    └── pending.json    # Backend events
```

---

## COMMANDS

| Trigger | Purpose |
|---------|---------|
| `p. init` | Initialize project with deep analysis |
| `p. sync` | Analyze repo, generate agents |
| `p. task <desc>` | Start task with agentic classification |
| `p. done` | Complete current subtask |
| `p. ship [name]` | Ship with PR + version bump |
| `p. pause` | Pause active task |
| `p. resume` | Resume paused task |
| `p. bug <desc>` | Report bug with auto-priority |

### Workflow
```
p. sync → p. task "description" → [work] → p. done → p. ship
```

---

## INTELLIGENT BEHAVIOR

Templates provide guidance. Use your intelligence to:

1. **Read before write** - Always read existing files first
2. **Explore before coding** - Use Task(Explore) to understand codebase
3. **Ask when uncertain** - Use AskUserQuestion to clarify
4. **Load agents** - Read from `{globalPath}/agents/` for domain expertise
5. **Adapt templates** - They're guidance, not rigid scripts
6. **Log everything** - Append to memory/events.jsonl

---

## OUTPUT FORMAT

Concise responses (< 4 lines):
```
✅ [What was done]

[Key metrics]
Next: [suggested action]
```

---

## KEY RULES

1. **Read files before editing** - Never assume structure
2. **Use node/bun for timestamps** - Never hardcode dates
3. **Follow template guidance** - But adapt intelligently
4. **Log to memory** - Append to `memory/events.jsonl`
5. **Suggest next actions** - Maintain user momentum
6. **Use linked skills** - Agents have skills in frontmatter

---

## AGENT MENTIONS (v0.28)

Invoke or reference project agents using the `p.agent.{name}` syntax.

### Available Agent IDs

| Agent ID | Agent File | Purpose |
|----------|------------|---------|
| `p.agent.workflow` | `prjct-workflow.md` | Task lifecycle: /p:now, /p:done, /p:next |
| `p.agent.planner` | `prjct-planner.md` | Planning: /p:feature, /p:idea, /p:spec |
| `p.agent.shipper` | `prjct-shipper.md` | Shipping: /p:ship |
| `p.agent.frontend` | `frontend.md` | Frontend/UI work |
| `p.agent.backend` | `backend.md` | Backend/API work |
| `p.agent.database` | `database.md` | Database work |
| `p.agent.testing` | `testing.md` | Testing work |
| `p.agent.devops` | `devops.md` | DevOps/CI work |
| `p.agent.uxui` | `uxui.md` | UX/UI design |

### Usage in Prompts

```
"p.agent.backend help me create a REST endpoint"
"p.agent.frontend build a login form"
"p.agent.testing write tests for the auth module"
```

### How It Works

1. Each agent has `agentId: p.agent.{name}` in frontmatter
2. When user mentions an agent ID, load that agent's context
3. Agent provides domain expertise for the task

---

## SKILL INTEGRATION (v0.27)

Agents are linked to Claude Code skills from claude-plugins.dev.

### Agent → Skill Mapping

| Agent | Skill |
|-------|-------|
| `frontend.md` | `frontend-design` |
| `uxui.md` | `frontend-design` |
| `backend.md` | `javascript-typescript` |
| `testing.md` | `developer-kit` |
| `devops.md` | `developer-kit` |
| `prjct-planner.md` | `feature-dev` |
| `prjct-shipper.md` | `code-review` |

### Usage

- `p. sync` installs required skills automatically
- `p. task` invokes skills based on task type
- Skills config: `{globalPath}/config/skills.json`

See `templates/agentic/skill-integration.md` for details.
