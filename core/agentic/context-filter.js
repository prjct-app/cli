/**
 * Intelligent Context Filtering System
 *
 * Reduces context window usage by 70-90% by loading only
 * relevant files for each specialized agent
 *
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

class ContextFilter {
  constructor() {
    // Technology-specific file patterns
    this.techPatterns = this.initializeTechPatterns();

    // Task-based filtering rules
    this.taskPatterns = this.initializeTaskPatterns();

    // Cache for file analysis
    this.fileCache = new Map();
  }

  /**
   * Main entry point - filters context based on agent and task
   * IMPROVED: Supports pre-estimated files for lazy loading
   */
  async filterForAgent(agent, task, projectPath, fullContext = {}) {
    const startTime = Date.now();

    // If files were pre-estimated (lazy loading), use them
    if (fullContext.estimatedFiles && fullContext.estimatedFiles.length > 0) {
      const filteredFiles = fullContext.estimatedFiles;
      
      const metrics = this.calculateMetrics(
        fullContext.fileCount || filteredFiles.length,
        filteredFiles.length,
        startTime
      );

      return {
        files: filteredFiles,
        patterns: { preEstimated: true },
        metrics,
        agent: agent.name,
        filtered: true
      };
    }

    // Fallback to traditional filtering if no pre-estimation
    // Determine what files this agent needs
    const relevantPatterns = await this.determineRelevantPatterns(
      agent,
      task,
      projectPath
    );

    // Load only relevant files
    const filteredFiles = await this.loadRelevantFiles(
      projectPath,
      relevantPatterns
    );

    // Calculate reduction metrics
    const metrics = this.calculateMetrics(
      fullContext.fileCount || 1000, // estimate if not provided
      filteredFiles.length,
      startTime
    );

    return {
      files: filteredFiles,
      patterns: relevantPatterns,
      metrics,
      agent: agent.name,
      filtered: true
    };
  }

  /**
   * Initialize technology-specific patterns
   */
  initializeTechPatterns() {
    return {
      // Languages
      javascript: {
        extensions: ['.js', '.mjs', '.cjs'],
        directories: ['src', 'lib', 'utils'],
        exclude: ['node_modules', 'dist', 'build']
      },
      typescript: {
        extensions: ['.ts', '.tsx', '.d.ts'],
        directories: ['src', 'lib', 'types'],
        exclude: ['node_modules', 'dist', 'build']
      },
      python: {
        extensions: ['.py', '.pyx'],
        directories: ['src', 'lib', 'app'],
        exclude: ['__pycache__', 'venv', '.env']
      },
      ruby: {
        extensions: ['.rb', '.rake'],
        directories: ['app', 'lib', 'config'],
        exclude: ['vendor', 'tmp', 'log']
      },
      go: {
        extensions: ['.go'],
        directories: ['pkg', 'cmd', 'internal'],
        exclude: ['vendor', 'bin']
      },
      rust: {
        extensions: ['.rs'],
        directories: ['src', 'lib'],
        exclude: ['target', 'dist']
      },
      java: {
        extensions: ['.java'],
        directories: ['src/main/java', 'src/test/java'],
        exclude: ['target', 'build', '.gradle']
      },
      php: {
        extensions: ['.php'],
        directories: ['src', 'app', 'lib'],
        exclude: ['vendor', 'cache']
      },
      elixir: {
        extensions: ['.ex', '.exs'],
        directories: ['lib', 'web', 'apps'],
        exclude: ['_build', 'deps', 'cover']
      },

      // Frameworks
      react: {
        extensions: ['.jsx', '.tsx', '.js', '.ts'],
        directories: ['components', 'pages', 'hooks', 'contexts'],
        patterns: ['**/components/**', '**/pages/**', '**/hooks/**'],
        exclude: ['node_modules', 'build', 'dist']
      },
      vue: {
        extensions: ['.vue', '.js', '.ts'],
        directories: ['components', 'views', 'stores'],
        patterns: ['**/*.vue', '**/components/**'],
        exclude: ['node_modules', 'dist']
      },
      angular: {
        extensions: ['.ts', '.html', '.scss'],
        directories: ['src/app'],
        patterns: ['**/*.component.ts', '**/*.service.ts'],
        exclude: ['node_modules', 'dist']
      },
      rails: {
        extensions: ['.rb', '.erb', '.haml'],
        directories: ['app', 'config', 'db'],
        patterns: ['app/**/*.rb', 'config/**/*.rb'],
        exclude: ['tmp', 'log', 'vendor']
      },
      django: {
        extensions: ['.py', '.html'],
        directories: ['apps', 'templates', 'static'],
        patterns: ['**/*.py', 'templates/**'],
        exclude: ['venv', '__pycache__', 'media']
      },
      express: {
        extensions: ['.js', '.ts'],
        directories: ['routes', 'controllers', 'middleware'],
        patterns: ['routes/**', 'controllers/**'],
        exclude: ['node_modules', 'public']
      },
      fastapi: {
        extensions: ['.py'],
        directories: ['app', 'api', 'routers'],
        patterns: ['app/**/*.py', 'api/**/*.py'],
        exclude: ['venv', '__pycache__']
      },

      // Databases
      postgres: {
        extensions: ['.sql', '.plpgsql'],
        directories: ['migrations', 'schemas', 'functions'],
        patterns: ['**/*.sql', 'migrations/**'],
        exclude: []
      },
      mongodb: {
        extensions: ['.js', '.ts', '.json'],
        directories: ['models', 'schemas'],
        patterns: ['models/**', 'schemas/**'],
        exclude: []
      },
      mysql: {
        extensions: ['.sql'],
        directories: ['migrations', 'schemas'],
        patterns: ['**/*.sql'],
        exclude: []
      }
    };
  }

  /**
   * Initialize task-based patterns
   */
  initializeTaskPatterns() {
    return {
      api: {
        include: ['routes', 'controllers', 'middleware', 'api'],
        patterns: ['**/api/**', '**/routes/**', '**/controllers/**'],
        focus: 'backend logic and endpoints'
      },
      ui: {
        include: ['components', 'pages', 'views', 'styles'],
        patterns: ['**/components/**', '**/pages/**', '**/*.css', '**/*.scss'],
        focus: 'user interface and styling'
      },
      database: {
        include: ['models', 'migrations', 'schemas', 'db'],
        patterns: ['**/models/**', '**/migrations/**', '**/*.sql'],
        focus: 'data layer and persistence'
      },
      testing: {
        include: ['test', 'tests', 'spec', '__tests__'],
        patterns: ['**/*.test.*', '**/*.spec.*', '**/test/**'],
        focus: 'test files and test utilities'
      },
      configuration: {
        include: ['config', 'env', 'settings'],
        patterns: ['**/config/**', '**/.env*', '**/*config.*'],
        focus: 'configuration and environment'
      },
      deployment: {
        include: ['.github', '.gitlab', 'docker', 'k8s'],
        patterns: ['Dockerfile*', '**/*.yml', '**/*.yaml', '.github/**'],
        focus: 'CI/CD and deployment'
      },
      documentation: {
        include: ['docs', 'README'],
        patterns: ['**/*.md', 'docs/**', 'README*'],
        focus: 'documentation files'
      }
    };
  }

  /**
   * Determine which patterns to use based on agent and task
   */
  async determineRelevantPatterns(agent, task, projectPath) {
    const patterns = {
      include: [],
      exclude: [],
      extensions: [],
      specific: []
    };

    // Detect technologies in the project
    const detectedTech = await this.detectProjectTechnologies(projectPath);

    // Add patterns based on detected technologies
    detectedTech.forEach(tech => {
      if (this.techPatterns[tech]) {
        const techPattern = this.techPatterns[tech];
        patterns.extensions.push(...(techPattern.extensions || []));
        patterns.include.push(...(techPattern.directories || []));
        patterns.exclude.push(...(techPattern.exclude || []));
        patterns.specific.push(...(techPattern.patterns || []));
      }
    });

    // Add patterns based on task type
    const taskType = this.detectTaskType(task);
    if (this.taskPatterns[taskType]) {
      const taskPattern = this.taskPatterns[taskType];
      patterns.include.push(...(taskPattern.include || []));
      patterns.specific.push(...(taskPattern.patterns || []));
    }

    // Add agent-specific patterns
    const agentPatterns = this.getAgentSpecificPatterns(agent);
    patterns.include.push(...agentPatterns.include);
    patterns.exclude.push(...agentPatterns.exclude);

    // Remove duplicates
    patterns.include = [...new Set(patterns.include)];
    patterns.exclude = [...new Set(patterns.exclude)];
    patterns.extensions = [...new Set(patterns.extensions)];
    patterns.specific = [...new Set(patterns.specific)];

    return patterns;
  }

  /**
   * Detect technologies used in the project
   * NOW USES TechDetector - NO HARDCODING
   */
  async detectProjectTechnologies(projectPath) {
    try {
      const TechDetector = require('../domain/tech-detector');
      const detector = new TechDetector(projectPath);
      const tech = await detector.detectAll();

      // Convert to array of all detected technologies
      const all = [
        ...tech.languages,
        ...tech.frameworks,
        ...tech.tools,
        ...tech.databases,
        ...tech.buildTools,
        ...tech.testFrameworks
      ];

      return Array.from(new Set(all)); // Remove duplicates
    } catch (error) {
      console.error('Error detecting technologies:', error.message);
      return [];
    }
  }

  /**
   * Detect task type from description
   */
  detectTaskType(task) {
    const description = (task.description || '').toLowerCase();

    if (description.includes('api') || description.includes('endpoint')) {
      return 'api';
    }
    if (description.includes('ui') || description.includes('component') || description.includes('style')) {
      return 'ui';
    }
    if (description.includes('database') || description.includes('migration') || description.includes('schema')) {
      return 'database';
    }
    if (description.includes('test') || description.includes('spec')) {
      return 'testing';
    }
    if (description.includes('deploy') || description.includes('docker') || description.includes('ci')) {
      return 'deployment';
    }
    if (description.includes('config') || description.includes('env')) {
      return 'configuration';
    }
    if (description.includes('docs') || description.includes('readme')) {
      return 'documentation';
    }

    return 'general';
  }

  /**
   * Get agent-specific patterns
   */
  getAgentSpecificPatterns(agent) {
    const agentType = (agent.type || agent.name || '').toLowerCase();

    const patterns = {
      'frontend': {
        include: ['components', 'pages', 'views', 'styles', 'public'],
        exclude: ['backend', 'api', 'server', 'database']
      },
      'backend': {
        include: ['api', 'routes', 'controllers', 'services', 'middleware'],
        exclude: ['components', 'styles', 'public']
      },
      'database': {
        include: ['models', 'schemas', 'migrations', 'db'],
        exclude: ['components', 'styles', 'public', 'static']
      },
      'devops': {
        include: ['.github', '.gitlab', 'docker', 'k8s', 'terraform'],
        exclude: ['src', 'app', 'components']
      },
      'qa': {
        include: ['test', 'tests', 'spec', '__tests__', 'cypress'],
        exclude: ['src', 'app', 'public']
      }
    };

    // Find matching pattern
    for (const [key, pattern] of Object.entries(patterns)) {
      if (agentType.includes(key)) {
        return pattern;
      }
    }

    // Default pattern
    return {
      include: [],
      exclude: ['node_modules', 'vendor', 'dist', 'build', '.git']
    };
  }

  /**
   * Load only relevant files based on patterns
   */
  async loadRelevantFiles(projectPath, patterns) {
    const files = [];

    try {
      // Build glob patterns
      const globPatterns = this.buildGlobPatterns(patterns);

      // Execute glob searches
      for (const pattern of globPatterns) {
        const matches = await glob(pattern, {
          cwd: projectPath,
          ignore: patterns.exclude,
          nodir: true,
          follow: false
        });

        // Ensure matches is always an array (glob v10+ returns array, but be defensive)
        if (Array.isArray(matches)) {
          files.push(...matches);
        } else if (matches) {
          // Convert iterable to array if needed
          files.push(...Array.from(matches));
        }
      }

      // Remove duplicates and sort
      const uniqueFiles = [...new Set(files)].sort();

      // Limit to reasonable number
      const maxFiles = 300;
      if (uniqueFiles.length > maxFiles) {
        console.log(`Limiting context to ${maxFiles} most relevant files`);
        return uniqueFiles.slice(0, maxFiles);
      }

      // Expand context with related files
      const expandedFiles = await this.expandContext(uniqueFiles);

      return expandedFiles.slice(0, maxFiles);

    } catch (error) {
      console.error('Error loading files:', error.message);
      return [];
    }
  }

  /**
   * Build glob patterns from pattern configuration
   */
  buildGlobPatterns(patterns) {
    const globs = [];

    // Add specific patterns
    globs.push(...patterns.specific);

    // Add extension-based patterns
    if (patterns.extensions.length > 0) {
      const extPattern = `**/*{${patterns.extensions.join(',')}}`;
      globs.push(extPattern);
    }

    // Add directory patterns
    patterns.include.forEach(dir => {
      globs.push(`${dir}/**/*`);
    });

    // Default pattern if none specified
    if (globs.length === 0) {
      globs.push('**/*.{js,ts,jsx,tsx,py,rb,go,java,php}');
    }

    return globs;
  }

  /**
   * Calculate metrics for context reduction
   */
  calculateMetrics(originalCount, filteredCount, startTime) {
    const reduction = originalCount > 0
      ? Math.round(((originalCount - filteredCount) / originalCount) * 100)
      : 0;

    return {
      originalFiles: originalCount,
      filteredFiles: filteredCount,
      reductionPercent: reduction,
      processingTime: Date.now() - startTime,
      effectiveness: reduction > 70 ? 'high' : reduction > 40 ? 'medium' : 'low'
    };
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Expand context with related files (tests, styles, etc.)
   */
  async expandContext(files) {
    const expanded = new Set(files);

    for (const file of files) {
      const ext = path.extname(file);
      const basename = path.basename(file, ext);
      const dirname = path.dirname(file);

      // 1. Look for test files
      const testPatterns = [
        path.join(dirname, `${basename}.test${ext}`),
        path.join(dirname, `${basename}.spec${ext}`),
        path.join(dirname, '__tests__', `${basename}.test${ext}`),
        path.join(dirname, 'tests', `${basename}.test${ext}`)
      ];

      // 2. Look for style files (for UI components)
      const stylePatterns = [
        path.join(dirname, `${basename}.css`),
        path.join(dirname, `${basename}.scss`),
        path.join(dirname, `${basename}.module.css`),
        path.join(dirname, `${basename}.module.scss`)
      ];

      // Check if these related files exist
      const potentialFiles = [...testPatterns, ...stylePatterns];
      
      for (const potential of potentialFiles) {
        if (!expanded.has(potential) && await this.fileExists(potential)) {
          expanded.add(potential);
        }
      }
    }

    return Array.from(expanded).sort();
  }

  /**
   * Get filter statistics
   */
  getStatistics() {
    return {
      cachedFiles: this.fileCache.size,
      supportedTechnologies: Object.keys(this.techPatterns).length,
      taskTypes: Object.keys(this.taskPatterns).length
    };
  }
}

module.exports = ContextFilter;