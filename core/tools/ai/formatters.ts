/**
 * AI Tool Formatters
 *
 * Each AI tool has different context preferences:
 * - Claude Code: Detailed markdown with sections
 * - Cursor: Concise rules format
 * - Copilot: Minimal bullet points
 * - Windsurf: Similar to Cursor
 */

import { type ContextSources, cite, defaultSources } from '../../utils/citations'
import type { ProjectLearnings } from './learnings-extractor'
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
  analysis?: {
    patterns: Array<{ name: string; description: string; location?: string }>
    antiPatterns: Array<{ issue: string; file: string; suggestion: string }>
    packageManager?: string
    sourceDir?: string
    testDir?: string
  }
  learnings?: ProjectLearnings // NUEVO: Learnings desde SQLite
}

// =============================================================================
// Shared Operational Context (all agents need this)
// =============================================================================

/**
 * Generate operational context sections that ALL agents need to work.
 * This includes prjct rules, path resolution, project state, agents, and learnings.
 * Without these sections, agents can't properly use prjct CLI.
 */
function formatOperationalContext(ctx: ProjectContext, format: 'full' | 'concise'): string {
  const lines: string[] = []

  // PRJCT RULES + Path Resolution
  if (format === 'full') {
    lines.push('## prjct Rules')
    lines.push('')
    lines.push('### Path Resolution')
    lines.push(`**ALL prjct writes go to**: \`~/.prjct-cli/projects/${ctx.projectId}/\``)
    lines.push('- NEVER write to `.prjct/`')
    lines.push('- NEVER write to `./` for prjct data')
    lines.push('')
    lines.push('### Workflow')
    lines.push('```')
    lines.push('p. sync → p. task "desc" → [work] → p. done → p. ship')
    lines.push('```')
    lines.push('')
    lines.push('| Command | Action |')
    lines.push('|---------|--------|')
    lines.push('| `p. sync` | Re-analyze project |')
    lines.push('| `p. task X` | Start task |')
    lines.push('| `p. done` | Complete subtask |')
    lines.push('| `p. ship X` | Ship feature |')
    lines.push('')
  } else {
    lines.push('## prjct Rules')
    lines.push('')
    lines.push(`Path: \`~/.prjct-cli/projects/${ctx.projectId}/\``)
    lines.push('Workflow: `p. sync` → `p. task "desc"` → work → `p. done` → `p. ship`')
    lines.push('')
  }

  // PROJECT STATE
  lines.push('## Project State')
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| Name | ${ctx.name} |`)
  lines.push(`| Version | ${ctx.version} |`)
  lines.push(`| Ecosystem | ${ctx.ecosystem} |`)
  lines.push(`| Branch | ${ctx.branch} |`)
  lines.push(`| Files | ~${ctx.fileCount} |`)
  lines.push(`| Commits | ${ctx.commits} |`)
  lines.push('')

  // AGENTS
  if (ctx.agents.workflow.length > 0 || ctx.agents.domain.length > 0) {
    lines.push('## Agents')
    lines.push('')
    lines.push(`Load from \`~/.prjct-cli/projects/${ctx.projectId}/agents/\`:`)
    lines.push('')
    lines.push(`**Workflow**: ${ctx.agents.workflow.join(', ')}`)
    lines.push(`**Domain**: ${ctx.agents.domain.join(', ') || 'none'}`)
    lines.push('')
  }

  // RECENT LEARNINGS
  if (
    ctx.learnings &&
    (ctx.learnings.completedTasks.length > 0 ||
      ctx.learnings.resolvedBugs.length > 0 ||
      ctx.learnings.shippedFeatures.length > 0)
  ) {
    lines.push('## Recent Learnings')
    lines.push('')
    if (ctx.learnings.completedTasks.length > 0) {
      lines.push('### Completed Tasks')
      lines.push(
        ctx.learnings.completedTasks
          .map((t) => `- ${t.description}${t.branch ? ` (${t.branch})` : ''}`)
          .join('\n')
      )
      lines.push('')
    }
    if (ctx.learnings.resolvedBugs.length > 0) {
      lines.push('### Resolved Bugs')
      lines.push(ctx.learnings.resolvedBugs.map((b) => `- ${b.description}`).join('\n'))
      lines.push('')
    }
    if (ctx.learnings.shippedFeatures.length > 0) {
      lines.push('### Shipped Features')
      lines.push(
        ctx.learnings.shippedFeatures
          .map((f) => `- **${f.name}** (v${f.version})${f.description ? `: ${f.description}` : ''}`)
          .join('\n')
      )
      lines.push('')
    }
  }

  return lines.join('\n')
}

// =============================================================================
// Analysis Helpers
// =============================================================================

type Analysis = NonNullable<ProjectContext['analysis']>

function formatPatterns(patterns: Analysis['patterns'], limit?: number): string {
  const items = limit ? patterns.slice(0, limit) : patterns
  return items
    .map((p) => `- **${p.name}**: ${p.description}${p.location ? ` (${p.location})` : ''}`)
    .join('\n')
}

function formatAntiPatterns(antiPatterns: Analysis['antiPatterns'], limit?: number): string {
  const items = limit ? antiPatterns.slice(0, limit) : antiPatterns
  return items.map((ap) => `- **${ap.issue}** in \`${ap.file}\` — ${ap.suggestion}`).join('\n')
}

function formatStructure(analysis: Analysis): string {
  const parts: string[] = []
  if (analysis.packageManager) parts.push(`- Package Manager: \`${analysis.packageManager}\``)
  if (analysis.sourceDir) parts.push(`- Source: \`${analysis.sourceDir}/\``)
  if (analysis.testDir) parts.push(`- Tests: \`${analysis.testDir}/\``)
  return parts.length > 0 ? `\n### Project Structure\n\n${parts.join('\n')}\n` : ''
}

function formatAnalysisForClaude(analysis: Analysis): string {
  const parts: string[] = []
  if (analysis.patterns?.length > 0) {
    parts.push(`\n### Code Patterns (Follow These)\n\n${formatPatterns(analysis.patterns)}`)
  }
  if (analysis.antiPatterns?.length > 0) {
    parts.push(`\n### Anti-Patterns (Avoid These)\n\n${formatAntiPatterns(analysis.antiPatterns)}`)
  }
  parts.push(formatStructure(analysis))
  return parts.join('\n')
}

/**
 * Format context for Claude Code (CLAUDE.md)
 * Detailed markdown with full context
 */
export function formatForClaude(ctx: ProjectContext, _config: AIToolConfig): string {
  const s = ctx.sources || defaultSources()

  return `<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->
# ${ctx.name} - Project Rules
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
${ctx.analysis ? formatAnalysisForClaude(ctx.analysis) : `\n> Run \`p. sync\` to populate project intelligence\n`}
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

---

## RECENT LEARNINGS

${
  ctx.learnings &&
  (
    ctx.learnings.completedTasks.length > 0 ||
      ctx.learnings.resolvedBugs.length > 0 ||
      ctx.learnings.shippedFeatures.length > 0
  )
    ? `
### Completed Tasks
${ctx.learnings.completedTasks.length > 0 ? ctx.learnings.completedTasks.map((t) => `- ${t.description}${t.branch ? ` (${t.branch})` : ''}`).join('\n') : '_(No completed tasks yet)_'}

### Resolved Bugs
${ctx.learnings.resolvedBugs.length > 0 ? ctx.learnings.resolvedBugs.map((b) => `- ${b.description}`).join('\n') : '_(No resolved bugs yet)_'}

### Shipped Features
${ctx.learnings.shippedFeatures.length > 0 ? ctx.learnings.shippedFeatures.map((f) => `- **${f.name}** (v${f.version})${f.description ? `: ${f.description}` : ''}`).join('\n') : '_(No shipped features yet)_'}
`
    : '> Run `p. sync` to populate learnings from task history'
}
<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->
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

  // Analysis-driven intelligence
  if (ctx.analysis) {
    if (ctx.analysis.patterns?.length > 0) {
      lines.push('## Code Patterns')
      lines.push(formatPatterns(ctx.analysis.patterns))
      lines.push('')
    }
    if (ctx.analysis.antiPatterns?.length > 0) {
      lines.push('## Anti-Patterns (Avoid)')
      lines.push(formatAntiPatterns(ctx.analysis.antiPatterns))
      lines.push('')
    }
    const structure = formatStructure(ctx.analysis)
    if (structure) {
      lines.push(structure.trim())
      lines.push('')
    }
  } else {
    lines.push('> Run `p. sync` to populate project intelligence')
  }

  // Operational context (prjct rules, state, agents, learnings)
  lines.push('')
  lines.push(formatOperationalContext(ctx, 'concise'))

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

  // Analysis-driven intelligence (capped for Copilot's token budget)
  if (ctx.analysis) {
    if (ctx.analysis.patterns?.length > 0) {
      lines.push('## Code Patterns')
      lines.push(formatPatterns(ctx.analysis.patterns, 5))
      lines.push('')
    }
    if (ctx.analysis.antiPatterns?.length > 0) {
      lines.push('## Anti-Patterns')
      lines.push(formatAntiPatterns(ctx.analysis.antiPatterns, 3))
      lines.push('')
    }
  } else {
    lines.push('> Run `p. sync` to populate project intelligence')
    lines.push('')
  }

  // Commands
  lines.push(cite(s.commands))
  lines.push('## Commands')
  lines.push(`- Test: \`${ctx.commands.test}\``)
  lines.push(`- Build: \`${ctx.commands.build}\``)
  lines.push('')

  // Operational context (prjct rules, state, agents, learnings)
  lines.push(formatOperationalContext(ctx, 'concise'))

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

  // Analysis-driven intelligence
  if (ctx.analysis) {
    if (ctx.analysis.patterns?.length > 0) {
      lines.push('## Code Patterns')
      lines.push(formatPatterns(ctx.analysis.patterns))
      lines.push('')
    }
    if (ctx.analysis.antiPatterns?.length > 0) {
      lines.push('## Anti-Patterns (Avoid)')
      lines.push(formatAntiPatterns(ctx.analysis.antiPatterns))
    }
  } else {
    lines.push('> Run `p. sync` to populate project intelligence')
  }

  // Operational context (prjct rules, state, agents, learnings)
  lines.push('')
  lines.push(formatOperationalContext(ctx, 'concise'))

  return lines.join('\n')
}

/**
 * Format context for Continue.dev (.continue/config.json)
 * JSON config with system message and context providers
 */
export function formatForContinue(ctx: ProjectContext, _config: AIToolConfig): string {
  const messageParts = [
    `You are working on ${ctx.name}, a ${ctx.projectType} ${ctx.ecosystem} project.`,
    '',
    `Stack: ${ctx.languages.join(', ')}${ctx.frameworks.length > 0 ? ` with ${ctx.frameworks.join(', ')}` : ''}`,
    '',
    'Commands:',
    `- Install: ${ctx.commands.install}`,
    `- Dev: ${ctx.commands.dev}`,
    `- Test: ${ctx.commands.test}`,
    `- Build: ${ctx.commands.build}`,
  ]
  if (ctx.analysis?.patterns?.length) {
    messageParts.push('', 'Code Patterns:')
    for (const p of ctx.analysis.patterns) {
      messageParts.push(`- ${p.name}: ${p.description}`)
    }
  }
  if (ctx.analysis?.antiPatterns?.length) {
    messageParts.push('', 'Anti-Patterns (Avoid):')
    for (const ap of ctx.analysis.antiPatterns) {
      messageParts.push(`- ${ap.issue} in ${ap.file} — ${ap.suggestion}`)
    }
  }
  if (!ctx.analysis) {
    messageParts.push('', 'Run `p. sync` to populate project intelligence.')
  }

  // Operational context
  messageParts.push('')
  messageParts.push('prjct Rules:')
  messageParts.push(`- All prjct data: ~/.prjct-cli/projects/${ctx.projectId}/`)
  messageParts.push('- Workflow: p. sync → p. task "desc" → work → p. done → p. ship')
  messageParts.push('')
  messageParts.push(
    `Project: ${ctx.name} v${ctx.version} | ${ctx.ecosystem} | Branch: ${ctx.branch} | Files: ~${ctx.fileCount}`
  )
  if (ctx.agents.workflow.length > 0) {
    messageParts.push(`Agents: ${[...ctx.agents.workflow, ...ctx.agents.domain].join(', ')}`)
  }
  const systemMessage = messageParts.join('\n')

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
 * Format context for OpenAI Codex (AGENTS.md)
 * Plain markdown — no frontmatter (AGENTS.md spec)
 * Full operational context — same data as Claude gets
 */
export function formatForCodex(ctx: ProjectContext, _config: AIToolConfig): string {
  const lines: string[] = []

  lines.push('<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->')
  lines.push(`# ${ctx.name} - Project Rules`)
  lines.push(`<!-- projectId: ${ctx.projectId} -->`)
  lines.push(`<!-- Generated: ${new Date().toISOString()} -->`)
  lines.push(`<!-- Ecosystem: ${ctx.ecosystem} | Type: ${ctx.projectType} -->`)
  lines.push('')

  // Tech Stack
  lines.push(`## THIS PROJECT (${ctx.ecosystem})`)
  lines.push('')
  lines.push(`**Type:** ${ctx.projectType}`)
  lines.push(`**Path:** ${ctx.repoPath}`)
  lines.push('')

  // Commands
  lines.push('### Commands (USE THESE, NOT OTHERS)')
  lines.push('')
  lines.push('| Action | Command |')
  lines.push('|--------|---------|')
  lines.push(`| Install dependencies | \`${ctx.commands.install}\` |`)
  lines.push(`| Run dev server | \`${ctx.commands.dev}\` |`)
  lines.push(`| Run tests | \`${ctx.commands.test}\` |`)
  lines.push(`| Build | \`${ctx.commands.build}\` |`)
  lines.push(`| Lint | \`${ctx.commands.lint}\` |`)
  lines.push(`| Format | \`${ctx.commands.format}\` |`)
  lines.push('')

  // Code Conventions
  lines.push('### Code Conventions')
  lines.push('')
  lines.push(`- **Languages**: ${ctx.languages.join(', ') || 'Not detected'}`)
  lines.push(`- **Frameworks**: ${ctx.frameworks.join(', ') || 'Not detected'}`)

  // Analysis-driven intelligence
  if (ctx.analysis) {
    if (ctx.analysis.patterns?.length > 0) {
      lines.push('')
      lines.push('### Code Patterns (Follow These)')
      lines.push('')
      lines.push(formatPatterns(ctx.analysis.patterns))
    }
    if (ctx.analysis.antiPatterns?.length > 0) {
      lines.push('')
      lines.push('### Anti-Patterns (Avoid These)')
      lines.push('')
      lines.push(formatAntiPatterns(ctx.analysis.antiPatterns))
    }
    lines.push(formatStructure(ctx.analysis))
  } else {
    lines.push('')
    lines.push('> Run `p. sync` to populate project intelligence')
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  // Operational context (prjct rules, state, agents, learnings)
  lines.push(formatOperationalContext(ctx, 'full'))

  lines.push('<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->')

  return lines.join('\n')
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
    codex: formatForCodex,
  }

  return formatters[toolId] || null
}
