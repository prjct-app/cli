# Sub-Agent Generation (AGENTIC)

Generate Claude Code sub-agents dynamically based on ACTUAL project analysis.

**CRITICAL**: There are NO hardcoded templates. You MUST analyze the project and GENERATE agents from scratch.

## Input Context

You have access to:
- `{analysis}` - repo-analysis.json with detected technologies
- `{projectPath}` - Path to project root
- `{projectId}` - Project identifier
- `{globalPath}` - ~/.prjct-cli/projects/{projectId}

## Output Location

Write sub-agents to: `{globalPath}/agents/`

## Sub-Agent Format (Claude Code)

```markdown
---
name: agent-name
agentId: p.agent.{name}
description: When to use this agent. Include "Use PROACTIVELY" for auto-invocation.
model: sonnet
temperature: {0.1-0.4}
maxSteps: {50-100}
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
permissions:
  Bash: ask
  Write: allow
  Edit: allow
  "rm *": deny
skills: [{detected-skill}]
mcp: [{detected-mcp-servers}]
projectId: {projectId}
projectPath: {projectPath}
---

# {Agent Name}

## Stack Detected
{ACTUAL technologies found in THIS project}

## Project Structure
{ACTUAL directory structure for this domain}

## Code Patterns (EXTRACTED FROM PROJECT)
{REAL patterns found by reading actual files}

## Quality Checklist
{Based on project conventions}

## Commands
{ACTUAL commands from package.json/Makefile/etc}
```

---

## Generation Process (AGENTIC)

### Step 1: Analyze Project Deeply

DO NOT use templates. Instead:

```
1. READ package.json, go.mod, Cargo.toml, requirements.txt, etc.
2. GLOB for source files: **/*.ts, **/*.tsx, **/*.py, **/*.go, etc.
3. READ 3-5 representative files from each domain
4. EXTRACT actual patterns, conventions, naming
5. CHECK for linter/formatter configs
```

### Step 2: Determine Domains Present

Based on your analysis, identify which domains exist:

| Domain | Detection Method |
|--------|------------------|
| frontend | React/Vue/Angular/Svelte in deps, .tsx/.vue files |
| backend | Express/Fastify/Hono/Gin/Flask in deps, API routes |
| database | Prisma/Drizzle/TypeORM schemas, SQL files |
| testing | Jest/Vitest/Pytest configs, *.test.* files |
| devops | Dockerfile, .github/workflows, k8s/ |
| uxui | UI components + design tokens/theme |
| mobile | React Native/Flutter/SwiftUI |
| cli | Command definitions, arg parsing |
| ml | Model files, training scripts |

### Step 3: Generate Each Agent FROM SCRATCH

For EACH detected domain:

1. **Analyze domain-specific files**
   ```
   READ actual source files in that domain
   EXTRACT: imports, exports, naming, structure
   ```

2. **Determine configuration**
   - `temperature`: 0.1 for DB, 0.2 for backend/testing, 0.3 for frontend, 0.4 for uxui
   - `maxSteps`: 50 for simple, 75 for medium, 100 for complex
   - `tools`: Based on what the domain needs
   - `permissions`: Deny destructive commands

3. **Discover skills and MCP**
   - Search claude-plugins.dev for relevant skills
   - Determine if context7 MCP is needed (library docs)

4. **Write agent with REAL patterns**
   ```
   Include ACTUAL code examples from the project
   Include ACTUAL commands from package.json
   Include ACTUAL file structure
   ```

### Step 4: Generate Workflow Agents (ALWAYS)

These 3 agents are always generated but STILL need project context:

#### prjct-workflow.md
- Commands: /p:now, /p:done, /p:next, /p:pause, /p:resume
- Adapt with: project paths, detected commands

#### prjct-planner.md
- Commands: /p:feature, /p:idea, /p:spec, /p:bug
- Adapt with: detected stack for planning context

#### prjct-shipper.md
- Commands: /p:ship
- Adapt with: actual test/build/lint commands from project

---

## MCP Integration

Determine which agents need MCP servers:

```
IF agent works with libraries/frameworks:
  ADD mcp: [context7]

Agents that typically need context7:
- frontend (React, Vue docs)
- backend (Express, Hono docs)
- database (Prisma, Drizzle docs)
- uxui (component library docs)
- prjct-planner (framework docs for planning)
```

---

## Skill Discovery

For each agent, search for relevant skills:

```
WebFetch: https://claude-plugins.dev/skills?q={domain}+{stack}

Examples:
- frontend + React → search "react frontend"
- backend + TypeScript → search "typescript backend"
- testing + Bun → search "bun testing"
```

If no skill found, leave skills empty or create minimal custom skill.

---

## Output Format

After generating each agent:

```
Generated: {agent}.md
  Stack: {detected technologies}
  Patterns: {count} extracted from {files analyzed}
  Skills: {linked skills}
  MCP: {linked mcp servers}
  Path: {globalPath}/agents/{agent}.md
```

---

## Critical Rules

1. **NO TEMPLATES** - Generate everything from project analysis
2. **NO HARDCODING** - Every value comes from detection
3. **REAL PATTERNS** - Include actual code examples from the project
4. **ACTUAL COMMANDS** - Use real commands from package.json/Makefile
5. **PROJECT-SPECIFIC** - Each agent is unique to this project
6. **GLOBAL STORAGE** - Write to `{globalPath}/agents/`, never local

---

## Example: Generated Backend Agent

This is an EXAMPLE of what a generated agent might look like (NOT a template to copy):

```markdown
---
name: backend
agentId: p.agent.backend
description: Backend specialist for Hono + Bun. Use PROACTIVELY for API routes and server logic.
model: sonnet
temperature: 0.2
maxSteps: 75
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
permissions:
  Bash: ask
  Write: allow
  Edit: allow
  "rm *": deny
skills: [javascript-typescript]
mcp: [context7]
projectId: abc123
projectPath: /Users/dev/my-project
---

# Backend Agent for my-project

## Stack Detected
- Runtime: Bun 1.0
- Framework: Hono 4.x
- Validation: Zod
- Database: Drizzle + SQLite

## Project Structure
```
core/
├── routes/       # API endpoints
├── services/     # Business logic
├── middleware/   # Auth, logging
└── types/        # TypeScript types
```

## Code Patterns (FROM THIS PROJECT)

### Route Structure
```typescript
// Extracted from core/routes/users.ts
app.get('/users/:id', async (c) => {
  const { id } = c.req.param()
  const user = await userService.findById(id)
  return c.json(user)
})
```

### Error Handling
```typescript
// Extracted from core/middleware/error.ts
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message }, 500)
})
```

## Commands

| Action | Command |
|--------|---------|
| Dev | `bun run dev` |
| Test | `bun test` |
| Build | `bun run build` |
| Lint | `bun run lint` |

## Critical Rules
- Use Hono's context (c) pattern
- Validate with Zod before processing
- Return proper HTTP status codes
- Use existing service layer pattern
```

This agent was GENERATED by analyzing the actual project, not copied from a template.
