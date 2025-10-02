const fs = require('fs').promises
const path = require('path')
const os = require('os')

/**
 * AgentGenerator - Dynamic agent generation for prjct-cli
 *
 * Generates specialized AI agents based on project analysis,
 * customizing them with project-specific context and requirements.
 *
 * @version 0.5.0
 */
class AgentGenerator {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates', 'agents')
    this.outputDir = path.join(os.homedir(), '.claude', 'agents')

    // Base agents (always generated)
    this.baseAgents = ['pm', 'ux', 'fe', 'be', 'qa', 'scribe']

    // Agent colors for visual distinction
    this.agentColors = {
      pm: 'cyan',
      ux: 'purple',
      fe: 'orange',
      be: 'yellow',
      qa: 'green',
      scribe: 'blue',
      devops: 'red',
      security: 'magenta',
      mobile: 'pink',
      data: 'teal',
    }
  }

  /**
   * Generate all agents for a project
   * @param {Object} projectAnalysis - Analysis result from /p:analyze
   * @returns {Promise<Array>} List of generated agent types
   */
  async generateAll(projectAnalysis) {
    console.log('\n🤖 Generating AI agents...\n')

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true })

    // Detect which agents to generate
    const conditionalAgents = this.detectConditionalAgents(projectAnalysis)
    const allAgents = [...this.baseAgents, ...conditionalAgents]

    // Generate each agent
    const generated = []
    for (const agentType of allAgents) {
      try {
        await this.generateAgent(agentType, projectAnalysis)
        generated.push(agentType)
        console.log(`   ✅ ${agentType.toUpperCase()} agent created`)
      } catch (error) {
        console.error(`   ❌ Failed to create ${agentType} agent:`, error.message)
      }
    }

    console.log(`\n✨ Generated ${generated.length} agents\n`)

    return generated
  }

  /**
   * Detect which conditional agents should be generated
   * @param {Object} analysis - Project analysis
   * @returns {Array<string>} List of conditional agent types
   */
  detectConditionalAgents(analysis) {
    const agents = []

    // Security agent for web apps or apps with auth
    if (
      analysis.type === 'web' ||
      analysis.isWebApp ||
      analysis.hasAuth ||
      analysis.hasAPI
    ) {
      agents.push('security')
    }

    // DevOps agent for projects with Docker/K8s/CI
    if (
      analysis.hasDocker ||
      analysis.hasKubernetes ||
      analysis.hasCI ||
      analysis.hasDeployment
    ) {
      agents.push('devops')
    }

    // Mobile agent for React Native/Flutter/mobile frameworks
    if (
      analysis.isMobile ||
      analysis.frameworks?.some(f =>
        ['react-native', 'flutter', 'ionic', 'expo'].includes(
          f.toLowerCase(),
        ),
      )
    ) {
      agents.push('mobile')
    }

    // Data Science agent for ML/data projects
    if (
      analysis.hasML ||
      analysis.hasDataScience ||
      analysis.dependencies?.some(d =>
        [
          'tensorflow',
          'pytorch',
          'scikit-learn',
          'pandas',
          'numpy',
          'jupyter',
        ].includes(d.toLowerCase()),
      )
    ) {
      agents.push('data')
    }

    return agents
  }

  /**
   * Generate a single agent file
   * @param {string} type - Agent type (pm, fe, be, etc.)
   * @param {Object} analysis - Project analysis
   * @returns {Promise<void>}
   */
  async generateAgent(type, analysis) {
    // Load template
    const templatePath = path.join(this.templatesDir, `${type}.template.md`)
    let template

    try {
      template = await fs.readFile(templatePath, 'utf-8')
    } catch (error) {
      throw new Error(`Template not found for ${type} agent`)
    }

    // Replace placeholders
    let content = this.replacePlaceholders(template, analysis)

    // Add project-specific context
    content += this.generateProjectContext(type, analysis)

    // Write agent file
    const outputPath = path.join(this.outputDir, `p_agent_${type}.md`)
    await fs.writeFile(outputPath, content, 'utf-8')
  }

  /**
   * Replace template placeholders with actual values
   * @param {string} template - Template content
   * @param {Object} analysis - Project analysis
   * @returns {string} Processed template
   */
  replacePlaceholders(template, analysis) {
    const replacements = {
      PROJECT_NAME: analysis.name || 'Unknown Project',
      DETECTED_STACK: this.formatStack(analysis),
      DETECTED_PATTERN: analysis.architecture || 'Not detected',
      DETECTED_ENTRY: analysis.entryPoint || 'Not detected',
      PROJECT_TYPE: analysis.type || 'application',
      PRIMARY_LANGUAGE: analysis.primaryLanguage || 'JavaScript',
      FRAMEWORK: this.formatFrameworks(analysis.frameworks),
    }

    let content = template

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\[${key}\\]`, 'g')
      content = content.replace(regex, value)
    }

    return content
  }

  /**
   * Format stack information for display
   * @param {Object} analysis - Project analysis
   * @returns {string} Formatted stack string
   */
  formatStack(analysis) {
    const parts = []

    if (analysis.primaryLanguage) {
      parts.push(analysis.primaryLanguage)
    }

    if (analysis.frameworks && analysis.frameworks.length > 0) {
      parts.push(...analysis.frameworks.slice(0, 3))
    }

    if (analysis.tools && analysis.tools.length > 0) {
      parts.push(...analysis.tools.slice(0, 2))
    }

    return parts.length > 0 ? parts.join(' + ') : 'Not detected'
  }

  /**
   * Format frameworks list
   * @param {Array} frameworks - List of frameworks
   * @returns {string} Formatted string
   */
  formatFrameworks(frameworks) {
    if (!frameworks || frameworks.length === 0) {
      return 'None detected'
    }
    return frameworks.join(', ')
  }

  /**
   * Generate project-specific context section
   * @param {string} type - Agent type
   * @param {Object} analysis - Project analysis
   * @returns {string} Context markdown
   */
  generateProjectContext(type, analysis) {
    let context = '\n\n## Project-Specific Context\n\n'

    switch (type) {
      case 'fe':
        context += this.generateFrontendContext(analysis)
        break
      case 'be':
        context += this.generateBackendContext(analysis)
        break
      case 'ux':
        context += this.generateUXContext(analysis)
        break
      case 'qa':
        context += this.generateQAContext(analysis)
        break
      case 'devops':
        context += this.generateDevOpsContext(analysis)
        break
      case 'security':
        context += this.generateSecurityContext(analysis)
        break
      default:
        context += this.generateGenericContext(analysis)
    }

    return context
  }

  /**
   * Generate frontend-specific context
   */
  generateFrontendContext(analysis) {
    const context = []

    if (analysis.frontend) {
      const fe = analysis.frontend

      if (fe.framework) {
        context.push(`- **Framework**: ${fe.framework}${fe.version ? ` ${fe.version}` : ''}`)
      }

      if (fe.stateManagement) {
        context.push(`- **State Management**: ${fe.stateManagement}`)
      }

      if (fe.routing) {
        context.push(`- **Routing**: ${fe.routing}`)
      }

      if (fe.styling) {
        context.push(`- **Styling**: ${fe.styling}`)
      }

      if (fe.buildTool) {
        context.push(`- **Build Tool**: ${fe.buildTool}`)
      }

      if (fe.componentPattern) {
        context.push(`- **Component Pattern**: ${fe.componentPattern}`)
      }
    }

    if (analysis.directories?.components) {
      context.push(`- **Components Location**: ${analysis.directories.components}`)
    }

    return context.length > 0 ? context.join('\n') : '- No specific frontend context detected'
  }

  /**
   * Generate backend-specific context
   */
  generateBackendContext(analysis) {
    const context = []

    if (analysis.backend) {
      const be = analysis.backend

      if (be.framework) {
        context.push(`- **Framework**: ${be.framework}${be.version ? ` ${be.version}` : ''}`)
      }

      if (be.database) {
        context.push(`- **Database**: ${be.database}`)
      }

      if (be.orm) {
        context.push(`- **ORM/ODM**: ${be.orm}`)
      }

      if (be.auth) {
        context.push(`- **Authentication**: ${be.auth}`)
      }

      if (be.apiStyle) {
        context.push(`- **API Style**: ${be.apiStyle}`)
      }
    }

    if (analysis.hasAPI) {
      context.push(`- **API Detected**: Yes`)
    }

    return context.length > 0 ? context.join('\n') : '- No specific backend context detected'
  }

  /**
   * Generate UX-specific context
   */
  generateUXContext(analysis) {
    const context = []

    if (analysis.frontend?.styling) {
      context.push(`- **Design System**: ${analysis.frontend.styling}`)
    }

    if (analysis.hasDesignSystem) {
      context.push(`- **Design System Files**: Detected`)
    }

    if (analysis.accessibility) {
      context.push(`- **Accessibility**: ${analysis.accessibility}`)
    }

    context.push(`- **Focus**: User experience, visual design, interaction patterns`)

    return context.join('\n')
  }

  /**
   * Generate QA-specific context
   */
  generateQAContext(analysis) {
    const context = []

    if (analysis.testing) {
      if (analysis.testing.framework) {
        context.push(`- **Test Framework**: ${analysis.testing.framework}`)
      }

      if (analysis.testing.coverage) {
        context.push(`- **Coverage Tool**: ${analysis.testing.coverage}`)
      }

      if (analysis.testing.e2e) {
        context.push(`- **E2E Testing**: ${analysis.testing.e2e}`)
      }
    }

    if (analysis.hasTests) {
      context.push(`- **Tests Detected**: Yes`)
    }

    return context.length > 0 ? context.join('\n') : '- No specific testing context detected'
  }

  /**
   * Generate DevOps-specific context
   */
  generateDevOpsContext(analysis) {
    const context = []

    if (analysis.hasDocker) {
      context.push(`- **Docker**: Detected (Dockerfile, docker-compose)`)
    }

    if (analysis.hasKubernetes) {
      context.push(`- **Kubernetes**: Detected`)
    }

    if (analysis.hasCI) {
      context.push(`- **CI/CD**: ${analysis.ciProvider || 'Detected'}`)
    }

    if (analysis.deployment) {
      context.push(`- **Deployment**: ${analysis.deployment}`)
    }

    return context.length > 0 ? context.join('\n') : '- Infrastructure and deployment files detected'
  }

  /**
   * Generate security-specific context
   */
  generateSecurityContext(analysis) {
    const context = []

    if (analysis.hasAuth) {
      context.push(`- **Authentication**: Detected`)
    }

    if (analysis.hasAPI) {
      context.push(`- **API Security**: Focus on endpoint security`)
    }

    if (analysis.type === 'web' || analysis.isWebApp) {
      context.push(`- **Web Security**: OWASP Top 10 compliance`)
    }

    context.push(`- **Focus**: Security audits, vulnerability assessment, secure coding practices`)

    return context.join('\n')
  }

  /**
   * Generate generic project context
   */
  generateGenericContext(analysis) {
    const context = []

    if (analysis.description) {
      context.push(`- **Description**: ${analysis.description}`)
    }

    if (analysis.mainDirectories && analysis.mainDirectories.length > 0) {
      context.push(`- **Main Directories**: ${analysis.mainDirectories.join(', ')}`)
    }

    if (analysis.totalFiles) {
      context.push(`- **Total Files**: ${analysis.totalFiles}`)
    }

    return context.length > 0 ? context.join('\n') : '- Standard project setup'
  }

  /**
   * Update existing agents with new project context
   * @param {Object} analysis - Updated project analysis
   * @returns {Promise<Array>} List of updated agents
   */
  async updateExistingAgents(analysis) {
    console.log('\n🔄 Updating existing agents...\n')

    const updated = []

    // Check which agents currently exist
    try {
      const files = await fs.readdir(this.outputDir)
      const agentFiles = files.filter(f => f.startsWith('p_agent_') && f.endsWith('.md'))

      for (const file of agentFiles) {
        const type = file.replace('p_agent_', '').replace('.md', '')

        try {
          await this.generateAgent(type, analysis)
          updated.push(type)
          console.log(`   ↻ ${type.toUpperCase()} agent updated`)
        } catch (error) {
          console.error(`   ❌ Failed to update ${type} agent:`, error.message)
        }
      }
    } catch (error) {
      console.error('Error reading agents directory:', error.message)
    }

    console.log(`\n✨ Updated ${updated.length} agents\n`)

    return updated
  }

  /**
   * Remove agents that are no longer needed
   * @param {Array} requiredAgents - List of agents that should exist
   * @returns {Promise<Array>} List of removed agents
   */
  async cleanupObsoleteAgents(requiredAgents) {
    const removed = []

    try {
      const files = await fs.readdir(this.outputDir)
      const agentFiles = files.filter(f => f.startsWith('p_agent_') && f.endsWith('.md'))

      for (const file of agentFiles) {
        const type = file.replace('p_agent_', '').replace('.md', '')

        if (!requiredAgents.includes(type)) {
          const filePath = path.join(this.outputDir, file)
          await fs.unlink(filePath)
          removed.push(type)
          console.log(`   🗑️  ${type.toUpperCase()} agent removed (no longer needed)`)
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error.message)
    }

    return removed
  }
}

module.exports = new AgentGenerator()
