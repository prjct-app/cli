/**
 * Sync Agent Generation — Agent generation functions extracted from SyncService.
 *
 * Standalone exported functions for:
 * - Agent generation (workflow + domain)
 * - Existing agent loading
 * - Template include resolution
 * - Skill configuration and auto-installation
 *
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../errors'
import type { ProjectStats, StackDetection, SyncAgentInfo } from '../types'
import * as dateHelper from '../utils/date-helper'
import log from '../utils/logger'
import { skillInstaller } from './skill-installer'

/** Task feedback context for agent generation (PRJ-272) */
export interface TaskFeedbackContext {
  patternsDiscovered: string[]
  knownGotchas: string[]
  agentAccuracy: Array<{ agent: string; rating: string; note?: string }>
}

// ============================================================================
// AGENT GENERATION
// ============================================================================

export async function generateAgents(
  globalPath: string,
  stack: StackDetection,
  stats: ProjectStats,
  feedbackContext?: TaskFeedbackContext
): Promise<SyncAgentInfo[]> {
  const agents: SyncAgentInfo[] = []
  const agentsPath = path.join(globalPath, 'agents')

  // Purge old agents
  try {
    const files = await fs.readdir(agentsPath)
    for (const file of files) {
      if (file.endsWith('.md')) {
        await fs.unlink(path.join(agentsPath, file))
      }
    }
  } catch (error) {
    log.debug('Failed to purge old agents', { path: agentsPath, error: getErrorMessage(error) })
  }

  // Workflow agents (always generated) - IN PARALLEL
  const workflowAgents = ['prjct-workflow', 'prjct-planner', 'prjct-shipper']
  await Promise.all(workflowAgents.map((name) => generateWorkflowAgent(name, agentsPath)))
  for (const name of workflowAgents) {
    agents.push({ name, type: 'workflow' })
  }

  // Domain agents (based on stack) - COLLECT AND GENERATE IN PARALLEL
  const domainAgentsToGenerate: { name: string; skill?: string }[] = []

  if (stack.hasFrontend) {
    domainAgentsToGenerate.push({ name: 'frontend', skill: 'javascript-typescript' })
    domainAgentsToGenerate.push({ name: 'uxui', skill: 'frontend-design' })
  }
  if (stack.hasBackend) {
    domainAgentsToGenerate.push({ name: 'backend', skill: 'javascript-typescript' })
  }
  if (stack.hasDatabase) {
    domainAgentsToGenerate.push({ name: 'database' })
  }
  if (stack.hasTesting) {
    domainAgentsToGenerate.push({ name: 'testing', skill: 'developer-kit' })
  }
  if (stack.hasDocker) {
    domainAgentsToGenerate.push({ name: 'devops', skill: 'developer-kit' })
  }

  // Generate all domain agents IN PARALLEL
  await Promise.all(
    domainAgentsToGenerate.map((agent) =>
      generateDomainAgent(agent.name, agentsPath, stats, stack, feedbackContext)
    )
  )

  // Add to agents list
  for (const agent of domainAgentsToGenerate) {
    agents.push({ name: agent.name, type: 'domain', skill: agent.skill })
  }

  return agents
}

// ============================================================================
// LOAD EXISTING AGENTS
// ============================================================================

/**
 * Load existing agent info from disk (for incremental sync when agents don't need regeneration).
 * Reads the agents directory and returns metadata without regenerating files.
 */
export async function loadExistingAgents(globalPath: string): Promise<SyncAgentInfo[]> {
  const agentsPath = path.join(globalPath, 'agents')
  const agents: SyncAgentInfo[] = []

  try {
    const files = await fs.readdir(agentsPath)
    const workflowNames = new Set(['prjct-workflow', 'prjct-planner', 'prjct-shipper'])

    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const name = file.replace('.md', '')
      const type = workflowNames.has(name) ? ('workflow' as const) : ('domain' as const)
      agents.push({ name, type })
    }
  } catch {
    // No existing agents — fall back to generation
    return []
  }

  return agents
}

// ============================================================================
// TEMPLATE INCLUDES
// ============================================================================

/**
 * Resolve {{> partial-name }} includes in template content.
 * Loads partials from templates/subagents/.
 */
export async function resolveTemplateIncludes(content: string): Promise<string> {
  const includePattern = /\{\{>\s*([\w-]+)\s*\}\}/g
  const matches = [...content.matchAll(includePattern)]

  if (matches.length === 0) return content

  let resolved = content
  for (const match of matches) {
    const partialName = match[1]
    const partialPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'subagents',
      `${partialName}.md`
    )
    try {
      const partialContent = await fs.readFile(partialPath, 'utf-8')
      resolved = resolved.replace(match[0], partialContent.trim())
    } catch {
      // Partial not found — leave marker for debugging
      resolved = resolved.replace(match[0], `<!-- partial "${partialName}" not found -->`)
    }
  }

  return resolved
}

// ============================================================================
// WORKFLOW AGENT GENERATION
// ============================================================================

export async function generateWorkflowAgent(name: string, agentsPath: string): Promise<void> {
  // Try to read template
  let content = ''
  try {
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'subagents',
      'workflow',
      `${name}.md`
    )
    content = await fs.readFile(templatePath, 'utf-8')
    content = await resolveTemplateIncludes(content)
  } catch (error) {
    log.debug('Workflow agent template not found, generating minimal', {
      name,
      error: getErrorMessage(error),
    })
    content = generateMinimalWorkflowAgent(name)
  }

  await fs.writeFile(path.join(agentsPath, `${name}.md`), content, 'utf-8')
}

// ============================================================================
// DOMAIN AGENT GENERATION
// ============================================================================

export async function generateDomainAgent(
  name: string,
  agentsPath: string,
  stats: ProjectStats,
  stack: StackDetection,
  feedbackContext?: TaskFeedbackContext
): Promise<void> {
  // Try to read template
  let content = ''
  try {
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'subagents',
      'domain',
      `${name}.md`
    )
    content = await fs.readFile(templatePath, 'utf-8')

    // Resolve includes before variable replacement
    content = await resolveTemplateIncludes(content)

    // Inject project-specific context
    content = content.replace('{projectName}', stats.name)
    content = content.replace('{frameworks}', stack.frameworks.join(', ') || 'None detected')
    content = content.replace('{ecosystem}', stats.ecosystem)
  } catch (error) {
    log.debug('Domain agent template not found, generating minimal', {
      name,
      error: getErrorMessage(error),
    })
    content = generateMinimalDomainAgent(name, stats, stack)
  }

  // Inject task feedback learnings (PRJ-272)
  content = injectFeedbackSection(content, name, feedbackContext)

  await fs.writeFile(path.join(agentsPath, `${name}.md`), content, 'utf-8')
}

// ============================================================================
// FEEDBACK INJECTION
// ============================================================================

/**
 * Inject a "Recent Learnings" section into agent content from task feedback (PRJ-272)
 */
export function injectFeedbackSection(
  content: string,
  agentName: string,
  feedbackContext?: TaskFeedbackContext
): string {
  if (!feedbackContext) return content

  const { patternsDiscovered, knownGotchas, agentAccuracy } = feedbackContext

  const agentNotes = agentAccuracy.filter(
    (a) => a.agent === `${agentName}.md` || a.agent === agentName
  )

  const hasContent =
    patternsDiscovered.length > 0 || knownGotchas.length > 0 || agentNotes.length > 0
  if (!hasContent) return content

  const lines: string[] = ['\n## Recent Learnings (from completed tasks)\n']

  if (patternsDiscovered.length > 0) {
    lines.push('### Discovered Patterns')
    for (const pattern of patternsDiscovered) {
      lines.push(`- ${pattern}`)
    }
    lines.push('')
  }

  if (knownGotchas.length > 0) {
    lines.push('### Known Gotchas')
    for (const gotcha of knownGotchas) {
      lines.push(`- ${gotcha}`)
    }
    lines.push('')
  }

  if (agentNotes.length > 0) {
    lines.push('### Agent Accuracy Notes')
    for (const note of agentNotes) {
      const desc = note.note ? ` — ${note.note}` : ''
      lines.push(`- ${note.rating}${desc}`)
    }
    lines.push('')
  }

  return content + lines.join('\n')
}

// ============================================================================
// MINIMAL AGENT GENERATORS
// ============================================================================

export function generateMinimalWorkflowAgent(name: string): string {
  const descriptions: Record<string, string> = {
    'prjct-workflow': 'Task lifecycle: now, done, pause, resume',
    'prjct-planner': 'Planning: task, prd, spec, bug',
    'prjct-shipper': 'Shipping: ship, merge, review',
  }

  return `---
name: ${name}
description: ${descriptions[name] || 'Workflow agent'}
tools: Read, Write, Glob
---

# ${name.toUpperCase()}

Workflow agent for prjct operations.

## Project Context

When invoked:
1. Read \`.prjct/prjct.config.json\` → extract \`projectId\`
2. Read \`~/.prjct-cli/projects/{projectId}/storage/state.json\`
3. Execute requested operation
`
}

export function generateMinimalDomainAgent(
  name: string,
  stats: ProjectStats,
  stack: StackDetection
): string {
  return `---
name: ${name}
description: ${name.charAt(0).toUpperCase() + name.slice(1)} specialist for ${stats.name}
tools: Read, Write, Glob, Grep
skills: []
---

# ${name.toUpperCase()} AGENT

Domain specialist for ${name} tasks.

## Project Context

- **Project**: ${stats.name}
- **Ecosystem**: ${stats.ecosystem}
- **Frameworks**: ${stack.frameworks.join(', ') || 'None detected'}

## Your Role

You are the ${name} expert for this project. Apply best practices for the detected stack.
`
}

// ============================================================================
// SKILL CONFIGURATION
// ============================================================================

export function configureSkills(
  agents: SyncAgentInfo[],
  projectId: string,
  globalPath: string
): { agent: string; skill: string }[] {
  const skills: { agent: string; skill: string }[] = []

  for (const agent of agents) {
    if (agent.skill) {
      skills.push({ agent: agent.name, skill: agent.skill })
    }
  }

  // Write skills.json
  const skillsConfig = {
    projectId,
    syncedAt: dateHelper.getTimestamp(),
    skills: skills.map((s) => ({
      name: s.skill,
      linkedAgents: [s.agent],
    })),
    agentSkillMap: Object.fromEntries(skills.map((s) => [s.agent, s.skill])),
  }

  fs.writeFile(
    path.join(globalPath, 'config', 'skills.json'),
    JSON.stringify(skillsConfig, null, 2),
    'utf-8'
  ).catch((error) => {
    log.debug('Failed to write skills.json', { error: getErrorMessage(error) })
  })

  return skills
}

// ============================================================================
// SKILL AUTO-INSTALLATION
// ============================================================================

/**
 * Auto-install skills from skill-mappings.json for generated agents.
 * Reads the mapping, checks which packages are needed, and installs missing ones.
 */
export async function autoInstallSkills(
  agents: SyncAgentInfo[]
): Promise<{ name: string; agent: string; status: 'installed' | 'skipped' | 'error' }[]> {
  const results: { name: string; agent: string; status: 'installed' | 'skipped' | 'error' }[] = []

  try {
    // Load skill mappings
    const mappingsPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'config',
      'skill-mappings.json'
    )
    const mappingsContent = await fs.readFile(mappingsPath, 'utf-8')
    const mappings = JSON.parse(mappingsContent)
    const agentToSkillMap = mappings.agentToSkillMap || {}

    // Collect all packages to install, grouped by agent
    const packagesToInstall: { pkg: string; agent: string }[] = []
    for (const agent of agents) {
      const mapping = agentToSkillMap[agent.name]
      if (mapping?.packages) {
        for (const pkg of mapping.packages) {
          packagesToInstall.push({ pkg, agent: agent.name })
        }
      }
    }

    if (packagesToInstall.length === 0) return results

    // Install each package (check if already installed first)
    const skillsDir = path.join(os.homedir(), '.claude', 'skills')
    for (const { pkg, agent } of packagesToInstall) {
      // Extract skill name from package path (e.g., "anthropics/skills/frontend-design" -> "frontend-design")
      const skillName = pkg.split('/').pop() || pkg

      // Check if already installed
      const subdirPath = path.join(skillsDir, skillName, 'SKILL.md')
      const flatPath = path.join(skillsDir, `${skillName}.md`)

      let alreadyInstalled = false
      try {
        await fs.access(subdirPath)
        alreadyInstalled = true
      } catch {
        try {
          await fs.access(flatPath)
          alreadyInstalled = true
        } catch {
          // Not installed
        }
      }

      if (alreadyInstalled) {
        results.push({ name: skillName, agent, status: 'skipped' })
        continue
      }

      // Install via skillInstaller (supports owner/repo format)
      try {
        // Parse package as owner/repo or owner/repo@skill format
        // "anthropics/skills/frontend-design" -> owner=anthropics, repo=skills, skill=frontend-design
        const parts = pkg.split('/')
        let installSource: string
        if (parts.length === 3) {
          // owner/repo/skill -> owner/repo@skill
          installSource = `${parts[0]}/${parts[1]}@${parts[2]}`
        } else {
          installSource = pkg
        }

        const installResult = await skillInstaller.install(installSource)
        if (installResult.installed.length > 0) {
          results.push({ name: skillName, agent, status: 'installed' })
          log.info(`Installed skill: ${skillName} for agent: ${agent}`)
        } else if (installResult.errors.length > 0) {
          results.push({ name: skillName, agent, status: 'error' })
          log.debug(`Failed to install skill ${skillName}`, { errors: installResult.errors })
        } else {
          results.push({ name: skillName, agent, status: 'skipped' })
        }
      } catch (error) {
        results.push({ name: skillName, agent, status: 'error' })
        log.debug(`Skill install error for ${skillName}`, { error: getErrorMessage(error) })
      }
    }
  } catch (error) {
    log.debug('Skill auto-installation failed (non-critical)', { error: getErrorMessage(error) })
  }

  return results
}
