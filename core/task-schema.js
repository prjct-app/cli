/**
 * Task Metadata Schema and Agent Types
 *
 * Defines the structure for task tracking with agent assignment,
 * time estimation, and complexity scoring.
 *
 * @version 0.6.0
 */

/**
 * Agent Types - Technical specialists for task assignment
 */
const AGENT_TYPES = {
  'backend-architect': {
    name: 'Backend Architect',
    specialization: 'Server-side architecture, APIs, databases',
    keywords: ['api', 'backend', 'server', 'database', 'endpoint', 'migration', 'schema'],
    icon: '🏗️',
    estimatedEfficiency: 1.0, // baseline
  },
  'frontend-developer': {
    name: 'Frontend Developer',
    specialization: 'UI/UX, components, responsive design',
    keywords: ['ui', 'frontend', 'component', 'design', 'layout', 'responsive', 'css', 'style'],
    icon: '🎨',
    estimatedEfficiency: 1.0,
  },
  'fullstack-engineer': {
    name: 'Fullstack Engineer',
    specialization: 'End-to-end feature development',
    keywords: ['fullstack', 'feature', 'integration', 'end-to-end', 'complete'],
    icon: '⚡',
    estimatedEfficiency: 0.9, // slightly slower due to context switching
  },
  'devops-specialist': {
    name: 'DevOps Specialist',
    specialization: 'CI/CD, deployment, infrastructure',
    keywords: ['deploy', 'ci/cd', 'docker', 'kubernetes', 'infrastructure', 'pipeline', 'build'],
    icon: '🚀',
    estimatedEfficiency: 1.1, // faster at automation
  },
  'security-engineer': {
    name: 'Security Engineer',
    specialization: 'Authentication, authorization, security',
    keywords: [
      'auth',
      'security',
      'authentication',
      'authorization',
      'encryption',
      'jwt',
      'oauth',
    ],
    icon: '🔒',
    estimatedEfficiency: 0.8, // slower due to thorough security review
  },
  'data-engineer': {
    name: 'Data Engineer',
    specialization: 'Data processing, analytics, ETL',
    keywords: ['data', 'analytics', 'etl', 'pipeline', 'processing', 'warehouse', 'query'],
    icon: '📊',
    estimatedEfficiency: 0.9,
  },
  'qa-engineer': {
    name: 'QA Engineer',
    specialization: 'Testing, quality assurance, automation',
    keywords: ['test', 'testing', 'qa', 'quality', 'automation', 'e2e', 'integration'],
    icon: '🧪',
    estimatedEfficiency: 1.0,
  },
  'performance-engineer': {
    name: 'Performance Engineer',
    specialization: 'Optimization, scaling, performance',
    keywords: ['performance', 'optimize', 'scaling', 'cache', 'speed', 'bottleneck'],
    icon: '⚡',
    estimatedEfficiency: 0.85, // slower due to profiling and measurement
  },
  'general-developer': {
    name: 'General Developer',
    specialization: 'General-purpose development',
    keywords: ['fix', 'update', 'improve', 'refactor', 'cleanup'],
    icon: '👨‍💻',
    estimatedEfficiency: 1.0,
  },
}

/**
 * Complexity Levels
 */
const COMPLEXITY = {
  trivial: {
    level: 1,
    name: 'Trivial',
    description: 'Simple changes, typos, configuration',
    estimatedHours: 0.5,
    multiplier: 0.5,
    examples: ['Fix typo', 'Update config value', 'Change color'],
  },
  simple: {
    level: 2,
    name: 'Simple',
    description: 'Straightforward implementation, single file',
    estimatedHours: 2,
    multiplier: 1.0,
    examples: ['Add validation', 'Create simple component', 'Update documentation'],
  },
  moderate: {
    level: 3,
    name: 'Moderate',
    description: 'Multiple files, some complexity',
    estimatedHours: 4,
    multiplier: 2.0,
    examples: ['Implement new feature', 'Refactor module', 'Add API endpoint'],
  },
  complex: {
    level: 4,
    name: 'Complex',
    description: 'System-wide changes, architecture',
    estimatedHours: 8,
    multiplier: 4.0,
    examples: ['Authentication system', 'Database migration', 'Performance optimization'],
  },
  epic: {
    level: 5,
    name: 'Epic',
    description: 'Major feature, multiple systems',
    estimatedHours: 16,
    multiplier: 8.0,
    examples: ['Payment integration', 'Real-time messaging', 'Admin dashboard'],
  },
}

/**
 * Task Status
 */
const TASK_STATUS = {
  pending: 'Waiting to start',
  active: 'Currently working on',
  blocked: 'Blocked by dependency',
  completed: 'Successfully finished',
  cancelled: 'Cancelled/discarded',
}

/**
 * Task Schema
 */
class TaskSchema {
  /**
   * Create a new task
   */
  static create(data) {
    const now = new Date().toISOString()

    return {
      id: data.id || this.generateId(),
      title: data.title,
      description: data.description || null,

      // Agent & Developer
      assignedAgent: data.assignedAgent || this.detectAgent(data.title),
      githubDev: data.githubDev || null, // Will be populated from git config

      // Complexity & Time
      complexity: data.complexity || this.estimateComplexity(data.title, data.description),
      estimatedTime: data.estimatedTime || this.estimateTime(data.complexity),
      actualTime: null,

      // Status & Tracking
      status: data.status || 'pending',
      priority: data.priority || 5,
      blocked: data.blocked || false,
      blockedBy: data.blockedBy || null,

      // Timestamps
      createdAt: data.createdAt || now,
      startedAt: data.startedAt || null,
      completedAt: data.completedAt || null,

      // Metadata
      tags: data.tags || [],
      notes: data.notes || null,
    }
  }

  /**
   * Generate unique task ID
   */
  static generateId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Auto-detect appropriate agent based on task description
   */
  static detectAgent(title, description = '') {
    const text = `${title} ${description}`.toLowerCase()
    let bestMatch = 'general-developer'
    let highestScore = 0

    for (const [agentType, config] of Object.entries(AGENT_TYPES)) {
      const score = config.keywords.filter((keyword) => text.includes(keyword)).length

      if (score > highestScore) {
        highestScore = score
        bestMatch = agentType
      }
    }

    return bestMatch
  }

  /**
   * Estimate complexity based on keywords and description
   */
  static estimateComplexity(title, description = '') {
    const text = `${title} ${description}`.toLowerCase()

    // Epic indicators
    if (
      text.match(
        /system|payment|real-time|dashboard|integration|authentication|migration|architecture/i,
      )
    ) {
      return 'epic'
    }

    // Complex indicators
    if (text.match(/refactor|optimization|security|database|multiple|complex/i)) {
      return 'complex'
    }

    // Moderate indicators
    if (text.match(/feature|implement|api|endpoint|component|module/i)) {
      return 'moderate'
    }

    // Simple indicators
    if (text.match(/add|update|fix|change|simple|small/i)) {
      return 'simple'
    }

    // Trivial indicators
    if (text.match(/typo|config|color|text|minor|tiny/i)) {
      return 'trivial'
    }

    return 'simple' // default
  }

  /**
   * Estimate time based on complexity and agent efficiency
   */
  static estimateTime(complexity, agentType = 'general-developer') {
    const complexityData = COMPLEXITY[complexity]
    const agentData = AGENT_TYPES[agentType]

    if (!complexityData || !agentData) {
      return '2-4 hours'
    }

    const baseHours = complexityData.estimatedHours
    const adjustedHours = baseHours * agentData.estimatedEfficiency

    // Format as range
    const low = Math.floor(adjustedHours * 0.75)
    const high = Math.ceil(adjustedHours * 1.25)

    if (adjustedHours < 1) {
      return `${Math.round(adjustedHours * 60)} minutes`
    }

    return `${low}-${high} hours`
  }

  /**
   * Start a task (move to active)
   */
  static start(task) {
    return {
      ...task,
      status: 'active',
      startedAt: new Date().toISOString(),
    }
  }

  /**
   * Complete a task
   */
  static complete(task) {
    const completedAt = new Date().toISOString()
    const actualTime = this.calculateActualTime(task.startedAt, completedAt)

    return {
      ...task,
      status: 'completed',
      completedAt,
      actualTime,
    }
  }

  /**
   * Calculate actual time spent
   */
  static calculateActualTime(startedAt, completedAt) {
    if (!startedAt) return null

    const start = new Date(startedAt)
    const end = new Date(completedAt)
    const diffMs = end - start
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours === 0) {
      return `${minutes}m`
    }
    return `${hours}h ${minutes}m`
  }

  /**
   * Validate task schema
   */
  static validate(task) {
    const errors = []

    if (!task.title) errors.push('Task title is required')
    if (!AGENT_TYPES[task.assignedAgent]) errors.push('Invalid agent type')
    if (!COMPLEXITY[task.complexity]) errors.push('Invalid complexity level')
    if (!TASK_STATUS[task.status]) errors.push('Invalid task status')

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

module.exports = {
  TaskSchema,
  AGENT_TYPES,
  COMPLEXITY,
  TASK_STATUS,
}
