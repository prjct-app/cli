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
export function formatForClaude(ctx: ProjectContext, _config: AIToolConfig): string {
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
export function formatForCursor(ctx: ProjectContext, _config: AIToolConfig): string {
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

  // Code style - language agnostic
  rules.push('## Code Style')
  rules.push(`- Follow ${ctx.ecosystem} conventions`)
  rules.push('- Match existing code patterns in this project')
  rules.push('- Use idiomatic constructs for the language')
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
export function formatForCopilot(ctx: ProjectContext, _config: AIToolConfig): string {
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
  lines.push(`- Follow ${ctx.ecosystem} conventions`)
  lines.push('- Match existing code patterns')
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
 * Optimized for Cascade AI with flow-based suggestions
 */
export function formatForWindsurf(ctx: ProjectContext, _config: AIToolConfig): string {
  const rules: string[] = []

  // Project identity
  rules.push(`# ${ctx.name}`)
  rules.push('')
  rules.push(`${ctx.projectType} project using ${ctx.ecosystem}.`)
  rules.push('')

  // Tech stack (concise)
  rules.push('## Stack')
  rules.push(`- ${ctx.languages.join(', ')}`)
  if (ctx.frameworks.length > 0) {
    rules.push(`- ${ctx.frameworks.join(', ')}`)
  }
  rules.push('')

  // Commands (essential only)
  rules.push('## Commands')
  rules.push(`\`\`\`bash`)
  rules.push(`# Install`)
  rules.push(ctx.commands.install)
  rules.push(`# Dev`)
  rules.push(ctx.commands.dev)
  rules.push(`# Test`)
  rules.push(ctx.commands.test)
  rules.push(`# Build`)
  rules.push(ctx.commands.build)
  rules.push(`\`\`\``)
  rules.push('')

  // Code style - language agnostic
  rules.push('## Rules')
  rules.push(`- Follow ${ctx.ecosystem} conventions`)
  rules.push('- Match existing project patterns')
  rules.push('- Clean code, minimal comments')
  rules.push('- Test new functionality')

  return rules.join('\n')
}

/**
 * Format context for Continue.dev (.continue/config.json)
 * JSON config with system message and context providers
 */
export function formatForContinue(ctx: ProjectContext, _config: AIToolConfig): string {
  const systemMessage = [
    `You are working on ${ctx.name}, a ${ctx.projectType} ${ctx.ecosystem} project.`,
    '',
    `Stack: ${ctx.languages.join(', ')}${ctx.frameworks.length > 0 ? ` with ${ctx.frameworks.join(', ')}` : ''}`,
    '',
    'Commands:',
    `- Install: ${ctx.commands.install}`,
    `- Dev: ${ctx.commands.dev}`,
    `- Test: ${ctx.commands.test}`,
    `- Build: ${ctx.commands.build}`,
    '',
    `Follow ${ctx.ecosystem} conventions. Match existing code patterns.`,
  ].join('\n')

  const continueConfig = {
    systemMessage,
    models: [],
    contextProviders: [
      { name: 'code' },
      { name: 'docs' },
      { name: 'diff' },
      { name: 'terminal' },
      { name: 'problems' },
      { name: 'folder' },
      { name: 'codebase' },
    ],
    slashCommands: [
      { name: 'edit', description: 'Edit selected code' },
      { name: 'comment', description: 'Add comments to code' },
      { name: 'share', description: 'Export conversation' },
      { name: 'cmd', description: 'Run terminal command' },
    ],
    customCommands: [
      {
        name: 'test',
        prompt: `Write tests for the selected code. Use the project's testing conventions. Test command: ${ctx.commands.test}`,
      },
    ],
  }

  return JSON.stringify(continueConfig, null, 2)
}

/**
 * Get formatter function for a tool
 */
export function getFormatter(
  toolId: string
): ((ctx: ProjectContext, config: AIToolConfig) => string) | null {
  const formatters: Record<string, (ctx: ProjectContext, config: AIToolConfig) => string> = {
    claude: formatForClaude,
    cursor: formatForCursor,
    copilot: formatForCopilot,
    windsurf: formatForWindsurf,
    continue: formatForContinue,
  }

  return formatters[toolId] || null
}
