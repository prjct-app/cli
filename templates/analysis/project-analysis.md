---
allowed-tools: [Read, Glob, Bash]
description: 'Analyze project technology stack - Claude reads and decides'
---

# Project Analysis Instructions

## Objective

Determine the technology stack by READING actual files, not assuming.

## Step 1: Read Dependency Files

Read these files if they exist:

- `package.json` → Node.js/JavaScript/TypeScript project
- `Cargo.toml` → Rust project
- `go.mod` → Go project
- `requirements.txt` or `pyproject.toml` → Python project
- `Gemfile` → Ruby project
- `mix.exs` → Elixir project
- `pom.xml` or `build.gradle` → Java project
- `composer.json` → PHP project

**Extract actual dependencies** - don't guess frameworks.

## Step 2: Examine Directory Structure

List the root directory to identify:

- Source directories (src/, lib/, app/, cmd/)
- Test directories (tests/, spec/, __tests__/)
- Config directories (.github/, .gitlab/, .vscode/)
- Build outputs (dist/, build/, target/)

## Step 3: Check Configuration Files

Look for:

- `tsconfig.json` → TypeScript configuration
- `Dockerfile` → Docker usage
- `docker-compose.yml` → Multi-container setup
- `.eslintrc`, `.prettierrc` → Linting/formatting
- `jest.config.js`, `vitest.config.ts` → Testing setup
- `.env*` files → Environment configuration

## Step 4: Determine Stack

Based on what you READ (not assumed):

1. **Languages**: Identify from file extensions and configs
2. **Frameworks**: Extract from actual dependencies
3. **Tools**: Identify from config files present
4. **Databases**: Look for DB clients in dependencies
5. **Testing**: Identify test frameworks from configs/deps

## Output Format

Provide analysis in this structure:

```json
{
  "languages": ["actual languages found"],
  "frameworks": ["actual frameworks from deps"],
  "tools": ["tools with config files present"],
  "databases": ["database clients in deps"],
  "testing": ["test frameworks found"],
  "notes": "any observations about the project"
}
```

## Rules

- **NO hardcoded assumptions** - React doesn't mean "frontend"
- **READ before deciding** - Don't guess based on filenames
- **Any stack works** - Elixir, Rust, Go, Python, etc.
- **Be specific** - Include versions when available
- **Note uncertainty** - If unclear, say so
