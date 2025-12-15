---
allowed-tools: [Read, Grep, Glob, Bash, TodoWrite]
description: 'Analyze repo + generate summary'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/analysis.json'
claude-context: 'context/analysis.md'
---

# /p:analyze - Analyze Repository

## Architecture: Write-Through Pattern

**Source of Truth**: `storage/analysis.json`
**Claude Context**: `context/analysis.md` (generated)

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{analysisStoragePath}`: `{globalPath}/storage/analysis.json`
- `{analysisContextPath}`: `{globalPath}/context/analysis.md`

## Flow

1. Scan structure → Detect tech (package.json, Gemfile, etc.)
2. Analyze patterns → Git status
3. Write `storage/analysis.json` (source of truth)
4. Generate `context/analysis.md` (for Claude)

## Report

- Overview: type, lang, framework
- Stack: technologies detected
- Architecture: patterns, entry points
- Agents: recommend specialists

## Storage Format

### storage/analysis.json
```json
{
  "projectType": "web",
  "languages": ["typescript", "javascript"],
  "frameworks": ["react", "next.js"],
  "entryPoints": ["src/index.ts"],
  "patterns": ["component-based", "api-routes"],
  "dependencies": {...},
  "analyzedAt": "{timestamp}"
}
```

## Response

```
🔍 {project} | Stack: {tech} | Saved: context/analysis.md
```
