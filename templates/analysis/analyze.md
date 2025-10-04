---
allowed-tools: [Read, Bash]
description: 'Analyze codebase and generate comprehensive summary'
---

# /p:analyze

## Instructions for Claude

You are analyzing a codebase to generate a comprehensive summary. **NO predetermined patterns** - analyze based on what you actually find.

## Your Task

1. **Read project files** using the analyzer helpers:
   - package.json, Cargo.toml, go.mod, requirements.txt, etc.
   - Directory structure
   - Git history and stats
   - Key source files

2. **Understand the stack** - DON'T use predetermined lists:
   - What language(s) are used?
   - What frameworks are used?
   - What tools and libraries are important?
   - What's the architecture?

3. **Identify features** - based on actual code, not assumptions:
   - What has been built?
   - What's the current state?
   - What patterns do you see?

4. **Generate agents** - create specialists for THIS project:
   - Read the stack you identified
   - Create agents for each major technology
   - Use descriptive names (e.g., 'express-backend', 'react-frontend', 'postgres-db')
   - Include specific versions and tools found

## Guidelines

- **No assumptions** - only report what you find
- **No predefined maps** - don't assume express = "REST API server"
- **Read and understand** - look at actual code structure
- **Any stack works** - Elixir, Rust, Go, Python, Ruby, whatever exists
- **Be specific** - include versions, specific tools, actual patterns

## Output Format

Generate `analysis/repo-summary.md` with:

```markdown
# Project Analysis

## Stack

[What you found - languages, frameworks, tools with versions]

## Architecture

[How it's organized - based on actual structure]

## Features

[What has been built - based on code and git history]

## Statistics

- Total files: [count]
- Contributors: [count]
- Age: [age]
- Last activity: [date]

## Recommendations

[What agents to generate, what's next, etc.]
```

## After Analysis

1. Save summary to `analysis/repo-summary.md`
2. Generate agents using `generator.generateDynamicAgent()`
3. Report what was found

---

**Remember**: You decide EVERYTHING based on analysis. No if/else, no predetermined patterns.
