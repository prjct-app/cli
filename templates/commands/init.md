---
allowed-tools: [Read, Write, Bash]
description: 'Initialize prjct'
---

# /p:init

## Flow

**Existing**: ID → dirs → config → analyze → agents
**Blank + idea**: ARCHITECT → analyze → recommend stack → create → roadmap

## Structure
`~/.prjct-cli/projects/{id}/`: core, progress, planning, analysis, agents, memory

## Config
`.prjct/prjct.config.json`: version, projectId, dataPath, author

## Response
`✅ Init | {stack} | {N} agents | Next: /p:feature or /p:help`

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
