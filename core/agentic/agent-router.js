/**
 * Mandatory Agent Router
 *
 * CRITICAL: Ensures EVERY task is executed by a specialized agent
 * No task can run without an assigned expert agent
 *
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const AgentGenerator = require('../domain/agent-generator');
const configManager = require('../infrastructure/config-manager');
const TaskAnalyzer = require('../domain/task-analyzer');
const AgentMatcher = require('../domain/agent-matcher');
const SmartCache = require('../domain/smart-cache');
const AgentValidator = require('../domain/agent-validator');
const log = require('../utils/logger');

class MandatoryAgentRouter {
  constructor() {
    this.agentGenerator = null; // Will be initialized with projectId
    this.agentCache = null; // SmartCache instance
    this.usageLog = [];
    this.projectId = null;
    this.taskAnalyzer = null;
    this.agentMatcher = new AgentMatcher();
    this.agentValidator = new AgentValidator();
  }

  /**
   * Initialize with project context
   * @param {string} projectPath - Path to the project
   */
  async initialize(projectPath) {
    this.projectId = await configManager.getProjectId(projectPath);
    this.agentGenerator = new AgentGenerator(this.projectId);
    this.agentCache = new SmartCache(this.projectId);
    await this.agentCache.initialize();
    this.taskAnalyzer = new TaskAnalyzer(projectPath);
    await this.taskAnalyzer.initialize();
  }

  /**
   * Main entry point - ALL tasks MUST go through here
   * @throws {Error} If no agent can be assigned
   */
  async executeTask(task, context, projectPath) {
    // Initialize if needed
    if (!this.agentGenerator) {
      await this.initialize(projectPath);
    }

    // STEP 1: Deep semantic task analysis (NEW)
    const taskAnalysis = await this.taskAnalyzer.analyzeTask(task);

    // STEP 2: Select or generate specialized agent (MANDATORY) - with intelligent matching
    const agent = await this.assignAgent(taskAnalysis, context, projectPath);

    // STEP 3: Validate agent assignment
    if (!agent || !agent.name) {
      throw new Error(
        `CRITICAL: No agent assigned for task "${task.description}".
         System requires ALL tasks to use specialized agents.`
      );
    }

    // STEP 4: Filter context for this specific agent
    const filteredContext = await this.filterContextForAgent(
      agent,
      context,
      taskAnalysis
    );

    // STEP 5: Log agent usage for tracking and learning
    this.logAgentUsage(task, agent, filteredContext);
    this.agentMatcher.recordSuccess(agent, taskAnalysis, true); // Learn from assignment

    // STEP 6: Return agent with filtered context
    return {
      agent,
      context: filteredContext,
      taskAnalysis,
      routing: {
        reason: taskAnalysis.reason,
        confidence: taskAnalysis.confidence,
        alternativeAgents: taskAnalysis.alternatives
      }
    };
  }

  /**
   * Analyze task to determine what type of expertise is needed
   *
   * 100% AGENTIC: Delegates to TaskAnalyzer which uses templates.
   * NO hardcoded patterns or keyword lists.
   */
  async analyzeTask(task, projectPath = null) {
    // Use TaskAnalyzer for semantic analysis (template-driven)
    if (this.taskAnalyzer) {
      return await this.taskAnalyzer.analyzeTask(task);
    }

    // Fallback: Return minimal analysis, let Claude decide in prompt
    return {
      domain: 'generalist',
      confidence: 0.5,
      matchedKeywords: [],
      reason: 'Using generalist - Claude will analyze task in context',
      alternatives: ['full-stack'],
      projectTechnologies: null
    };
  }

  /**
   * Assign the best agent for the task
   * IMPROVED: Uses intelligent matching with scoring
   */
  async assignAgent(taskAnalysis, context, projectPath, overrideAgent = null) {
    // Respect override
    if (overrideAgent) {
      const existing = await this.agentGenerator.loadAgent(overrideAgent);
      if (existing) {
        return existing;
      }
      return this.generateSpecializedAgent(overrideAgent, {}, context);
    }

    const primaryDomain = taskAnalysis.primaryDomain;
    const projectTech = taskAnalysis.projectTechnologies || {};

    // Generate cache key with tech stack
    const techStack = {
      languages: projectTech.languages || [],
      frameworks: projectTech.frameworks || []
    };
    const cacheKey = this.agentCache.generateKey(this.projectId, primaryDomain, techStack);

    // Check smart cache first
    const cached = await this.agentCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // STEP 1: Load all existing agents
    const allAgents = await this.agentGenerator.loadAllAgents();

    // STEP 2: Use intelligent matching to find best agent
    const match = this.agentMatcher.findBestAgent(allAgents, taskAnalysis);

    if (match && match.score > 0.5) {
      // Good match found - use it
      await this.agentCache.set(cacheKey, match.agent);
      return match.agent;
    }

    // STEP 3: Try to load domain-specific agent
    const agentType = this.getAgentTypeForDomain(primaryDomain);
    const existingAgent = await this.agentGenerator.loadAgent(agentType);
    
    if (existingAgent) {
      await this.agentCache.set(cacheKey, existingAgent);
      return existingAgent;
    }

    // STEP 4: Validate before generating new agent
    const config = {
      domain: primaryDomain,
      projectContext: context.projectSummary || context.projectContext || '',
      expertise: this.buildExpertiseFromTech(projectTech, primaryDomain)
    };

    const validation = this.agentValidator.validateBeforeGeneration(
      agentType,
      config,
      allAgents
    );

    if (!validation.valid && validation.similarAgent) {
      // Similar agent exists - use it instead
      await this.agentCache.set(cacheKey, validation.similarAgent);
      return validation.similarAgent;
    }

    // STEP 5: Generate new agent only if validated
    const agent = await this.generateSpecializedAgent(primaryDomain, techStack, context);
    
    // Validate after generation
    const postValidation = this.agentValidator.validateAfterGeneration(agent);
    if (!postValidation.valid) {
      log.warn(`Agent validation issues: ${postValidation.issues.join(', ')}`);
    }

    // Cache for reuse
    await this.agentCache.set(cacheKey, agent);

    return agent;
  }

  /**
   * Build expertise string from tech stack
   *
   * 100% AGENTIC: No hardcoded framework lists.
   * Returns ALL tech, Claude decides what's relevant.
   */
  buildExpertiseFromTech(projectTech, domain) {
    const parts = []

    // Include ALL languages - no filtering
    if (projectTech.languages && projectTech.languages.length > 0) {
      parts.push(projectTech.languages.join(', '))
    }

    // Include ALL frameworks - Claude decides relevance
    // NO hardcoded lists like ['react', 'vue', 'angular']
    if (projectTech.frameworks && projectTech.frameworks.length > 0) {
      parts.push(projectTech.frameworks.join(', '))
    }

    // Include tools if present
    if (projectTech.tools && projectTech.tools.length > 0) {
      parts.push(projectTech.tools.join(', '))
    }

    return parts.join(', ') || `${domain} development`
  }

  /**
   * Get agent type name for a domain
   * @private
   */
  getAgentTypeForDomain(domain) {
    const agentTypes = {
      frontend: 'frontend-specialist',
      backend: 'backend-specialist',
      database: 'database-specialist',
      devops: 'devops-specialist',
      qa: 'qa-specialist',
      architecture: 'architect',
      generalist: 'full-stack'
    };
    return agentTypes[domain] || 'full-stack';
  }

  /**
   * Find similar agent from existing agents
   * DEPRECATED: Now uses AgentMatcher for intelligent matching
   * @private
   */
  findSimilarAgent(allAgents, domain, taskAnalysis) {
    // Use AgentMatcher instead
    const match = this.agentMatcher.findBestAgent(allAgents, taskAnalysis);
    return match ? match.agent : null;
  }

  /**
   * Generate a specialized agent for the detected domain
   * Only called when no existing agent is found
   */
  async generateSpecializedAgent(domain, techStack, context) {
    // Map domain to agent type
    const agentType = this.getAgentTypeForDomain(domain);

    // Generate with minimal config - let the Agent figure it out
    const config = {
      domain,
      projectContext: context.projectSummary || context.projectContext || '',
      // No hardcoded best practices passed here
    };

    // Generate the agent file
    await this.agentGenerator.generateDynamicAgent(agentType, config);
    
    // Load it immediately so we return the full agent object
    const agent = await this.agentGenerator.loadAgent(agentType);
    
    // If loading failed, return minimal object
    return agent || { name: agentType, content: '', domain };
  }

  /**
   * Filter context to only what's relevant for this agent
   *
   * 100% AGENTIC: No hardcoded directory/extension lists.
   * Only excludes universal noise (node_modules, .git, dist).
   * Claude decides relevance based on task.
   */
  async filterContextForAgent(agent, fullContext, taskAnalysis) {
    // Universal exclusions that apply to ALL projects
    const universalExclusions = ['node_modules', '.git', 'dist', 'build', '.next', 'target', 'vendor'];

    // Filter only universal noise - let Claude decide the rest
    const filtered = {
      ...fullContext,
      files: (fullContext.files || []).filter(file =>
        !universalExclusions.some(exc => file.includes(exc))
      ),
      relevantOnly: false, // Claude decides relevance, not us
      filterApplied: 'universal-only'
    };

    return filtered;
  }

  /**
   * Filter files based on patterns
   */
  filterFiles(files, pattern) {
    return files.filter(file => {
      // Check if file should be excluded
      const isExcluded = pattern.exclude.some(exclude => file.includes(exclude));
      if (isExcluded) return false;

      // Check if file matches include patterns
      if (pattern.include.length > 0) {
        const isIncluded = pattern.include.some(include => file.includes(include));
        if (!isIncluded) return false;
      }

      // Check extensions if specified
      if (pattern.extensions.length > 0) {
        const hasValidExtension = pattern.extensions.some(ext => file.endsWith(ext));
        if (!hasValidExtension) return false;
      }

      return true;
    });
  }

  /**
   * Log agent usage for metrics and optimization
   */
  logAgentUsage(task, agent, context) {
    const usage = {
      timestamp: new Date().toISOString(),
      task: task.description,
      agent: agent.name,
      domain: agent.domain || 'unknown',
      contextSize: context.files?.length || 0,
      contextReduction: this.calculateContextReduction(context),
      confidence: agent.confidence || 1.0
    };

    this.usageLog.push(usage);

    // Also append to a log file for persistence
    this.appendToLogFile(usage);

    return usage;
  }

  /**
   * Calculate how much context was reduced
   */
  calculateContextReduction(filteredContext) {
    // This would compare against full context
    // For now, estimate based on filtering
    if (filteredContext.relevantOnly) {
      return '70-90%'; // Typical reduction when filtering
    }
    return '0%';
  }

  /**
   * Append usage to log file
   */
  async appendToLogFile(usage) {
    try {
      const logPath = path.join(
        process.env.HOME,
        '.prjct-cli',
        'agent-usage.jsonl'
      );

      const logEntry = JSON.stringify(usage) + '\n';
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      log.error('Failed to log agent usage:', error.message);
    }
  }

  /**
   * Get similar domains for fallback
   *
   * 100% AGENTIC: Returns generic fallback.
   * Claude determines domain relationships based on context.
   */
  getSimilarDomains(domain) {
    // No hardcoded domain relationships
    // Claude decides what's similar based on actual project context
    return ['full-stack', 'generalist'];
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    const stats = {
      totalTasks: this.usageLog.length,
      byAgent: {},
      avgContextReduction: '0%',
      mostUsedAgent: null
    };

    // Calculate stats from usage log
    this.usageLog.forEach(log => {
      stats.byAgent[log.agent] = (stats.byAgent[log.agent] || 0) + 1;
    });

    // Find most used agent
    const mostUsed = Object.entries(stats.byAgent).reduce((max, [agent, count]) => {
      return count > max.count ? { agent, count } : max;
    }, { agent: null, count: 0 });

    stats.mostUsedAgent = mostUsed.agent;

    return stats;
  }
}

module.exports = MandatoryAgentRouter;