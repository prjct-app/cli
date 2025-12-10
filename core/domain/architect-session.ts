/**
 * Architect Session Manager
 * Handles conversational state for ARCHITECT MODE (Agent-based, not deterministic)
 */

import fs from 'fs/promises'
import path from 'path'

interface ConversationEntry {
  question: string
  answer: string
  timestamp: string
}

interface ArchitectSessionData {
  idea: string
  projectType: string
  active: boolean
  startedAt: string
  completedAt?: string
  conversation: ConversationEntry[]
  answers: Record<string, string>
}

interface SessionSummary {
  idea: string
  projectType: string
  conversationLength: number
  insights: number
  startedAt: string
  completedAt: string
}

class ArchitectSession {
  /**
   * Initialize new architect session
   */
  async init(idea: string, projectType: string, globalPath: string): Promise<ArchitectSessionData> {
    const session: ArchitectSessionData = {
      idea,
      projectType,
      active: true,
      startedAt: new Date().toISOString(),
      conversation: [],
      answers: {},
    }

    await this.save(session, globalPath)
    return session
  }

  /**
   * Load active session
   */
  async load(globalPath: string): Promise<ArchitectSessionData | null> {
    try {
      const sessionPath = path.join(globalPath, 'planning', 'architect-session.json')
      const content = await fs.readFile(sessionPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Save session to disk
   */
  async save(session: ArchitectSessionData, globalPath: string): Promise<void> {
    const planningDir = path.join(globalPath, 'planning')
    await fs.mkdir(planningDir, { recursive: true })

    const sessionPath = path.join(planningDir, 'architect-session.json')
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2))
  }

  /**
   * Log a Q&A pair to the conversation
   */
  async logQA(question: string, answer: string, globalPath: string): Promise<void> {
    const session = await this.load(globalPath)

    if (!session || !session.active) {
      throw new Error('No active architect session')
    }

    session.conversation.push({
      question,
      answer,
      timestamp: new Date().toISOString(),
    })

    await this.save(session, globalPath)
  }

  /**
   * Save key insight for plan generation
   */
  async saveInsight(key: string, value: string, globalPath: string): Promise<void> {
    const session = await this.load(globalPath)

    if (!session || !session.active) {
      throw new Error('No active architect session')
    }

    session.answers[key] = value
    await this.save(session, globalPath)
  }

  /**
   * Complete session and generate plan
   */
  async complete(globalPath: string): Promise<SessionSummary> {
    const session = await this.load(globalPath)

    if (!session || !session.active) {
      throw new Error('No active architect session')
    }

    // Generate plan MD
    await this.generatePlan(session, globalPath)

    // Mark session as complete
    session.active = false
    session.completedAt = new Date().toISOString()
    await this.save(session, globalPath)

    return this.buildSummary(session)
  }

  /**
   * Generate architect plan MD file
   */
  async generatePlan(session: ArchitectSessionData, globalPath: string): Promise<void> {
    const plan = this.buildPlanMarkdown(session)

    const planPath = path.join(globalPath, 'planning', 'architect-session.md')
    await fs.writeFile(planPath, plan)
  }

  /**
   * Build plan markdown content
   */
  buildPlanMarkdown(session: ArchitectSessionData): string {
    const { projectType, idea, conversation, answers } = session

    // Build conversation log
    const conversationLog = conversation
      .map((qa, i) => `### Q${i + 1}: ${qa.question}\n**A**: ${qa.answer}\n\n_${qa.timestamp}_`)
      .join('\n\n')

    // Build stack summary from answers
    const stackSummary = this.buildStackSummary(answers)

    // Build Context7 queries
    const context7Queries = this.buildContext7Queries(answers)

    // Build implementation steps
    const steps = this.buildImplementationSteps(session)

    return `# ARCHITECT SESSION: ${idea}

## Project Idea
${idea}

## Project Type
${projectType}

## Discovery Conversation

${conversationLog}

## Architecture Summary

**Stack:**
${stackSummary}

## Implementation Plan

**Context7 Queries:**
${context7Queries.map((q) => `- "${q}"`).join('\n')}

**Implementation Steps:**
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Execution

This plan is ready to be executed.

**To generate code:**
\`\`\`
/p:architect execute
\`\`\`

The agent will:
1. Read this architectural plan
2. Use Context7 to fetch official documentation
3. Generate project structure following best practices
4. Create starter files with boilerplate code

---
Generated: ${new Date().toISOString()}
`
  }

  /**
   * Build stack summary from answers
   */
  buildStackSummary(answers: Record<string, string>): string {
    const parts: string[] = []

    for (const [key, value] of Object.entries(answers)) {
      if (value && value !== 'Ninguna' && value !== 'None' && value !== 'Otro') {
        parts.push(`- **${key}**: ${value}`)
      }
    }

    return parts.length > 0 ? parts.join('\n') : '- To be determined during implementation'
  }

  /**
   * Build Context7 queries from answers
   */
  buildContext7Queries(answers: Record<string, string>): string[] {
    const queries: string[] = []

    if (answers.framework) {
      queries.push(`${answers.framework} getting started`)
      queries.push(`${answers.framework} project structure`)
    }

    if (answers.language && answers.framework) {
      queries.push(`${answers.language} ${answers.framework} best practices`)
    }

    if (answers.database && answers.language) {
      queries.push(`${answers.database} ${answers.language} integration`)
    }

    if (answers.auth) {
      queries.push(`${answers.auth} implementation ${answers.language || ''}`.trim())
    }

    // Always include general queries if specific ones not available
    if (queries.length === 0 && answers.language) {
      queries.push(`${answers.language} project structure`)
      queries.push(`${answers.language} best practices`)
    }

    return queries
  }

  /**
   * Build implementation steps from session
   */
  buildImplementationSteps(session: ArchitectSessionData): string[] {
    const { answers } = session
    const steps: string[] = []

    // Generic steps - Claude will refine during execution
    if (answers.language) {
      steps.push(`Initialize ${answers.language} project`)
    }

    if (answers.framework) {
      steps.push(`Setup ${answers.framework}`)
    }

    if (answers.database) {
      steps.push(`Configure ${answers.database}`)
    }

    if (answers.auth) {
      steps.push(`Implement ${answers.auth}`)
    }

    steps.push('Create project structure')
    steps.push('Generate starter files')

    if (answers.deployment) {
      steps.push(`Setup ${answers.deployment} configuration`)
    }

    return steps
  }

  /**
   * Build summary of session
   */
  buildSummary(session: ArchitectSessionData): SessionSummary {
    return {
      idea: session.idea,
      projectType: session.projectType,
      conversationLength: session.conversation.length,
      insights: Object.keys(session.answers).length,
      startedAt: session.startedAt,
      completedAt: session.completedAt || new Date().toISOString(),
    }
  }

  /**
   * Clear architect session
   */
  async clear(globalPath: string): Promise<void> {
    try {
      const sessionPath = path.join(globalPath, 'planning', 'architect-session.json')
      await fs.unlink(sessionPath)
    } catch {
      // Ignore if doesn't exist
    }
  }
}

const architectSession = new ArchitectSession()
export default architectSession
export { ArchitectSession }
