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
import dateHelper from '../utils/date-helper'

// ============================================================================
// TYPES
// ============================================================================

export interface GitData {
  branch: string
  commits: number
}

export interface ProjectStats {
  name: string
  version: string
  ecosystem: string
  projectType: string
  fileCount: number
  languages: string[]
  frameworks: string[]
}

export interface Commands {
  install: string
  dev: string
  test: string
  build: string
  lint: string
  format: string
}

export interface AgentInfo {
  name: string
  type: 'workflow' | 'domain'
  skill?: string
}

export interface ContextGeneratorConfig {
  projectId: string
  projectPath: string
  globalPath: string
}

// ============================================================================
// CONTEXT FILE GENERATOR
// ============================================================================

export class ContextFileGenerator {
  private config: ContextGeneratorConfig

  constructor(config: ContextGeneratorConfig) {
    this.config = config
  }

  /**
   * Generate all context files in parallel
   */
  async generate(
    git: GitData,
    stats: ProjectStats,
    commands: Commands,
    agents: AgentInfo[]
  ): Promise<string[]> {
    const contextPath = path.join(this.config.globalPath, 'context')

    // Generate all context files IN PARALLEL
    await Promise.all([
      this.generateClaudeMd(contextPath, git, stats, commands, agents),
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
    commands: Commands,
    agents: AgentInfo[]
  ): Promise<void> {
    const workflowAgents = agents.filter((a) => a.type === 'workflow').map((a) => a.name)
    const domainAgents = agents.filter((a) => a.type === 'domain').map((a) => a.name)

    const content = `# ${stats.name} - Project Rules
<!-- projectId: ${this.config.projectId} -->
<!-- Generated: ${dateHelper.getTimestamp()} -->
<!-- Ecosystem: ${stats.ecosystem} | Type: ${stats.projectType} -->

## THIS PROJECT (${stats.ecosystem})

**Type:** ${stats.projectType}
**Path:** ${this.config.projectPath}

### Commands (USE THESE, NOT OTHERS)

| Action | Command |
|--------|---------|
| Install dependencies | \`${commands.install}\` |
| Run dev server | \`${commands.dev}\` |
| Run tests | \`${commands.test}\` |
| Build | \`${commands.build}\` |
| Lint | \`${commands.lint}\` |
| Format | \`${commands.format}\` |

### Code Conventions

- **Languages**: ${stats.languages.join(', ') || 'Not detected'}
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

    await fs.writeFile(path.join(contextPath, 'CLAUDE.md'), content, 'utf-8')
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

    await fs.writeFile(path.join(contextPath, 'now.md'), content, 'utf-8')
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

    await fs.writeFile(path.join(contextPath, 'next.md'), content, 'utf-8')
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

    await fs.writeFile(path.join(contextPath, 'ideas.md'), content, 'utf-8')
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

    await fs.writeFile(path.join(contextPath, 'shipped.md'), content, 'utf-8')
  }
}

export default ContextFileGenerator
