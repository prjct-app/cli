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
   * DEPRECATED: Now uses TaskAnalyzer for deep semantic analysis
   * Kept for backward compatibility
   */
  async analyzeTask(task, projectPath = null) {
    const description = task.description?.toLowerCase() || '';
    const type = task.type?.toLowerCase() || '';

    // Get project technologies for better matching
    let projectTech = null
    if (projectPath) {
      try {
        const TechDetector = require('../domain/tech-detector');
        const detector = new TechDetector(projectPath);
        projectTech = await detector.detectAll();
      } catch (error) {
        // If detection fails, continue with keyword-based analysis
      }
    }

    // Semantic patterns - broader, more flexible
    const patterns = {
      frontend: [
        'component', 'ui', 'user interface', 'frontend', 'client',
        'style', 'css', 'layout', 'responsive', 'design',
        'page', 'view', 'template', 'render', 'display'
      ],
      backend: [
        'api', 'server', 'endpoint', 'route', 'middleware',
        'auth', 'authentication', 'authorization', 'jwt', 'session',
        'backend', 'service', 'controller', 'handler'
      ],
      database: [
        'database', 'db', 'query', 'migration', 'schema', 'model',
        'sql', 'data', 'table', 'collection', 'index', 'relation'
      ],
      devops: [
        'deploy', 'deployment', 'docker', 'kubernetes', 'k8s',
        'ci/cd', 'pipeline', 'build', 'ship', 'release',
        'production', 'infrastructure', 'container', 'orchestration'
      ],
      qa: [
        'test', 'testing', 'bug', 'error', 'fix', 'debug', 'issue',
        'quality', 'coverage', 'unit test', 'integration test',
        'e2e', 'spec', 'assertion', 'validation'
      ],
      architecture: [
        'design', 'architecture', 'pattern', 'structure',
        'refactor', 'refactoring', 'organize', 'plan',
        'feature', 'system', 'module', 'component design'
      ]
    };

    // If we have project tech, enhance patterns with actual technologies
    if (projectTech) {
      // Add detected frontend frameworks to frontend patterns
      const frontendTech = [
        ...projectTech.frameworks.filter(f => ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'].includes(f.toLowerCase())),
        ...projectTech.buildTools.filter(t => ['vite', 'webpack'].includes(t.toLowerCase()))
      ];
      if (frontendTech.length > 0) {
        patterns.frontend.push(...frontendTech.map(t => t.toLowerCase()));
      }

      // Add detected backend frameworks to backend patterns
      const backendTech = projectTech.frameworks.filter(f => 
        ['express', 'fastify', 'django', 'flask', 'rails', 'phoenix'].includes(f.toLowerCase())
      );
      if (backendTech.length > 0) {
        patterns.backend.push(...backendTech.map(t => t.toLowerCase()));
      }
    }

    // Detect primary domain
    const { detectedDomain, matchedKeywords, confidence } = this.detectDomain(description, type, patterns);

    return {
      domain: detectedDomain,
      confidence: confidence > 0 ? Math.min(confidence / 3, 1.0) : 0.3,
      matchedKeywords,
      reason: `Detected ${detectedDomain} task based on: ${matchedKeywords.join(', ')}`,
      alternatives: this.getSimilarDomains(detectedDomain),
      projectTechnologies: projectTech
    };
  }

  /**
   * Detect domain based on patterns
   */
  detectDomain(description, type, patterns) {
    // Simple domain detection based on keywords
    const matches = Object.entries(patterns).map(([domain, keywords]) => {
      const found = keywords.filter(keyword =>
        description.includes(keyword) || type.includes(keyword)
      );
      return { domain, keywords: found, count: found.length };
    });

    // Sort by count descending
    const sorted = matches.sort((a, b) => b.count - a.count);
    const bestMatch = sorted[0];

    if (bestMatch && bestMatch.count > 0) {
      return {
        detectedDomain: bestMatch.domain,
        matchedKeywords: bestMatch.keywords,
        confidence: bestMatch.count
      };
    }

    return {
      detectedDomain: 'generalist',
      matchedKeywords: [],
      confidence: 0.5
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
      console.warn(`⚠️  Agent validation issues: ${postValidation.issues.join(', ')}`);
    }

    // Cache for reuse
    await this.agentCache.set(cacheKey, agent);

    return agent;
  }

  /**
   * Build expertise string from tech stack
   */
  buildExpertiseFromTech(projectTech, domain) {
    const parts = []

    if (projectTech.languages && projectTech.languages.length > 0) {
      parts.push(projectTech.languages.join(', '))
    }

    if (projectTech.frameworks && projectTech.frameworks.length > 0) {
      const relevantFrameworks = projectTech.frameworks.filter(f => {
        const fLower = f.toLowerCase()
        if (domain === 'frontend') {
          return ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'].some(tech => fLower.includes(tech))
        }
        if (domain === 'backend') {
          return ['express', 'fastify', 'django', 'flask', 'rails', 'phoenix'].some(tech => fLower.includes(tech))
        }
        return true
      })
      if (relevantFrameworks.length > 0) {
        parts.push(relevantFrameworks.join(', '))
      }
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
   */
  async filterContextForAgent(agent, fullContext, taskAnalysis) {
    const { domain } = taskAnalysis;

    // Define what each agent type should see
    const contextPatterns = {
      frontend: {
        include: ['components', 'views', 'styles', 'pages', 'layouts'],
        exclude: ['node_modules', 'dist', 'build', 'migrations'],
        extensions: ['.jsx', '.tsx', '.vue', '.css', '.scss', '.styled.js']
      },
      backend: {
        include: ['routes', 'controllers', 'services', 'middleware', 'api'],
        exclude: ['node_modules', 'dist', 'public', 'styles'],
        extensions: ['.js', '.ts', '.py', '.rb', '.go', '.java']
      },
      database: {
        include: ['models', 'migrations', 'schemas', 'seeds', 'queries'],
        exclude: ['node_modules', 'public', 'styles', 'components'],
        extensions: ['.sql', '.js', '.ts', '.rb', '.py']
      },
      devops: {
        include: ['.github', '.gitlab', 'docker', 'k8s', 'terraform'],
        exclude: ['node_modules', 'src', 'public'],
        extensions: ['.yml', '.yaml', '.dockerfile', '.sh', '.tf']
      },
      qa: {
        include: ['tests', 'spec', '__tests__', 'test'],
        exclude: ['node_modules', 'dist', 'build'],
        extensions: ['.test.js', '.spec.js', '.test.ts', '.spec.ts']
      }
    };

    const pattern = contextPatterns[domain] || {
      include: [],
      exclude: ['node_modules', 'dist', 'build'],
      extensions: []
    };

    // Filter the context based on patterns
    const filtered = {
      ...fullContext,
      files: this.filterFiles(fullContext.files || [], pattern),
      relevantOnly: true,
      filterApplied: domain
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
      // Log errors silently, don't break execution
      console.error('Failed to log agent usage:', error.message);
    }
  }

  /**
   * Get similar domains for fallback
   */
  getSimilarDomains(domain) {
    const similarities = {
      frontend: ['fullstack', 'ui/ux'],
      backend: ['fullstack', 'api', 'services'],
      database: ['backend', 'data'],
      devops: ['infrastructure', 'platform'],
      qa: ['testing', 'quality'],
      architecture: ['design', 'planning']
    };

    return similarities[domain] || ['generalist'];
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