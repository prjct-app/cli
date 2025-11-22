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

class MandatoryAgentRouter {
  constructor() {
    this.agentGenerator = new AgentGenerator();
    this.agentCache = new Map();
    this.usageLog = [];
  }

  /**
   * Main entry point - ALL tasks MUST go through here
   * @throws {Error} If no agent can be assigned
   */
  async executeTask(task, context, projectPath) {
    // STEP 1: Analyze task to determine required expertise
    const taskAnalysis = this.analyzeTask(task);

    // STEP 2: Select or generate specialized agent (MANDATORY)
    const agent = await this.assignAgent(taskAnalysis, context);

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

    // STEP 5: Log agent usage for tracking
    this.logAgentUsage(task, agent, filteredContext);

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
   */
  analyzeTask(task) {
    const description = task.description?.toLowerCase() || '';
    const type = task.type?.toLowerCase() || '';

    // Keywords for different domains
    const patterns = {
      frontend: [
        'component', 'ui', 'react', 'vue', 'angular', 'style',
        'css', 'layout', 'responsive', 'user interface', 'frontend'
      ],
      backend: [
        'api', 'server', 'endpoint', 'route', 'middleware',
        'auth', 'authentication', 'jwt', 'session', 'backend'
      ],
      database: [
        'database', 'query', 'migration', 'schema', 'model',
        'sql', 'postgres', 'mysql', 'mongo', 'index'
      ],
      devops: [
        'deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline',
        'build', 'ship', 'release', 'production'
      ],
      qa: [
        'test', 'bug', 'error', 'fix', 'debug', 'issue',
        'quality', 'coverage', 'unit test', 'integration'
      ],
      architecture: [
        'design', 'architecture', 'pattern', 'structure',
        'refactor', 'organize', 'plan', 'feature'
      ]
    };

    // Detect primary domain
    let detectedDomain = 'generalist';
    let confidence = 0;
    let matchedKeywords = [];

    for (const [domain, keywords] of Object.entries(patterns)) {
      const matches = keywords.filter(keyword =>
        description.includes(keyword) || type.includes(keyword)
      );

      if (matches.length > confidence) {
        confidence = matches.length;
        detectedDomain = domain;
        matchedKeywords = matches;
      }
    }

    // Detect technology stack
    const techStack = this.detectTechnology(task, description);

    return {
      domain: detectedDomain,
      confidence: confidence > 0 ? (confidence / 3) : 0.3, // confidence score
      matchedKeywords,
      techStack,
      reason: `Detected ${detectedDomain} task based on: ${matchedKeywords.join(', ')}`,
      alternatives: this.getSimilarDomains(detectedDomain)
    };
  }

  /**
   * Detect specific technologies mentioned or implied
   */
  detectTechnology(task, description) {
    const technologies = {
      languages: [],
      frameworks: [],
      databases: [],
      tools: []
    };

    // Language detection
    const languages = [
      'javascript', 'typescript', 'python', 'ruby', 'go',
      'rust', 'java', 'csharp', 'php', 'elixir', 'swift'
    ];

    const frameworks = [
      'react', 'vue', 'angular', 'express', 'django', 'rails',
      'spring', 'laravel', 'phoenix', 'gin', 'fastapi', 'nextjs'
    ];

    const databases = [
      'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'dynamodb', 'firebase', 'supabase', 'sqlite'
    ];

    // Check for each technology
    languages.forEach(lang => {
      if (description.includes(lang)) {
        technologies.languages.push(lang);
      }
    });

    frameworks.forEach(fw => {
      if (description.includes(fw)) {
        technologies.frameworks.push(fw);
      }
    });

    databases.forEach(db => {
      if (description.includes(db)) {
        technologies.databases.push(db);
      }
    });

    return technologies;
  }

  /**
   * Assign the best agent for the task
   * Creates a new one if needed
   */
  async assignAgent(taskAnalysis, context) {
    const { domain, techStack } = taskAnalysis;

    // Check cache first
    const cacheKey = `${domain}-${techStack.languages.join('-')}`;
    if (this.agentCache.has(cacheKey)) {
      return this.agentCache.get(cacheKey);
    }

    // Generate specialized agent based on detection
    const agent = await this.generateSpecializedAgent(domain, techStack, context);

    // Cache for reuse
    this.agentCache.set(cacheKey, agent);

    return agent;
  }

  /**
   * Generate a specialized agent for the detected domain and tech
   */
  async generateSpecializedAgent(domain, techStack, context) {
    // Map domain to agent type
    const agentTypes = {
      frontend: 'frontend-specialist',
      backend: 'backend-specialist',
      database: 'database-specialist',
      devops: 'devops-specialist',
      qa: 'qa-specialist',
      architecture: 'architect',
      generalist: 'full-stack'
    };

    const agentType = agentTypes[domain] || 'full-stack';

    // Generate with detected technologies
    const config = {
      domain,
      techStack,
      projectContext: context.projectSummary || '',
      bestPractices: await this.getBestPractices(domain, techStack)
    };

    return this.agentGenerator.generateDynamicAgent(agentType, config);
  }

  /**
   * Get best practices for the domain and tech stack
   */
  async getBestPractices(domain, techStack) {
    const practices = [];

    // Domain-specific best practices
    const domainPractices = {
      frontend: [
        'Component composition over inheritance',
        'State management patterns',
        'Responsive design principles',
        'Accessibility standards',
        'Performance optimization (lazy loading, memoization)'
      ],
      backend: [
        'RESTful API design principles',
        'Authentication and authorization patterns',
        'Error handling and logging',
        'Rate limiting and caching',
        'Database connection pooling'
      ],
      database: [
        'Normalization principles',
        'Index optimization',
        'Query performance tuning',
        'Transaction management',
        'Backup and recovery strategies'
      ],
      devops: [
        'CI/CD pipeline best practices',
        'Container orchestration',
        'Infrastructure as Code',
        'Monitoring and alerting',
        'Security scanning'
      ],
      qa: [
        'Test pyramid (unit, integration, e2e)',
        'Test coverage standards',
        'Mocking and stubbing',
        'Performance testing',
        'Security testing'
      ]
    };

    practices.push(...(domainPractices[domain] || []));

    // Technology-specific practices
    if (techStack.languages.includes('javascript') || techStack.languages.includes('typescript')) {
      practices.push('ES6+ features', 'Async/await patterns', 'Module system');
    }

    if (techStack.frameworks.includes('react')) {
      practices.push('Hooks patterns', 'Context API', 'Component lifecycle');
    }

    if (techStack.languages.includes('ruby')) {
      practices.push('Ruby idioms', 'Metaprogramming carefully', 'Convention over configuration');
    }

    if (techStack.languages.includes('go')) {
      practices.push('Goroutines and channels', 'Error handling patterns', 'Interface design');
    }

    return practices;
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
      for (const exclude of pattern.exclude) {
        if (file.includes(exclude)) return false;
      }

      // Check if file matches include patterns
      if (pattern.include.length > 0) {
        let matches = false;
        for (const include of pattern.include) {
          if (file.includes(include)) {
            matches = true;
            break;
          }
        }
        if (!matches) return false;
      }

      // Check extensions if specified
      if (pattern.extensions.length > 0) {
        let hasValidExtension = false;
        for (const ext of pattern.extensions) {
          if (file.endsWith(ext)) {
            hasValidExtension = true;
            break;
          }
        }
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
    let maxUsage = 0;
    for (const [agent, count] of Object.entries(stats.byAgent)) {
      if (count > maxUsage) {
        maxUsage = count;
        stats.mostUsedAgent = agent;
      }
    }

    return stats;
  }
}

module.exports = MandatoryAgentRouter;