/**
 * AI Tool Formatters
 *
 * Each AI tool has different context preferences:
 * - Claude Code: Detailed markdown with sections
 * - Cursor: Concise rules format
 * - Copilot: Minimal bullet points
 * - Windsurf: Similar to Cursor
 */

import { type ContextSources, cite, defaultSources } from '../utils/citations'
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
  sources?: ContextSources
}

/**
 * Format context for Claude Code (CLAUDE.md)
 * Detailed markdown with full context
 */
export function formatForClaude(ctx: ProjectContext, _config: AIToolConfig): string {
  const s = ctx.sources || defaultSources()

  return `# ${ctx.name} - Project Rules
<!-- projectId: ${ctx.projectId} -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Ecosystem: ${ctx.ecosystem} | Type: ${ctx.projectType} -->

## THIS PROJECT (${ctx.ecosystem})

${cite(s.ecosystem)}
**Type:** ${ctx.projectType}
**Path:** ${ctx.repoPath}

### Commands (USE THESE, NOT OTHERS)

${cite(s.commands)}
| Action | Command |
|--------|---------|
| Install dependencies | \`${ctx.commands.install}\` |
| Run dev server | \`${ctx.commands.dev}\` |
| Run tests | \`${ctx.commands.test}\` |
| Build | \`${ctx.commands.build}\` |
| Lint | \`${ctx.commands.lint}\` |
| Format | \`${ctx.commands.format}\` |

### Code Conventions

${cite(s.languages)}
- **Languages**: ${ctx.languages.join(', ') || 'Not detected'}
${cite(s.frameworks)}
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

${cite(s.name)}
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
 * Format context for Cursor (.cursor/rules/prjct.mdc)
 * MDC format with YAML frontmatter, optimized for inline suggestions
 *
 * @see https://cursor.com/docs/context/rules
 */
export function formatForCursor(ctx: ProjectContext, _config: AIToolConfig): string {
  const s = ctx.sources || defaultSources()
  const lines: string[] = []

  // MDC format with YAML frontmatter
  lines.push('---')
  lines.push(`description: prjct context for ${ctx.name}`)
  lines.push('globs:')
  lines.push('alwaysApply: true')
  lines.push('---')
  lines.push('')

  // Project identity
  lines.push(`You are working on ${ctx.name}, a ${ctx.projectType} ${ctx.ecosystem} project.`)
  lines.push('')

  // Tech stack
  lines.push(cite(s.languages))
  lines.push('## Tech Stack')
  if (ctx.languages.length > 0) {
    lines.push(`- Languages: ${ctx.languages.join(', ')}`)
  }
  if (ctx.frameworks.length > 0) {
    lines.push(`- Frameworks: ${ctx.frameworks.join(', ')}`)
  }
  lines.push('')

  // Commands
  lines.push(cite(s.commands))
  lines.push('## Commands')
  lines.push(`- Install: \`${ctx.commands.install}\``)
  lines.push(`- Dev: \`${ctx.commands.dev}\``)
  lines.push(`- Test: \`${ctx.commands.test}\``)
  lines.push(`- Build: \`${ctx.commands.build}\``)
  lines.push('')

  // Code style - language agnostic
  lines.push('## Code Style')
  lines.push(`- Follow ${ctx.ecosystem} conventions`)
  lines.push('- Match existing code patterns in this project')
  lines.push('- Use idiomatic constructs for the language')
  lines.push('')

  // Best practices
  lines.push('## Best Practices')
  lines.push('- Write clean, readable code')
  lines.push('- Add comments only for complex logic')
  lines.push('- Keep functions small and focused')
  lines.push('- Handle errors appropriately')
  lines.push('- Write tests for new functionality')

  return lines.join('\n')
}

/**
 * Format context for GitHub Copilot (.github/copilot-instructions.md)
 * Minimal bullet points
 */
export function formatForCopilot(ctx: ProjectContext, _config: AIToolConfig): string {
  const s = ctx.sources || defaultSources()
  const lines: string[] = []

  lines.push('# Copilot Instructions')
  lines.push('')
  lines.push(`This is ${ctx.name}, a ${ctx.ecosystem} project.`)
  lines.push('')

  // Key info
  lines.push(cite(s.ecosystem))
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
  lines.push(cite(s.commands))
  lines.push('## Commands')
  lines.push(`- Test: \`${ctx.commands.test}\``)
  lines.push(`- Build: \`${ctx.commands.build}\``)

  return lines.join('\n')
}

/**
 * Format context for Windsurf (.windsurf/rules/prjct.md)
 * MD format with YAML frontmatter, optimized for Cascade AI
 *
 * @see https://docs.windsurf.com/windsurf/cascade/memories
 */
export function formatForWindsurf(ctx: ProjectContext, _config: AIToolConfig): string {
  const s = ctx.sources || defaultSources()
  const lines: string[] = []

  // YAML frontmatter (Windsurf uses trigger: always_on instead of alwaysApply)
  lines.push('---')
  lines.push(`description: prjct context for ${ctx.name}`)
  lines.push('trigger: always_on')
  lines.push('---')
  lines.push('')

  // Project identity
  lines.push(`# ${ctx.name}`)
  lines.push('')
  lines.push(`${ctx.projectType} project using ${ctx.ecosystem}.`)
  lines.push('')

  // Tech stack (concise)
  lines.push(cite(s.languages))
  lines.push('## Stack')
  lines.push(`- ${ctx.languages.join(', ')}`)
  if (ctx.frameworks.length > 0) {
    lines.push(`- ${ctx.frameworks.join(', ')}`)
  }
  lines.push('')

  // Commands (essential only)
  lines.push(cite(s.commands))
  lines.push('## Commands')
  lines.push('```bash')
  lines.push(`# Install`)
  lines.push(ctx.commands.install)
  lines.push(`# Dev`)
  lines.push(ctx.commands.dev)
  lines.push(`# Test`)
  lines.push(ctx.commands.test)
  lines.push(`# Build`)
  lines.push(ctx.commands.build)
  lines.push('```')
  lines.push('')

  // Code style - language agnostic
  lines.push('## Rules')
  lines.push(`- Follow ${ctx.ecosystem} conventions`)
  lines.push('- Match existing project patterns')
  lines.push('- Clean code, minimal comments')
  lines.push('- Test new functionality')

  return lines.join('\n')
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
