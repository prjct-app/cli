/**
 * Prompt Builder
 * Builds prompts for Claude based on templates and context
 * Claude decides what to do - NO if/else logic here
 */

class PromptBuilder {
  /**
   * Build concise prompt - only essentials
   */
  build(template, context, state, agent = null) {
    const parts = []

    // Agent assignment (if applicable)
    if (agent) {
      parts.push(`AGENT: ${agent.name}\n`)
      parts.push(`CONTEXT: ${context.filteredSize || 'all'} files (${context.reduction || 0}% reduced)\n\n`)
    }

    // Core instruction (concise)
    parts.push(`TASK: ${template.frontmatter.description}\n`)

    // Tools (inline)
    if (template.frontmatter['allowed-tools']) {
      parts.push(`TOOLS: ${template.frontmatter['allowed-tools'].join(', ')}\n`)
    }

    // Critical parameters only
    if (context.params?.task || context.params?.description) {
      parts.push(`INPUT: ${context.params.task || context.params.description}\n`)
    }

    parts.push('\n---\n')

    // Template (only the flow section, skip verbose explanations)
    const flowMatch = template.content.match(/## Flow([\s\S]*?)(?=##|$)/)
    if (flowMatch) {
      parts.push(flowMatch[0])
    } else {
      // Fallback to full template if no flow section
      parts.push(template.content)
    }

    // Current state (only if exists and relevant)
    const relevantState = this.filterRelevantState(state)
    if (relevantState) {
      parts.push('\nSTATE:\n')
      parts.push(relevantState)
      parts.push('\n')
    }

    // Simple execution directive
    parts.push('\nEXECUTE: Follow flow. Use tools. Decide.\n')

    return parts.join('')
  }

  /**
   * Filter only relevant state data
   */
  filterRelevantState(state) {
    if (!state || Object.keys(state).length === 0) return null

    const relevant = []
    for (const [key, content] of Object.entries(state)) {
      if (content && content.trim() && content.length < 500) {
        relevant.push(`${key}: ${content.substring(0, 200)}`)
      }
    }

    return relevant.length > 0 ? relevant.join('\n') : null
  }

  /**
   * Build analysis prompt
   * Used for tasks that need Claude to analyze before acting
   * @param {string} analysisType - Type of analysis
   * @param {Object} context - Context
   * @returns {string} Analysis prompt
   */
  buildAnalysis(analysisType, context) {
    const parts = []

    parts.push(`# Analyze: ${analysisType}\n\n`)
    parts.push('Read the project context and provide your analysis.\n')
    parts.push('No predetermined patterns - decide based on what you find.\n\n')

    parts.push('## Project Context\n')
    parts.push(`- Path: ${context.projectPath}\n`)
    parts.push(`- ID: ${context.projectId}\n\n`)

    return parts.join('')
  }
}

module.exports = new PromptBuilder()
