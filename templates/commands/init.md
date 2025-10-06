---
allowed-tools: [Read, Write, Bash]
description: 'Initialize prjct project (with architect mode for blank projects)'
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
9. Ask: "Ready to start with the first feature?"

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WHAT DO YOU WANT TO DO FIRST?
━━━━━━━━━━━━━━━━━━━━━━━━━━━

5 clear paths:
1. 🚀 Add feature → /p:feature "{desc}"
2. 🐛 Fix bug → /p:bug "{desc}"
3. 🔍 Analyze deeper → /p:analyze
4. 📊 See status → /p:status or /p:recap
5. 💡 Not sure? → /p:suggest or /p:help

💬 OR JUST TELL ME: "I want to add authentication" / "What should I do?"

Let's ship something! 🚀
```

## Response: Blank Project

After ARCHITECT MODE activates and user confirms stack:

```
✅ Structure created!

📁 Project: {path}
📦 Stack: {chosen_stack}
📋 Initial roadmap: {N} features
🤖 Agents: {N} specialists generated

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WHAT'S NEXT?
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🚀 Start first feature (RECOMMENDED) → /p:feature "{first_feature}"
2. 📊 See roadmap → /p:roadmap
3. 🔍 Review structure → /p:recap
4. 💡 Modify plan → Just tell me

💬 REMEMBER: Talk naturally! "Start with auth" / "Show roadmap" / "Add another feature"

Ready to start building? 🚀
```
