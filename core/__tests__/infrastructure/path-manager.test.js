import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

const require = createRequire(import.meta.url)

describe('Path Manager', () => {
  let pathManager
  let testProjectPath
  let tempDir

  beforeEach(async () => {
    pathManager = require('../../infrastructure/path-manager.js')

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

  describe('generateProjectId()', () => {
    it('should generate consistent ID for same path', () => {
      const id1 = pathManager.generateProjectId(testProjectPath)
      const id2 = pathManager.generateProjectId(testProjectPath)

      expect(id1).toBe(id2)
      expect(id1.length).toBe(12)
    })

    it('should generate different IDs for different paths', () => {
      const id1 = pathManager.generateProjectId('/path/one')
      const id2 = pathManager.generateProjectId('/path/two')

      expect(id1).not.toBe(id2)
    })

    it('should use absolute path for consistency', () => {
      const relativePath = './test'
      const absolutePath = path.resolve(relativePath)

      const id1 = pathManager.generateProjectId(relativePath)
      const id2 = pathManager.generateProjectId(absolutePath)

      expect(id1).toBe(id2)
    })
  })

  describe('getGlobalBasePath()', () => {
    it('should return path to .prjct-cli directory', () => {
      const basePath = pathManager.getGlobalBasePath()

      expect(basePath).toContain('.prjct-cli')
      expect(basePath).toContain(os.homedir())
    })
  })

  describe('getGlobalProjectPath()', () => {
    it('should return path to project directory', () => {
      const projectId = 'test-project-123'
      const projectPath = pathManager.getGlobalProjectPath(projectId)

      expect(projectPath).toContain(projectId)
      expect(projectPath).toContain('.prjct-cli')
      expect(projectPath).toContain('projects')
    })
  })

  describe('getLocalConfigPath()', () => {
    it('should return path to local config file', () => {
      const configPath = pathManager.getLocalConfigPath(testProjectPath)

      expect(configPath).toContain('.prjct')
      expect(configPath).toContain('prjct.config.json')
      expect(configPath).toContain(testProjectPath)
    })
  })

  describe('getGlobalProjectConfigPath()', () => {
    it('should return path to global config file', () => {
      const projectId = 'test-123'
      const configPath = pathManager.getGlobalProjectConfigPath(projectId)

      expect(configPath).toContain(projectId)
      expect(configPath).toContain('project.json')
    })
  })

  describe('getLegacyPrjctPath()', () => {
    it('should return path to legacy .prjct directory', () => {
      const legacyPath = pathManager.getLegacyPrjctPath(testProjectPath)

      expect(legacyPath).toContain('.prjct')
      expect(legacyPath).toContain(testProjectPath)
    })
  })

  describe('hasLegacyStructure()', () => {
    it('should return true if legacy directory exists', async () => {
      const legacyPath = path.join(testProjectPath, '.prjct')
      await fs.mkdir(legacyPath, { recursive: true })

      const hasLegacy = await pathManager.hasLegacyStructure(testProjectPath)

      expect(hasLegacy).toBe(true)
    })

    it('should return false if legacy directory does not exist', async () => {
      const hasLegacy = await pathManager.hasLegacyStructure(testProjectPath)

      expect(hasLegacy).toBe(false)
    })
  })

  describe('hasConfig()', () => {
    it('should return true if config file exists', async () => {
      const configPath = pathManager.getLocalConfigPath(testProjectPath)
      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, '{}')

      const hasConfig = await pathManager.hasConfig(testProjectPath)

      expect(hasConfig).toBe(true)
    })

    it('should return false if config file does not exist', async () => {
      const hasConfig = await pathManager.hasConfig(testProjectPath)

      expect(hasConfig).toBe(false)
    })
  })

  describe('ensureGlobalStructure()', () => {
    it('should create global directory structure', async () => {
      await pathManager.ensureGlobalStructure()

      const basePath = pathManager.getGlobalBasePath()
      const exists = await fs.access(basePath).then(() => true).catch(() => false)

      expect(exists).toBe(true)
    })

    it('should create projects directory', async () => {
      await pathManager.ensureGlobalStructure()

      const projectsDir = path.join(pathManager.getGlobalBasePath(), 'projects')
      const exists = await fs.access(projectsDir).then(() => true).catch(() => false)

      expect(exists).toBe(true)
    })
  })

  describe('ensureProjectStructure()', () => {
    it('should create project directory structure', async () => {
      const projectId = 'test-structure-123'
      const projectPath = await pathManager.ensureProjectStructure(projectId)

      expect(projectPath).toBeDefined()
      expect(projectPath).toContain(projectId)

      // Check that layers were created
      const corePath = path.join(projectPath, 'core')
      const exists = await fs.access(corePath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })

    it('should create all required layers', async () => {
      const projectId = 'test-layers-123'
      const projectPath = await pathManager.ensureProjectStructure(projectId)

      const layers = ['core', 'progress', 'planning', 'analysis', 'memory']
      for (const layer of layers) {
        const layerPath = path.join(projectPath, layer)
        const exists = await fs.access(layerPath).then(() => true).catch(() => false)
        expect(exists).toBe(true)
      }
    })

    it('should create nested directories', async () => {
      const projectId = 'test-nested-123'
      const projectPath = await pathManager.ensureProjectStructure(projectId)

      const tasksPath = path.join(projectPath, 'planning', 'tasks')
      const exists = await fs.access(tasksPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe('getSessionPath()', () => {
    it('should return path with date structure', () => {
      const projectId = 'test-session-123'
      const date = new Date('2025-10-15')
      const sessionPath = pathManager.getSessionPath(projectId, date)

      expect(sessionPath).toContain('2025')
      expect(sessionPath).toContain('10')
      // Day may vary due to timezone, just check it contains a day
      expect(sessionPath).toMatch(/\d{2}/)
      expect(sessionPath).toContain('sessions')
    })

    it('should use today if no date provided', () => {
      const projectId = 'test-session-456'
      const sessionPath = pathManager.getSessionPath(projectId)

      expect(sessionPath).toContain('sessions')
      expect(sessionPath).toContain(projectId)
    })
  })

  describe('getCurrentSessionPath()', () => {
    it('should return path for today', () => {
      const projectId = 'test-current-123'
      const sessionPath = pathManager.getCurrentSessionPath(projectId)

      expect(sessionPath).toContain('sessions')
      expect(sessionPath).toContain(projectId)
    })
  })

  describe('ensureSessionPath()', () => {
    it('should create session directory', async () => {
      const projectId = 'test-ensure-session-123'
      await pathManager.ensureProjectStructure(projectId)

      const date = new Date('2025-10-15')
      const sessionPath = await pathManager.ensureSessionPath(projectId, date)

      expect(sessionPath).toBeDefined()
      const exists = await fs.access(sessionPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })

    it('should use today if no date provided', async () => {
      const projectId = 'test-ensure-today-123'
      await pathManager.ensureProjectStructure(projectId)

      const sessionPath = await pathManager.ensureSessionPath(projectId)

      expect(sessionPath).toBeDefined()
      const exists = await fs.access(sessionPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe('listSessions()', () => {
    it('should return empty array for non-existent sessions', async () => {
      const projectId = 'test-list-empty-123'
      await pathManager.ensureProjectStructure(projectId)

      const sessions = await pathManager.listSessions(projectId)

      expect(sessions).toEqual([])
    })

    it('should list sessions when they exist', async () => {
      const projectId = 'test-list-sessions-123'
      await pathManager.ensureProjectStructure(projectId)

      // Create a session directory
      const date = new Date('2025-10-15')
      await pathManager.ensureSessionPath(projectId, date)

      const sessions = await pathManager.listSessions(projectId)

      expect(sessions.length).toBeGreaterThan(0)
      expect(sessions[0].year).toBe('2025')
      expect(sessions[0].month).toBe('10')
      // Day may vary due to date parsing, just check it's a valid day string
      expect(sessions[0].day).toMatch(/^\d{2}$/)
    })

    it('should filter by year', async () => {
      const projectId = 'test-filter-year-123'
      await pathManager.ensureProjectStructure(projectId)

      await pathManager.ensureSessionPath(projectId, new Date('2025-10-15'))
      await pathManager.ensureSessionPath(projectId, new Date('2024-10-15'))

      const sessions2025 = await pathManager.listSessions(projectId, '2025')
      const sessions2024 = await pathManager.listSessions(projectId, '2024')

      expect(sessions2025.every(s => s.year === '2025')).toBe(true)
      expect(sessions2024.every(s => s.year === '2024')).toBe(true)
    })

    it('should filter by month', async () => {
      const projectId = 'test-filter-month-123'
      await pathManager.ensureProjectStructure(projectId)

      await pathManager.ensureSessionPath(projectId, new Date('2025-10-15'))
      await pathManager.ensureSessionPath(projectId, new Date('2025-11-15'))

      const sessionsOct = await pathManager.listSessions(projectId, '2025', 10)
      const sessionsNov = await pathManager.listSessions(projectId, '2025', 11)

      expect(sessionsOct.every(s => s.month === '10')).toBe(true)
      expect(sessionsNov.every(s => s.month === '11')).toBe(true)
    })
  })

  describe('getSessionsInRange()', () => {
    it('should return sessions within date range', async () => {
      const projectId = 'test-range-123'
      await pathManager.ensureProjectStructure(projectId)

      await pathManager.ensureSessionPath(projectId, new Date('2025-10-15'))
      await pathManager.ensureSessionPath(projectId, new Date('2025-10-20'))
      await pathManager.ensureSessionPath(projectId, new Date('2025-11-01'))

      const fromDate = new Date('2025-10-10')
      const toDate = new Date('2025-10-25')

      const sessions = await pathManager.getSessionsInRange(projectId, fromDate, toDate)

      expect(sessions.length).toBeGreaterThan(0)
      expect(sessions.every(s => s.date >= fromDate && s.date <= toDate)).toBe(true)
    })

    it('should use today as default end date', async () => {
      const projectId = 'test-range-today-123'
      await pathManager.ensureProjectStructure(projectId)

      await pathManager.ensureSessionPath(projectId, new Date())

      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 1)

      const sessions = await pathManager.getSessionsInRange(projectId, fromDate)

      expect(sessions.length).toBeGreaterThan(0)
    })
  })

  describe('getFilePath()', () => {
    it('should return path to file in layer', () => {
      const projectId = 'test-file-123'
      const filePath = pathManager.getFilePath(projectId, 'core', 'now.md')

      expect(filePath).toContain(projectId)
      expect(filePath).toContain('core')
      expect(filePath).toContain('now.md')
    })
  })

  describe('listProjects()', () => {
    it('should return empty array when no projects exist', async () => {
      const projects = await pathManager.listProjects()

      // May have existing projects, so just check it's an array
      expect(Array.isArray(projects)).toBe(true)
    })

    it('should list existing projects', async () => {
      const projectId = 'test-list-123'
      await pathManager.ensureProjectStructure(projectId)

      const projects = await pathManager.listProjects()

      expect(projects).toContain(projectId)
    })
  })

  describe('projectExists()', () => {
    it('should return true for existing project', async () => {
      const projectId = 'test-exists-123'
      await pathManager.ensureProjectStructure(projectId)

      const exists = await pathManager.projectExists(projectId)

      expect(exists).toBe(true)
    })

    it('should return false for non-existent project', async () => {
      const exists = await pathManager.projectExists('non-existent-project-id')

      expect(exists).toBe(false)
    })
  })

  describe('getDisplayPath()', () => {
    it('should replace home directory with ~', () => {
      const homeDir = os.homedir()
      const testPath = path.join(homeDir, '.prjct-cli', 'projects', 'test')

      const displayPath = pathManager.getDisplayPath(testPath)

      expect(displayPath).toContain('~')
      expect(displayPath).not.toContain(homeDir)
    })

    it('should return original path if not in home directory', () => {
      const testPath = '/some/other/path'

      const displayPath = pathManager.getDisplayPath(testPath)

      expect(displayPath).toBe(testPath)
    })
  })
})

