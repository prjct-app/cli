---
allowed-tools: [Read, Grep, Glob, Bash]
description: 'Analyze repo + generate summary'
---

# /p:analyze - Analyze Repository

# All analysis data is stored in SQLite via the CLI

## Flow

1. Scan structure -> Detect tech (package.json, Gemfile, etc.)
2. Analyze patterns -> Git status
3. Save analysis via CLI (persisted to SQLite)

## Report

- Overview: type, lang, framework
- Stack: technologies detected
- Architecture: patterns, entry points
- Agents: recommend specialists

## Response

```
{project} | Stack: {tech} | Analysis saved
```
