/**
 * Prompt Builder
 * Builds prompts for Claude based on templates and context
 * Claude decides what to do - NO if/else logic here
 */

class PromptBuilder {
  /**
   * Build execution prompt for Claude
   * @param {Object} template - Template from template-loader
   * @param {Object} context - Context from context-builder
   * @param {Object} state - Current state from context-builder
   * @returns {string} Prompt for Claude
   */
  build(template, context, state) {
    const parts = []

    // 1. Command instructions from template
    parts.push('# Command Instructions\n')
    parts.push(template.content)
    parts.push('\n')

    // 2. Allowed tools
    if (template.frontmatter['allowed-tools']) {
      parts.push('## Allowed Tools\n')
      parts.push(`You can use: ${template.frontmatter['allowed-tools'].join(', ')}\n\n`)
    }

    // 3. Project context
    parts.push('## Project Context\n')
    parts.push(`- Project ID: ${context.projectId}\n`)
    parts.push(`- Timestamp: ${context.timestamp}\n`)
    parts.push('\n')

    // 4. Current state (only non-null files)
    parts.push('## Current State\n')
    for (const [key, content] of Object.entries(state)) {
      if (content && content.trim()) {
        parts.push(`### ${key}\n`)
        parts.push('```\n')
        parts.push(content)
        parts.push('\n```\n\n')
      }
    }

    // 5. Command parameters
    if (Object.keys(context.params).length > 0) {
      parts.push('## Parameters\n')
      for (const [key, value] of Object.entries(context.params)) {
        parts.push(`- ${key}: ${value}\n`)
      }
      parts.push('\n')
    }

    // 6. Final instruction
    parts.push('## Execute\n')
    parts.push('Based on the instructions above, execute the command.\n')
    parts.push('Use ONLY the allowed tools.\n')
    parts.push('Make decisions based on context - do not follow rigid if/else rules.\n')

    return parts.join('')
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
