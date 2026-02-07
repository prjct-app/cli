/**
 * ContextFileGenerator - Generates markdown context files
 *
 * Responsible for generating:
 * - CLAUDE.md (main context for AI agents)
 * - now.md (current task)
 * - next.md (task queue)
 * - ideas.md (captured ideas)
 * - shipped.md (completed features)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import type {
  ContextGeneratorConfig,
  GitData,
  ProjectCommands,
  ProjectStats,
  SyncAgentInfo,
} from '../types'
import { type ContextSources, cite, defaultSources } from '../utils/citations'
import * as dateHelper from '../utils/date-helper'
import { mergePreservedSections, validatePreserveBlocks } from '../utils/preserve-sections'
import { NestedContextResolver } from './nested-context-resolver'

export type {
  ContextGeneratorConfig,
  GitData,
  ProjectCommands,
  ProjectStats,
  SyncAgentInfo,
} from '../types'

// ============================================================================
// CONTEXT FILE GENERATOR
// ============================================================================

export class ContextFileGenerator {
  private config: ContextGeneratorConfig

  constructor(config: ContextGeneratorConfig) {
    this.config = config
  }

  /**
   * Write file with preserved sections from existing content
   * This ensures user customizations survive regeneration
   */
  private async writeWithPreservation(filePath: string, content: string): Promise<void> {
    let finalContent = content

    try {
      const existingContent = await fs.readFile(filePath, 'utf-8')

      // Validate existing preserved blocks
      const validation = validatePreserveBlocks(existingContent)
      if (!validation.valid) {
        const filename = path.basename(filePath)
        console.warn(`⚠️  ${filename} has invalid preserve blocks:`)
        for (const error of validation.errors) {
          console.warn(`   ${error}`)
        }
      }

      // Merge preserved sections from existing content
      finalContent = mergePreservedSections(content, existingContent)
    } catch {
      // File doesn't exist yet - use generated content as-is
    }

    await fs.writeFile(filePath, finalContent, 'utf-8')
  }

  /**
   * Generate all context files in parallel
   */
  async generate(
    git: GitData,
    stats: ProjectStats,
    commands: ProjectCommands,
    agents: SyncAgentInfo[],
    sources?: ContextSources
  ): Promise<string[]> {
    const contextPath = path.join(this.config.globalPath, 'context')

    // Generate all context files IN PARALLEL
    await Promise.all([
      this.generateClaudeMd(contextPath, git, stats, commands, agents, sources),
      this.generateNowMd(contextPath),
      this.generateNextMd(contextPath),
      this.generateIdeasMd(contextPath),
      this.generateShippedMd(contextPath),
    ])

    return [
      'context/CLAUDE.md',
      'context/now.md',
      'context/next.md',
      'context/ideas.md',
      'context/shipped.md',
    ]
  }

  // ==========================================================================
  // INDIVIDUAL GENERATORS
  // ==========================================================================

  /**
   * Generate CLAUDE.md - main context file for AI agents
   */
  private async generateClaudeMd(
    contextPath: string,
    git: GitData,
    stats: ProjectStats,
    commands: ProjectCommands,
    agents: SyncAgentInfo[],
    sources?: ContextSources
  ): Promise<void> {
    const workflowAgents = agents.filter((a) => a.type === 'workflow').map((a) => a.name)
    const domainAgents = agents.filter((a) => a.type === 'domain').map((a) => a.name)
    const s = sources || defaultSources()

    const content = `# ${stats.name} - Project Rules
<!-- projectId: ${this.config.projectId} -->
<!-- Generated: ${dateHelper.getTimestamp()} -->
<!-- Ecosystem: ${stats.ecosystem} | Type: ${stats.projectType} -->

## THIS PROJECT (${stats.ecosystem})

${cite(s.ecosystem)}
**Type:** ${stats.projectType}
**Path:** ${this.config.projectPath}

### Commands (USE THESE, NOT OTHERS)

${cite(s.commands)}
| Action | Command |
|--------|---------|
| Install dependencies | \`${commands.install}\` |
| Run dev server | \`${commands.dev}\` |
| Run tests | \`${commands.test}\` |
| Build | \`${commands.build}\` |
| Lint | \`${commands.lint}\` |
| Format | \`${commands.format}\` |

### Code Conventions

${cite(s.languages)}
- **Languages**: ${stats.languages.join(', ') || 'Not detected'}
${cite(s.frameworks)}
- **Frameworks**: ${stats.frameworks.join(', ') || 'Not detected'}

---

## PRJCT RULES

### Path Resolution
**ALL prjct writes go to**: \`~/.prjct-cli/projects/${this.config.projectId}/\`
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
| Name | ${stats.name} |
| Version | ${stats.version} |
| Ecosystem | ${stats.ecosystem} |
| Branch | ${git.branch} |
| Files | ~${stats.fileCount} |
| Commits | ${git.commits} |

---

## AGENTS

Load from \`~/.prjct-cli/projects/${this.config.projectId}/agents/\`:

**Workflow**: ${workflowAgents.join(', ')}
**Domain**: ${domainAgents.join(', ') || 'none'}
`

    const claudePath = path.join(contextPath, 'CLAUDE.md')
    await this.writeWithPreservation(claudePath, content)
  }

  /**
   * Generate now.md - current task status
   */
  private async generateNowMd(contextPath: string): Promise<void> {
    let currentTask = null
    try {
      const statePath = path.join(this.config.globalPath, 'storage', 'state.json')
      const state = JSON.parse(await fs.readFile(statePath, 'utf-8'))
      currentTask = state.currentTask
    } catch {
      // No state file
    }

    const content = currentTask
      ? `# NOW

**${currentTask.description}**

Started: ${currentTask.startedAt}
${currentTask.branch ? `Branch: ${currentTask.branch.name}` : ''}
`
      : `# NOW

_No active task_

Use \`p. task "description"\` to start working.
`

    await this.writeWithPreservation(path.join(contextPath, 'now.md'), content)
  }

  /**
   * Generate next.md - task queue
   */
  private async generateNextMd(contextPath: string): Promise<void> {
    let queue: { tasks: { description: string; priority?: string }[] } = { tasks: [] }
    try {
      const queuePath = path.join(this.config.globalPath, 'storage', 'queue.json')
      queue = JSON.parse(await fs.readFile(queuePath, 'utf-8'))
    } catch {
      // No queue file
    }

    const content = `# NEXT

${
  queue.tasks.length > 0
    ? queue.tasks
        .map((t, i) => `${i + 1}. ${t.description}${t.priority ? ` [${t.priority}]` : ''}`)
        .join('\n')
    : '_Empty queue_'
}
`

    await this.writeWithPreservation(path.join(contextPath, 'next.md'), content)
  }

  /**
   * Generate ideas.md - captured ideas
   */
  private async generateIdeasMd(contextPath: string): Promise<void> {
    let ideas: { ideas: { text: string; priority?: string }[] } = { ideas: [] }
    try {
      const ideasPath = path.join(this.config.globalPath, 'storage', 'ideas.json')
      ideas = JSON.parse(await fs.readFile(ideasPath, 'utf-8'))
    } catch {
      // No ideas file
    }

    const content = `# IDEAS

${
  ideas.ideas.length > 0
    ? ideas.ideas.map((i) => `- ${i.text}${i.priority ? ` [${i.priority}]` : ''}`).join('\n')
    : '_No ideas captured yet_'
}
`

    await this.writeWithPreservation(path.join(contextPath, 'ideas.md'), content)
  }

  /**
   * Generate shipped.md - completed features
   */
  private async generateShippedMd(contextPath: string): Promise<void> {
    let shipped: { shipped: { name: string; version?: string; shippedAt: string }[] } = {
      shipped: [],
    }
    try {
      const shippedPath = path.join(this.config.globalPath, 'storage', 'shipped.json')
      shipped = JSON.parse(await fs.readFile(shippedPath, 'utf-8'))
    } catch {
      // No shipped file
    }

    const content = `# SHIPPED 🚀

${
  shipped.shipped.length > 0
    ? shipped.shipped
        .slice(-10)
        .map((s) => `- **${s.name}**${s.version ? ` v${s.version}` : ''} - ${s.shippedAt}`)
        .join('\n')
    : '_Nothing shipped yet_'
}

**Total shipped:** ${shipped.shipped.length}
`

    await this.writeWithPreservation(path.join(contextPath, 'shipped.md'), content)
  }

  // ==========================================================================
  // MONOREPO SUPPORT
  // ==========================================================================

  /**
   * Generate CLAUDE.md files for each package in a monorepo
   * Each package gets its own context file with inherited + package-specific rules
   */
  async generateMonorepoContexts(
    git: GitData,
    stats: ProjectStats,
    commands: ProjectCommands,
    agents: SyncAgentInfo[]
  ): Promise<string[]> {
    const monoInfo = await pathManager.detectMonorepo(this.config.projectPath)

    if (!monoInfo.isMonorepo) {
      return []
    }

    const generatedFiles: string[] = []
    const resolver = new NestedContextResolver(this.config.projectPath)
    await resolver.initialize()

    // Generate CLAUDE.md for each package that has PRJCT.md
    for (const pkg of monoInfo.packages) {
      if (!pkg.hasPrjctMd) continue

      const resolvedCtx = await resolver.getPackageContext(pkg.name)
      if (!resolvedCtx) continue

      const content = await this.generatePackageClaudeMd(
        pkg,
        resolvedCtx,
        git,
        stats,
        commands,
        agents
      )

      // Write to the package directory
      const claudePath = path.join(pkg.path, 'CLAUDE.md')
      await this.writeWithPreservation(claudePath, content)
      generatedFiles.push(path.relative(this.config.projectPath, claudePath))
    }

    return generatedFiles
  }

  /**
   * Generate CLAUDE.md content for a specific package
   */
  private async generatePackageClaudeMd(
    pkg: { name: string; path: string; relativePath: string },
    resolvedCtx: { content: string; sources: string[]; overrides: string[] },
    git: GitData,
    stats: ProjectStats,
    commands: ProjectCommands,
    agents: SyncAgentInfo[]
  ): Promise<string> {
    const workflowAgents = agents.filter((a) => a.type === 'workflow').map((a) => a.name)
    const domainAgents = agents.filter((a) => a.type === 'domain').map((a) => a.name)

    // Try to read package-specific info
    let pkgVersion = stats.version
    let pkgName = pkg.name
    try {
      const pkgJsonPath = path.join(pkg.path, 'package.json')
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'))
      pkgVersion = pkgJson.version || stats.version
      pkgName = pkgJson.name || pkg.name
    } catch {
      // Use defaults
    }

    return `# ${pkgName} - Package Rules
<!-- package: ${pkg.relativePath} -->
<!-- monorepo: ${stats.name} -->
<!-- Generated: ${dateHelper.getTimestamp()} -->
<!-- Sources: ${resolvedCtx.sources.join(' → ')} -->

## THIS PACKAGE

**Name:** ${pkgName}
**Path:** ${pkg.relativePath}
**Version:** ${pkgVersion}
**Monorepo:** ${stats.name}

---

## INHERITED CONTEXT

${resolvedCtx.content || '_No PRJCT.md rules defined_'}

${resolvedCtx.overrides.length > 0 ? `\n**Overrides:** ${resolvedCtx.overrides.join(', ')}\n` : ''}

---

## COMMANDS

| Action | Command |
|--------|---------|
| Install | \`${commands.install}\` |
| Dev | \`${commands.dev}\` |
| Test | \`${commands.test}\` |
| Build | \`${commands.build}\` |

---

## PROJECT STATE

| Field | Value |
|-------|-------|
| Package | ${pkgName} |
| Monorepo | ${stats.name} |
| Branch | ${git.branch} |
| Ecosystem | ${stats.ecosystem} |

---

## AGENTS

Load from \`~/.prjct-cli/projects/${this.config.projectId}/agents/\`:

**Workflow**: ${workflowAgents.join(', ')}
**Domain**: ${domainAgents.join(', ') || 'none'}
`
  }
}

export default ContextFileGenerator
