/**
 * AI Tool Formatters
 *
 * Each AI tool has different context preferences:
 * - Claude Code: Detailed markdown with sections
 * - Cursor: Concise rules format
 * - Copilot: Minimal bullet points
 * - Windsurf: Similar to Cursor
 */

import type { AIToolConfig } from './registry'

export interface ProjectContext {
  projectId: string
  name: string
  version: string
  ecosystem: string
  projectType: string
  languages: string[]
  frameworks: string[]
  repoPath: string
  branch: string
  fileCount: number
  commits: number
  hasChanges: boolean
  commands: {
    install: string
    dev: string
    test: string
    build: string
    lint: string
    format: string
  }
  agents: {
    workflow: string[]
    domain: string[]
  }
}

/**
 * Format context for Claude Code (CLAUDE.md)
 * Detailed markdown with full context
 */
export function formatForClaude(ctx: ProjectContext, config: AIToolConfig): string {
  return `# ${ctx.name} - Project Rules
<!-- projectId: ${ctx.projectId} -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Ecosystem: ${ctx.ecosystem} | Type: ${ctx.projectType} -->

## THIS PROJECT (${ctx.ecosystem})

**Type:** ${ctx.projectType}
**Path:** ${ctx.repoPath}

### Commands (USE THESE, NOT OTHERS)

| Action | Command |
|--------|---------|
| Install dependencies | \`${ctx.commands.install}\` |
| Run dev server | \`${ctx.commands.dev}\` |
| Run tests | \`${ctx.commands.test}\` |
| Build | \`${ctx.commands.build}\` |
| Lint | \`${ctx.commands.lint}\` |
| Format | \`${ctx.commands.format}\` |

### Code Conventions

- **Languages**: ${ctx.languages.join(', ') || 'Not detected'}
- **Frameworks**: ${ctx.frameworks.join(', ') || 'Not detected'}

---

## PRJCT RULES

### Path Resolution
**ALL prjct writes go to**: \`~/.prjct-cli/projects/${ctx.projectId}/\`
- NEVER write to \`.prjct/\`
- NEVER write to \`./\` for prjct data

### Workflow
\`\`\`
p. sync → p. task "desc" → [work] → p. done → p. ship
\`\`\`

| Command | Action |
|---------|--------|
| \`p. sync\` | Re-analyze project |
| \`p. task X\` | Start task |
| \`p. done\` | Complete subtask |
| \`p. ship X\` | Ship feature |

---

## PROJECT STATE

| Field | Value |
|-------|-------|
| Name | ${ctx.name} |
| Version | ${ctx.version} |
| Ecosystem | ${ctx.ecosystem} |
| Branch | ${ctx.branch} |
| Files | ~${ctx.fileCount} |
| Commits | ${ctx.commits} |

---

## AGENTS

Load from \`~/.prjct-cli/projects/${ctx.projectId}/agents/\`:

**Workflow**: ${ctx.agents.workflow.join(', ')}
**Domain**: ${ctx.agents.domain.join(', ') || 'none'}
`
}

/**
 * Format context for Cursor (.cursorrules)
 * Concise rules format, optimized for inline suggestions
 */
export function formatForCursor(ctx: ProjectContext, config: AIToolConfig): string {
  const rules: string[] = []

  // Project identity
  rules.push(`You are working on ${ctx.name}, a ${ctx.projectType} ${ctx.ecosystem} project.`)
  rules.push('')

  // Tech stack
  rules.push('## Tech Stack')
  if (ctx.languages.length > 0) {
    rules.push(`- Languages: ${ctx.languages.join(', ')}`)
  }
  if (ctx.frameworks.length > 0) {
    rules.push(`- Frameworks: ${ctx.frameworks.join(', ')}`)
  }
  rules.push('')

  // Commands
  rules.push('## Commands')
  rules.push(`- Install: \`${ctx.commands.install}\``)
  rules.push(`- Dev: \`${ctx.commands.dev}\``)
  rules.push(`- Test: \`${ctx.commands.test}\``)
  rules.push(`- Build: \`${ctx.commands.build}\``)
  rules.push('')

  // Code style rules based on ecosystem
  rules.push('## Code Style')
  if (ctx.ecosystem === 'JavaScript' || ctx.languages.includes('TypeScript')) {
    rules.push('- Use TypeScript for type safety')
    rules.push('- Prefer async/await over callbacks')
    rules.push('- Use ES modules (import/export)')
    if (ctx.frameworks.includes('React')) {
      rules.push('- Use functional components with hooks')
      rules.push('- Prefer composition over inheritance')
    }
    if (ctx.frameworks.includes('Next.js')) {
      rules.push('- Use App Router conventions')
      rules.push('- Prefer Server Components where possible')
    }
  }
  if (ctx.ecosystem === 'Python') {
    rules.push('- Follow PEP 8 style guide')
    rules.push('- Use type hints')
    rules.push('- Prefer f-strings for formatting')
  }
  if (ctx.ecosystem === 'Go') {
    rules.push('- Follow Go conventions (gofmt)')
    rules.push('- Handle errors explicitly')
    rules.push('- Keep functions small and focused')
  }
  if (ctx.ecosystem === 'Rust') {
    rules.push('- Follow Rust idioms')
    rules.push('- Prefer Result over panics')
    rules.push('- Use meaningful variable names')
  }
  rules.push('')

  // Best practices
  rules.push('## Best Practices')
  rules.push('- Write clean, readable code')
  rules.push('- Add comments only for complex logic')
  rules.push('- Keep functions small and focused')
  rules.push('- Handle errors appropriately')
  rules.push('- Write tests for new functionality')

  return rules.join('\n')
}

/**
 * Format context for GitHub Copilot (.github/copilot-instructions.md)
 * Minimal bullet points
 */
export function formatForCopilot(ctx: ProjectContext, config: AIToolConfig): string {
  const lines: string[] = []

  lines.push('# Copilot Instructions')
  lines.push('')
  lines.push(`This is ${ctx.name}, a ${ctx.ecosystem} project.`)
  lines.push('')

  // Key info
  lines.push('## Project Info')
  lines.push(`- Type: ${ctx.projectType}`)
  lines.push(`- Stack: ${ctx.frameworks.join(', ') || ctx.ecosystem}`)
  lines.push('')

  // Conventions
  lines.push('## Conventions')
  if (ctx.languages.includes('TypeScript')) {
    lines.push('- Use TypeScript')
  }
  lines.push('- Follow existing code patterns')
  lines.push('- Keep code clean and readable')
  lines.push('')

  // Commands
  lines.push('## Commands')
  lines.push(`- Test: \`${ctx.commands.test}\``)
  lines.push(`- Build: \`${ctx.commands.build}\``)

  return lines.join('\n')
}

/**
 * Format context for Windsurf (.windsurfrules)
 * Similar to Cursor format
 */
export function formatForWindsurf(ctx: ProjectContext, config: AIToolConfig): string {
  // Windsurf uses similar format to Cursor
  return formatForCursor(ctx, config)
}

/**
 * Get formatter function for a tool
 */
export function getFormatter(toolId: string): ((ctx: ProjectContext, config: AIToolConfig) => string) | null {
  const formatters: Record<string, (ctx: ProjectContext, config: AIToolConfig) => string> = {
    claude: formatForClaude,
    cursor: formatForCursor,
    copilot: formatForCopilot,
    windsurf: formatForWindsurf,
  }

  return formatters[toolId] || null
}
