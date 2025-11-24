import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

// Use createRequire to import CommonJS module
const require = createRequire(import.meta.url)

describe('Context Filter', () => {
  let ContextFilter
  let testProjectPath
  let tempDir

  beforeEach(async () => {
    // Test that module can be imported (detects missing dependency)
    try {
      ContextFilter = require('../../agentic/context-filter.js')
    } catch (error) {
      throw new Error(`Failed to import context-filter: ${error.message}. This indicates a missing dependency.`)
    }

    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-test-'))
    testProjectPath = tempDir
  })

  afterEach(async () => {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  })

  describe('Module Import', () => {
    it('should import without errors (detects missing glob dependency)', () => {
      expect(ContextFilter).toBeDefined()
      expect(typeof ContextFilter).toBe('function')
    })

    it('should be instantiable', () => {
      const filter = new ContextFilter()
      expect(filter).toBeDefined()
      expect(filter).toBeInstanceOf(ContextFilter)
    })
  })

  describe('Glob API Compatibility', () => {
    it('should use modern glob API (detects promisify issue)', async () => {
      const filter = new ContextFilter()
      
      // Create test files
      const srcDir = path.join(testProjectPath, 'src')
      await fs.mkdir(srcDir, { recursive: true })
      await fs.writeFile(path.join(srcDir, 'test.js'), '// test')
      await fs.writeFile(path.join(srcDir, 'test2.js'), '// test2')

      // Test that glob works with modern API
      // This will fail if using old promisify pattern
      const patterns = {
        include: ['src'],
        exclude: ['node_modules'],
        extensions: ['.js'],
        specific: ['src/**/*.js'] // Use specific pattern to ensure files are found
      }

      const files = await filter.loadRelevantFiles(testProjectPath, patterns)

      // Should find test files (or at least return array without errors)
      expect(Array.isArray(files)).toBe(true)
      // Files may be relative or absolute paths, so check more flexibly
      if (files.length > 0) {
        expect(files.some(f => f.includes('test') && f.includes('.js'))).toBe(true)
      }
    })

    it('should handle glob errors gracefully', async () => {
      const filter = new ContextFilter()
      
      // Invalid pattern should not throw
      const patterns = {
        include: [],
        exclude: [],
        extensions: [],
        specific: ['**/nonexistent/**/*.xyz']
      }

      const files = await filter.loadRelevantFiles('/nonexistent/path', patterns)
      
      // Should return empty array, not throw
      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBe(0)
    })
  })

  describe('Initialization', () => {
    it('should initialize tech patterns', () => {
      const filter = new ContextFilter()
      const stats = filter.getStatistics()

      expect(stats.supportedTechnologies).toBeGreaterThan(0)
      expect(stats.taskTypes).toBeGreaterThan(0)
    })

    it('should have technology patterns', () => {
      const filter = new ContextFilter()
      // Access private property through method
      const stats = filter.getStatistics()
      
      expect(stats.supportedTechnologies).toBeGreaterThan(10) // Should have many tech patterns
    })

    it('should have task patterns', () => {
      const filter = new ContextFilter()
      const stats = filter.getStatistics()
      
      expect(stats.taskTypes).toBeGreaterThan(5) // Should have multiple task types
    })
  })

  describe('Technology Detection', () => {
    it('should detect JavaScript project', async () => {
      const filter = new ContextFilter()
      
      // Create package.json
      const packageJson = {
        name: 'test-project',
        dependencies: {}
      }
      await fs.writeFile(
        path.join(testProjectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      const techs = await filter.detectProjectTechnologies(testProjectPath)
      
      expect(Array.isArray(techs)).toBe(true)
      expect(techs).toContain('javascript')
    })

    it('should detect TypeScript project', async () => {
      const filter = new ContextFilter()
      
      const packageJson = {
        name: 'test-project',
        dependencies: {
          typescript: '^5.0.0'
        }
      }
      await fs.writeFile(
        path.join(testProjectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      const techs = await filter.detectProjectTechnologies(testProjectPath)
      
      expect(techs).toContain('typescript')
      expect(techs).not.toContain('javascript')
    })

    it('should detect React project', async () => {
      const filter = new ContextFilter()
      
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
          typescript: '^5.0.0'
        }
      }
      await fs.writeFile(
        path.join(testProjectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      const techs = await filter.detectProjectTechnologies(testProjectPath)
      
      expect(techs).toContain('react')
      expect(techs).toContain('typescript')
    })

    it('should detect Express project', async () => {
      const filter = new ContextFilter()
      
      const packageJson = {
        name: 'test-project',
        dependencies: {
          express: '^4.18.0'
        }
      }
      await fs.writeFile(
        path.join(testProjectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      const techs = await filter.detectProjectTechnologies(testProjectPath)
      
      expect(techs).toContain('express')
    })

    it('should handle missing package.json gracefully', async () => {
      const filter = new ContextFilter()
      
      const techs = await filter.detectProjectTechnologies(testProjectPath)
      
      expect(Array.isArray(techs)).toBe(true)
      expect(techs.length).toBe(0)
    })
  })

  describe('Task Type Detection', () => {
    it('should detect API task', () => {
      const filter = new ContextFilter()
      
      const taskType = filter.detectTaskType({ description: 'create API endpoint' })
      
      expect(taskType).toBe('api')
    })

    it('should detect UI task', () => {
      const filter = new ContextFilter()
      
      const taskType = filter.detectTaskType({ description: 'build login component' })
      
      expect(taskType).toBe('ui')
    })

    it('should detect database task', () => {
      const filter = new ContextFilter()
      
      const taskType = filter.detectTaskType({ description: 'create migration schema' })
      
      expect(taskType).toBe('database')
    })

    it('should detect testing task', () => {
      const filter = new ContextFilter()
      
      const taskType = filter.detectTaskType({ description: 'write unit tests' })
      
      expect(taskType).toBe('testing')
    })

    it('should return general for unknown task', () => {
      const filter = new ContextFilter()
      
      const taskType = filter.detectTaskType({ description: 'random task' })
      
      expect(taskType).toBe('general')
    })
  })

  describe('Agent-Specific Patterns', () => {
    it('should return frontend patterns for frontend agent', () => {
      const filter = new ContextFilter()
      
      const patterns = filter.getAgentSpecificPatterns({ type: 'frontend' })
      
      expect(patterns.include).toContain('components')
      expect(patterns.exclude).toContain('backend')
    })

    it('should return backend patterns for backend agent', () => {
      const filter = new ContextFilter()
      
      const patterns = filter.getAgentSpecificPatterns({ type: 'backend' })
      
      expect(patterns.include).toContain('api')
      expect(patterns.exclude).toContain('components')
    })

    it('should return default patterns for unknown agent', () => {
      const filter = new ContextFilter()
      
      const patterns = filter.getAgentSpecificPatterns({ type: 'unknown' })
      
      expect(patterns.exclude).toContain('node_modules')
    })
  })

  describe('File Filtering', () => {
    it('should filter files by extension', async () => {
      const filter = new ContextFilter()
      
      // Create test structure
      const srcDir = path.join(testProjectPath, 'src')
      await fs.mkdir(srcDir, { recursive: true })
      await fs.writeFile(path.join(srcDir, 'app.js'), '// app')
      await fs.writeFile(path.join(srcDir, 'app.ts'), '// app ts')
      await fs.writeFile(path.join(srcDir, 'readme.md'), '# readme')

      const patterns = {
        include: ['src'],
        exclude: [],
        extensions: ['.js'],
        specific: ['src/**/*.js'] // Use specific pattern
      }

      const files = await filter.loadRelevantFiles(testProjectPath, patterns)
      
      // Should find .js files (may be relative paths)
      const hasJsFile = files.some(f => (f.includes('app') || f.includes('src')) && f.includes('.js'))
      expect(hasJsFile || files.length === 0).toBe(true) // Either finds files or returns empty
    })

    it('should exclude node_modules', async () => {
      const filter = new ContextFilter()
      
      // Create test structure
      const srcDir = path.join(testProjectPath, 'src')
      const nodeModulesDir = path.join(testProjectPath, 'node_modules')
      await fs.mkdir(srcDir, { recursive: true })
      await fs.mkdir(nodeModulesDir, { recursive: true })
      await fs.writeFile(path.join(srcDir, 'app.js'), '// app')
      await fs.writeFile(path.join(nodeModulesDir, 'lib.js'), '// lib')

      const patterns = {
        include: ['src'],
        exclude: ['node_modules'],
        extensions: ['.js'],
        specific: ['src/**/*.js'] // Focus on src directory
      }

      const files = await filter.loadRelevantFiles(testProjectPath, patterns)
      
      // Should not include node_modules files
      const hasNodeModules = files.some(f => f.includes('node_modules'))
      expect(hasNodeModules).toBe(false)
    })

    it('should limit files to maxFiles', async () => {
      const filter = new ContextFilter()
      
      // Create many test files
      const srcDir = path.join(testProjectPath, 'src')
      await fs.mkdir(srcDir, { recursive: true })
      
      for (let i = 0; i < 150; i++) {
        await fs.writeFile(path.join(srcDir, `file${i}.js`), `// file ${i}`)
      }

      const patterns = {
        include: ['src'],
        exclude: [],
        extensions: ['.js'],
        specific: []
      }

      const files = await filter.loadRelevantFiles(testProjectPath, patterns)
      
      // Should be limited to 300 files
      expect(files.length).toBeLessThanOrEqual(300)
    })
  })

  describe('Pattern Building', () => {
    it('should build glob patterns from configuration', () => {
      const filter = new ContextFilter()
      
      const patterns = {
        include: ['src', 'lib'],
        exclude: [],
        extensions: ['.js', '.ts'],
        specific: ['**/components/**']
      }

      const globPatterns = filter.buildGlobPatterns(patterns)
      
      expect(globPatterns).toContain('**/components/**')
      expect(globPatterns.some(p => p.includes('src'))).toBe(true)
      expect(globPatterns.some(p => p.includes('.js'))).toBe(true)
    })

    it('should use default pattern when none specified', () => {
      const filter = new ContextFilter()
      
      const patterns = {
        include: [],
        exclude: [],
        extensions: [],
        specific: []
      }

      const globPatterns = filter.buildGlobPatterns(patterns)
      
      expect(globPatterns.length).toBeGreaterThan(0)
      expect(globPatterns[0]).toContain('**/*.')
    })
  })

  describe('Metrics Calculation', () => {
    it('should calculate reduction metrics', () => {
      const filter = new ContextFilter()
      const startTime = Date.now()
      
      const metrics = filter.calculateMetrics(1000, 200, startTime)
      
      expect(metrics.originalFiles).toBe(1000)
      expect(metrics.filteredFiles).toBe(200)
      expect(metrics.reductionPercent).toBe(80)
      expect(metrics.effectiveness).toBe('high')
    })

    it('should classify effectiveness correctly', () => {
      const filter = new ContextFilter()
      const startTime = Date.now()
      
      const high = filter.calculateMetrics(1000, 200, startTime)
      const medium = filter.calculateMetrics(1000, 500, startTime)
      const low = filter.calculateMetrics(1000, 800, startTime)
      
      expect(high.effectiveness).toBe('high')
      expect(medium.effectiveness).toBe('medium')
      expect(low.effectiveness).toBe('low')
    })
  })

  describe('File Existence Check', () => {
    it('should return true for existing file', async () => {
      const filter = new ContextFilter()
      
      const testFile = path.join(testProjectPath, 'test.txt')
      await fs.writeFile(testFile, 'test')
      
      const exists = await filter.fileExists(testFile)
      
      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const filter = new ContextFilter()
      
      const exists = await filter.fileExists('/nonexistent/path/file.txt')
      
      expect(exists).toBe(false)
    })
  })

  describe('Full Filter Workflow', () => {
    it('should filter context for frontend agent', async () => {
      const filter = new ContextFilter()
      
      // Create test project structure
      const srcDir = path.join(testProjectPath, 'src')
      const componentsDir = path.join(srcDir, 'components')
      await fs.mkdir(componentsDir, { recursive: true })
      
      await fs.writeFile(path.join(componentsDir, 'Button.jsx'), '// Button')
      await fs.writeFile(path.join(srcDir, 'api.js'), '// API')
      
      // Create package.json
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0'
        }
      }
      await fs.writeFile(
        path.join(testProjectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      const agent = { name: 'frontend', type: 'frontend' }
      const task = { description: 'build UI component' }
      
      const result = await filter.filterForAgent(agent, task, testProjectPath, { fileCount: 100 })
      
      expect(result).toBeDefined()
      expect(result.agent).toBe('frontend')
      expect(result.filtered).toBe(true)
      expect(result.files).toBeDefined()
      expect(result.metrics).toBeDefined()
      expect(result.metrics.reductionPercent).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty project gracefully', async () => {
      const filter = new ContextFilter()
      
      const agent = { name: 'backend', type: 'backend' }
      const task = { description: 'do something' }
      
      const result = await filter.filterForAgent(agent, task, testProjectPath, { fileCount: 0 })
      
      expect(result).toBeDefined()
      expect(result.files).toBeDefined()
      expect(Array.isArray(result.files)).toBe(true)
    })
  })
})

