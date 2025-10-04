---
allowed-tools: [Read, Grep, Glob, Bash, TodoWrite]
description: 'Analyze repository and generate summary'
---

# /p:analyze

## Flow

1. Scan: project structure (Glob)
2. Detect: technologies (package.json, requirements.txt, etc.)
3. Analyze: architecture patterns
4. Git: status and stats
5. Generate: comprehensive report
6. Save: `analysis/repo-summary.md`

## Report Format

```markdown
# Repository Analysis

## Overview

- Type: {type}
- Language: {lang}
- Framework: {framework}

## Git Status

- Last commit: {hash} "{msg}" ({time_ago})
- Status: {clean/has_changes}

## Stack

- Languages: {list}
- Frameworks: {list}
- Dependencies: {count}

## Architecture

- Pattern: {pattern}
- Entry points: {files}

## Recommended Agents

Base (6): PM, UX, FE, BE, QA, Scribe
Additional: {conditional_agents}

Generated: {timestamp}
```

## Response

```
🔍 Analysis complete!

Project: {name} ({type})
Stack: {stack}

📄 Full report: analysis/repo-summary.md

/p:roadmap | /p:now
```
