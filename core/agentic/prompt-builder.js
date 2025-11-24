/**
 * Prompt Builder
 * Builds prompts for Claude based on templates and context
 * Claude decides what to do - NO if/else logic here
 */

class PromptBuilder {
  /**
   * Build concise prompt - only essentials
   * CRITICAL: Includes full agent content if agent is provided
   */
  build(template, context, state, agent = null) {
    const parts = []

    // Agent assignment (if applicable)
    // CRITICAL: Include full agent content, not just name
    if (agent) {
      parts.push(`# AGENT ASSIGNMENT\n`)
      parts.push(`Agent: ${agent.name}\n`)
      
      // Include role if available
      if (agent.role) {
        parts.push(`Role: ${agent.role}\n`)
      }
      
      // Include domain if available
      if (agent.domain) {
        parts.push(`Domain: ${agent.domain}\n`)
      }
      
      // Include skills if available
      if (agent.skills && agent.skills.length > 0) {
        parts.push(`Skills: ${agent.skills.join(', ')}\n`)
      }
      
      parts.push(`\n## AGENT INSTRUCTIONS\n`)
      
      // CRITICAL: Include full agent content
      // This is the specialized knowledge for this project
      if (agent.content) {
        parts.push(agent.content)
        parts.push(`\n`)
      } else if (agent.name) {
        // Fallback if content not loaded
        parts.push(`You are the ${agent.name} agent for this project.\n`)
        parts.push(`Apply your specialized expertise to complete the task.\n\n`)
      }
      
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

    // Enforcement (Strict Mode)
    parts.push(this.buildEnforcement());

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

  /**
   * Build enforcement section
   * Forces Claude to follow the process strictly
   */
  buildEnforcement() {
    return `
## PROCESS ENFORCEMENT
1. FOLLOW the Flow strictly. Do not skip steps.
2. USE the allowed tools only.
3. IF you are stuck, use the "Ask" tool or stop.
4. DO NOT hallucinate files or commands.
5. ALWAYS verify your changes.
`;
  }
}

module.exports = new PromptBuilder()
