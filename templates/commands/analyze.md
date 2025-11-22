---
allowed-tools: [Read, Grep, Glob, Bash, TodoWrite]
description: 'Analyze repo + generate summary'
---

# /p:analyze

## Flow
1. Scan structure → Detect tech (package.json, Gemfile, etc.)
2. Analyze patterns → Git status
3. Generate → `analysis/repo-summary.md`

## Report
- Overview: type, lang, framework
- Stack: technologies detected
- Architecture: patterns, entry points
- Agents: recommend specialists

## Response
`🔍 {project} | Stack: {tech} | Saved: analysis/repo-summary.md`
