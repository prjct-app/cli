---
allowed-tools: [Read, Write, Bash, Glob, Grep]
description: 'Sync state + generate agents + detect patterns'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:sync - Sync Project State

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{analysisPath}`: `{globalPath}/analysis`
- `{agentsPath}`: `{globalPath}/agents`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Analyze Repository

### Detect Stack
GLOB: `**/*.{js,ts,jsx,tsx,py,rb,go,rs,java}`
GLOB: `**/package.json`, `**/Cargo.toml`, `**/go.mod`, `**/requirements.txt`

EXTRACT:
- {languages}: List of languages found
- {frameworks}: Detected frameworks (React, Express, Django, etc.)
- {packageManager}: npm, yarn, pnpm, pip, cargo, etc.

### Analyze File Structure
BASH: `find . -type f -name "*.{ext}" | head -50`

DETERMINE:
- {sourceDir}: Main source directory (src/, lib/, app/)
- {testDir}: Test directory (test/, tests/, __tests__/)
- {configFiles}: Config files found

### Generate repo-summary.md

WRITE: `{analysisPath}/repo-summary.md`

```markdown
# Repository Summary

> Generated: {GetTimestamp()}

## Stack
- Languages: {languages}
- Frameworks: {frameworks}
- Package Manager: {packageManager}

## Structure
- Source: {sourceDir}
- Tests: {testDir}
- Entry: {entryPoint}

## Files
- Total: {fileCount}
- Source: {sourceCount}
- Tests: {testCount}
```

## Step 3: Pattern Analysis

### Sample Files
READ 5-10 representative source files:
- Main entry point
- Largest files (potential complexity)
- Utility/helper files
- Test files
- Config files

### Detect Patterns

Analyze for:
1. **SOLID Principles**: Evidence of each
2. **DRY**: Shared utilities, constants
3. **Design Patterns**: Factory, singleton, observer, repository
4. **Code Style**: Naming, formatting, imports

### Detect Anti-Patterns

Flag:
- God classes (files > 300 lines)
- Deep nesting (> 4 levels)
- Code duplication
- Magic numbers
- Mixed concerns

### Generate patterns.md

WRITE: `{analysisPath}/patterns.md`

```markdown
# Code Patterns - {project}

> Generated: {GetTimestamp()}

## Patterns Detected
- {pattern}: {where} - {example}

## Conventions (MUST FOLLOW)
- Functions: {convention}
- Classes: {convention}
- Files: {convention}
- Async: {pattern}

## Anti-Patterns ⚠️
1. **{issue}**: {file:line} - Fix: {action}

## Recommendations
1. {action}
```

## Step 4: Generate Agents

Based on detected stack, generate specialized agents:

### Agent Generation Rules

IF {languages} includes JavaScript/TypeScript:
  IF React/Vue/Angular detected:
    GENERATE: `agents/fe.md` (Frontend Specialist)
  IF Express/Fastify/Nest detected:
    GENERATE: `agents/be.md` (Backend Specialist)

IF {languages} includes Python:
  GENERATE: `agents/py.md` (Python Specialist)

IF tests detected:
  GENERATE: `agents/qa.md` (Quality Specialist)

ALWAYS GENERATE:
  - `agents/coordinator.md` (Orchestration)

### Agent Template

For each agent, WRITE to `{agentsPath}/{name}.md`:

```markdown
# {Name} Agent

## Role
{Specialized role description}

## Skills
- {skill1}
- {skill2}

## Patterns to Follow
{From patterns.md}

## Files I Own
{Directories/patterns this agent handles}
```

## Step 5: Update Project CLAUDE.md

READ: `{globalPath}/CLAUDE.md`

IF exists:
  ### Add Patterns Summary

  INSERT section:
  ```markdown
  ## Code Patterns

  **Follow in ALL new code:**
  - {key conventions}
  - {design patterns}

  **Avoid:**
  - {anti-patterns}
  ```

  WRITE: `{globalPath}/CLAUDE.md`

## Step 6: Update project.json

This file is the source of truth for the web dashboard. It maps projectId → repoPath.

### Determine Project Name
- Try package.json → `name` field
- Try Cargo.toml → `[package] name`
- Try pyproject.toml → `[project] name`
- Fallback to directory name (last segment of current path)

WRITE: `{globalPath}/project.json`

```json
{
  "projectId": "{projectId}",
  "repoPath": "{cwd}",
  "name": "{projectName}",
  "techStack": ["{primaryLanguage}", "{primaryFramework}", ...],
  "createdAt": "{existingCreatedAt || GetTimestamp()}",
  "lastSync": "{GetTimestamp()}"
}
```

### techStack Array Rules
- Max 4 items for display in dashboard cards
- Order by relevance: primary language → framework → tools
- Examples:
  - Node.js + React: `["TypeScript", "React", "Node.js", "Vitest"]`
  - Python Django: `["Python", "Django", "PostgreSQL"]`
  - CLI tool: `["Node.js", "CLI", "CommonJS"]`

NOTE: If project.json already exists, preserve `createdAt` field. Always update `lastSync` and `techStack`.

## Step 7: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{GetTimestamp()}","action":"sync","stack":"{languages}","agents":{agentCount},"patterns":{patternCount}}
```

## Output

SUCCESS:
```
🔄 Synced

Stack:
├── Languages: {languages}
├── Frameworks: {frameworks}
└── Package Manager: {packageManager}

Generated:
├── Agents: {agentCount}
├── Patterns: {patternCount} detected
└── Anti-patterns: {antiPatternCount} flagged

Files:
├── analysis/repo-summary.md
├── analysis/patterns.md
└── agents/*.md

Next:
• /p:feature - Start building
• /p:context - See full context
• /p:now - Set current task
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No config | "No prjct project" | STOP |
| No source files | "Empty project" | WARN, continue |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Node.js Project
```
🔄 Synced

Stack:
├── Languages: JavaScript, TypeScript
├── Frameworks: Express, React
└── Package Manager: npm

Generated:
├── Agents: 4 (coordinator, fe, be, qa)
├── Patterns: 8 detected
└── Anti-patterns: 2 flagged

Next: /p:feature | /p:context
```

### Example 2: Python Project
```
🔄 Synced

Stack:
├── Languages: Python
├── Frameworks: Django
└── Package Manager: pip

Generated:
├── Agents: 3 (coordinator, py, qa)
├── Patterns: 5 detected
└── Anti-patterns: 1 flagged

Next: /p:feature | /p:context
```
