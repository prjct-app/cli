/**
 * Skill Loader for Agentic System
 *
 * Integrates skills into the prompt builder and context system.
 * Formats skills for Claude consumption.
 *
 * @version 1.0.0
 */

import skillService from '../services/skill-service'
import type { FormattedSkill, SkillContext } from '../types/agentic'
import type { Skill } from '../types/services'

/**
 * Format a skill for inclusion in prompts
 */
function formatSkillForPrompt(skill: Skill): FormattedSkill {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    prompt: skill.content,
  }
}

/**
 * Generate markdown listing of available skills
 */
function generateSkillsMarkdown(skills: Skill[]): string {
  if (skills.length === 0) {
    return ''
  }

  const lines: string[] = ['## Available Skills', '', 'The following skills can be invoked:', '']

  for (const skill of skills) {
    lines.push(`- **${skill.name}** (\`${skill.id}\`): ${skill.description || 'No description'}`)
    if (skill.metadata.agent) {
      lines.push(`  - Agent: ${skill.metadata.agent}`)
    }
    if (skill.metadata.tags?.length) {
      lines.push(`  - Tags: ${skill.metadata.tags.join(', ')}`)
    }
  }

  return lines.join('\n')
}

/**
 * Load skills and prepare context for prompts
 */
export async function loadSkillContext(projectPath?: string): Promise<SkillContext> {
  const skills = await skillService.getAll(projectPath)

  return {
    availableSkills: skills.map(formatSkillForPrompt),
    skillsMarkdown: generateSkillsMarkdown(skills),
  }
}

/**
 * Get a specific skill's prompt content
 */
export async function getSkillPrompt(
  skillId: string,
  projectPath?: string
): Promise<string | null> {
  const skill = await skillService.get(skillId, projectPath)
  return skill?.content || null
}

/**
 * Find best matching skill for a query
 */
export async function findBestSkill(query: string, projectPath?: string): Promise<Skill | null> {
  const results = await skillService.search(query, projectPath)
  return results[0]?.skill || null
}

/**
 * Format skill invocation result
 */
export function formatSkillResult(skill: Skill, result: string): string {
  return [
    `## Skill Executed: ${skill.name}`,
    '',
    result,
    '',
    `---`,
    `*Skill: ${skill.id} | Source: ${skill.source}*`,
  ].join('\n')
}

/**
 * Build skill section for system prompt
 */
export async function buildSkillSystemPrompt(projectPath?: string): Promise<string> {
  const { availableSkills, skillsMarkdown } = await loadSkillContext(projectPath)

  if (availableSkills.length === 0) {
    return ''
  }

  return ['<skills>', skillsMarkdown, '', 'To invoke a skill, use the skill ID.', '</skills>'].join(
    '\n'
  )
}
