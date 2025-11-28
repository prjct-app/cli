---
allowed-tools: [Glob, Read]
description: 'Filter relevant context for a task - Claude decides what matters'
---

# Context Filtering Instructions

## Objective

Determine which files and directories are relevant for a given task.

## Step 1: Get Real File Extensions

Instead of assuming extensions, get the ACTUAL extensions in the project:

```bash
# Get real extensions (analyzer.getFileExtensions())
```

Use only extensions that EXIST in this project.

## Step 2: Identify Relevant Directories

Based on the task, identify which directories matter:

**DO NOT use hardcoded lists like:**
- "components" for frontend
- "routes" for backend

**DO analyze:**
- Where does this project put similar code?
- What directory structure does it use?
- What naming conventions are followed?

## Step 3: Filter by Task Requirements

For the specific task:

1. What type of files will be modified?
2. What related files might need updates?
3. What config files are relevant?

## Step 4: Exclude Non-Relevant

Always exclude:
- `node_modules/`, `vendor/`, etc. (dependencies)
- `.git/` (version control)
- `dist/`, `build/`, `target/` (build outputs)
- Generated files

## Output

Return filtering patterns:

```json
{
  "include": {
    "extensions": [".actual", ".extensions", ".found"],
    "directories": ["actual/", "directories/", "in/project/"],
    "files": ["specific-files-if-known"]
  },
  "exclude": {
    "directories": ["node_modules/", ".git/", "dist/"],
    "patterns": ["*.min.js", "*.map"]
  },
  "priority": ["most-relevant-paths-first"],
  "reasoning": "why these patterns were chosen"
}
```

## Rules

- **Use REAL extensions** - Only include extensions that exist in the project
- **No assumptions** - Don't assume directory names
- **Task-specific** - Different tasks need different context
- **Efficient** - Don't include everything, focus on what matters
- **Explain choices** - Document why certain patterns were included/excluded
