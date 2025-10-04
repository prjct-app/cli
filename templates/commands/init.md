---
allowed-tools: [Read, Write, Bash]
description: "Initialize prjct project (with architect mode for blank projects)"
---

# /p:init

## Usage
```
/p:init                    # Existing project
/p:init "[idea]"          # New blank project (architect mode)
```

## Flow: Existing Project
1. Generate: project ID from path hash
2. Create: `~/.prjct-cli/projects/{id}/` structure (including `agents/`)
3. Write: `.prjct/prjct.config.json`
4. Run: `/p:analyze` to understand stack
5. Generate: agents based on stack
6. Log: `memory/context.jsonl`

## Flow: Blank Project (Architect Mode)
1. Generate: project ID
2. Activate: ARCHITECT role
3. Analyze: idea/requirements
4. Recommend: tech stack options (Next.js, React, Vue, etc.)
5. User confirms: choice
6. Create: directory structure + base files
7. Generate: initial roadmap
8. Generate: agents
9. Ask: "¿Empezamos con la primera feature?"

## Directory Structure
```
~/.prjct-cli/projects/{id}/
├── core/          # now.md, next.md, context.md
├── progress/      # shipped.md, metrics.md
├── planning/      # ideas.md, roadmap.md
├── analysis/      # repo-summary.md
├── agents/        # AI agent definitions
└── memory/        # context.jsonl
```

## Config Format
```json
{
  "version": "0.6.0",
  "projectId": "{id}",
  "dataPath": "~/.prjct-cli/projects/{id}",
  "author": {
    "name": "{from git}",
    "email": "{from git}",
    "github": "{from remote}"
  }
}
```

## Response: Existing Project
```
✅ prjct initialized!

📁 Data: ~/.prjct-cli/projects/{id}
📝 Config: .prjct/prjct.config.json
📊 Analysis: {stack_summary}
🤖 Agents: {N} agents generated

Listo para trabajar! ¿Qué feature agregamos?

/p:feature | /p:analyze
```

## Response: Blank Project
```
✅ prjct initialized!

📐 ARCHITECT MODE

Your idea: "{idea}"

Recommended stack:
  Option 1: Next.js + TypeScript + Tailwind (⭐ Recommended)
  Option 2: React + Vite + shadcn/ui
  Option 3: Vue 3 + Nuxt

Which option? (or describe your preference)

[After user confirms:]

✅ Structure created!
📋 Initial roadmap: {N} features
🤖 Agents: generated

¿Empezamos con la primera feature?

/p:feature | /p:ship
```

