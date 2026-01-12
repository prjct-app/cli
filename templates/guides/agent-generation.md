# Agent Generation Guide

Complete guide for generating domain-specific agents. Referenced by `/p:sync`.

## Overview

Agents are generated from **REAL analysis** of the repository, not templates. You must:
1. **ANALYZE** the actual codebase deeply
2. **EXTRACT** real patterns, conventions, and examples
3. **GENERATE** agents that enforce those exact patterns

---

## Step 1: Find Representative Files

```bash
# Frontend: Component files
find . -type f \( -name "*.tsx" -o -name "*.vue" -o -name "*.svelte" \) -not -path "*/node_modules/*" | head -10

# Backend: API/route files
find . -type f -name "*.ts" -path "*/api/*" -o -path "*/routes/*" | head -10

# Database: Schema/model files
find . -type f \( -name "schema.prisma" -o -name "*.model.ts" \) | head -5

# Tests: Test files
find . -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) | head -10
```

---

## Step 2: Analyze Actual Code

```
FOR EACH domain detected:
  1. READ 3-5 representative files
  2. EXTRACT patterns:
     - File structure
     - Naming conventions
     - Import patterns
     - Code style
     - Architecture patterns
     - Error handling
     - Type patterns
  3. IDENTIFY project-specific conventions
```

Check existing style guides:
```bash
ls -la .eslintrc* .prettierrc* tsconfig.json biome.json 2>/dev/null
```

---

## Step 3: Agent Frontmatter Format

```yaml
---
name: {domain}
agentId: p.agent.{domain}
description: {Domain} specialist for {stack}. Use PROACTIVELY for {triggers}.
model: sonnet
temperature: {0.0-1.0}
maxSteps: {50-100}
tools:
  Read: true
  Write: true
  Edit: true
  Bash: true
  Glob: true
  Grep: true
permissions:
  Read: allow
  Write: allow
  Edit: allow
  Bash:
    "git *": allow
    "{test command}": allow
    "rm -rf *": deny
skills: [{detected-skill}]
mcp: [{detected-mcp}]
generatedAt: {timestamp}
---
```

---

## Step 4: Agent Body Structure

```markdown
# {Domain} Agent for {ProjectName}

## Stack Detected
{List EXACT technologies: "React 18, TypeScript 5.3, Tailwind 3.4"}

## Project Structure
{ACTUAL directory structure}

## Code Patterns (MUST FOLLOW)

### File Naming
{EXACT convention: "PascalCase for components"}

### Component/Module Structure
{ACTUAL example from codebase}

### Import Patterns
{ACTUAL import style}

### Error Handling
{ACTUAL error pattern}

## Quality Checklist
- [ ] Follows naming convention
- [ ] Uses correct import style
- [ ] Matches existing structure

## Commands
| Action | Command |
|--------|---------|
| Dev | `{actual command}` |
| Test | `{actual command}` |
```

---

## Configuration Values

**Temperature** (by domain):
- `0.1` - Database, migrations (precise)
- `0.2` - Backend, testing (deterministic)
- `0.3` - Frontend (some creativity)
- `0.4` - UX/UI (creative)

**maxSteps** (by complexity):
- `50` - Single file changes
- `75` - Multi-file features
- `100` - Complex refactors

---

## Domain Detection Table

| If You Find | Generate | Key Files |
|-------------|----------|-----------|
| React/Vue/Svelte | `frontend.md` | Components, hooks |
| Express/Fastify/Hono | `backend.md` | Routes, services |
| Prisma/Drizzle/SQL | `database.md` | Schema, migrations |
| Docker/K8s/Actions | `devops.md` | Dockerfile, workflows |
| Jest/Vitest/Pytest | `testing.md` | Test files |
| UI + design system | `uxui.md` | Design tokens |

Generate agents for **any domain present** - not limited to this list.

---

## Output Format

```
🤖 Generated: {agent}.md
   Stack: {technologies}
   Patterns: {count} from {files}
   Path: {globalPath}/agents/{agent}.md
```
