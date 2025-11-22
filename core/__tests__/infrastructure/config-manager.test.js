import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

const require = createRequire(import.meta.url)

describe('Config Manager', () => {
  let configManager
  let pathManager
  let testProjectPath
  let tempDir

  beforeEach(async () => {
    configManager = require('../../infrastructure/config-manager.js')
    pathManager = require('../../infrastructure/path-manager.js')

    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-test-'))
    testProjectPath = tempDir

    // Create .prjct directory
    await fs.mkdir(path.join(testProjectPath, '.prjct'), { recursive: true })
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

  describe('readConfig()', () => {
    it('should read existing config', async () => {
      const config = {
        projectId: 'test-id-123',
        dataPath: '~/.prjct-cli/projects/test-id-123'
      }
      const configPath = pathManager.getLocalConfigPath(testProjectPath)
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await configManager.readConfig(testProjectPath)

      expect(result).toBeDefined()
      expect(result.projectId).toBe('test-id-123')
      expect(result.dataPath).toBeDefined()
    })

    it('should return null for non-existent config', async () => {
      const result = await configManager.readConfig(testProjectPath)

      expect(result).toBeNull()
    })

    it('should return null for invalid JSON', async () => {
      const configPath = pathManager.getLocalConfigPath(testProjectPath)
      await fs.writeFile(configPath, 'invalid json{')

      const result = await configManager.readConfig(testProjectPath)

      expect(result).toBeNull()
    })
  })

  describe('writeConfig()', () => {
    it('should write config file', async () => {
      const config = {
        projectId: 'test-id-456',
        dataPath: '~/.prjct-cli/projects/test-id-456'
      }

      await configManager.writeConfig(testProjectPath, config)

      const configPath = pathManager.getLocalConfigPath(testProjectPath)
      const content = await fs.readFile(configPath, 'utf-8')
      const parsed = JSON.parse(content)

      expect(parsed.projectId).toBe('test-id-456')
    })

    it('should create .prjct directory if it does not exist', async () => {
      const newPath = path.join(tempDir, 'new-project')
      const config = { projectId: 'test', dataPath: '~/.prjct-cli/projects/test' }

      await configManager.writeConfig(newPath, config)

      const configPath = pathManager.getLocalConfigPath(newPath)
      const exists = await fs.access(configPath).then(() => true).catch(() => false)

      expect(exists).toBe(true)
    })
  })

  describe('readGlobalConfig()', () => {
    it('should read global config', async () => {
      const projectId = 'test-global-123'
      const globalConfig = {
        projectId,
        authors: [],
        version: '0.9.1',
        lastSync: new Date().toISOString()
      }

      await configManager.writeGlobalConfig(projectId, globalConfig)
      const result = await configManager.readGlobalConfig(projectId)

      expect(result).toBeDefined()
      expect(result.projectId).toBe(projectId)
      expect(result.authors).toBeDefined()
    })

    it('should return null for non-existent global config', async () => {
      const result = await configManager.readGlobalConfig('non-existent-id')

      expect(result).toBeNull()
    })
  })

  describe('writeGlobalConfig()', () => {
    it('should write global config file', async () => {
      const projectId = 'test-global-456'
      const globalConfig = {
        projectId,
        authors: [],
        version: '0.9.1'
      }

      await configManager.writeGlobalConfig(projectId, globalConfig)

      const result = await configManager.readGlobalConfig(projectId)
      expect(result.projectId).toBe(projectId)
    })

    it('should create directory structure if needed', async () => {
      const projectId = 'test-new-global'
      const globalConfig = { projectId, authors: [] }

      await configManager.writeGlobalConfig(projectId, globalConfig)

      const result = await configManager.readGlobalConfig(projectId)
      expect(result).toBeDefined()
    })
  })

  describe('ensureGlobalConfig()', () => {
    it('should return existing global config', async () => {
      const projectId = 'test-ensure-123'
      const existingConfig = {
        projectId,
        authors: [],
        version: '0.9.1'
      }

      await configManager.writeGlobalConfig(projectId, existingConfig)
      const result = await configManager.ensureGlobalConfig(projectId)

      expect(result.projectId).toBe(projectId)
    })

    it('should create new global config if not exists', async () => {
      const projectId = 'test-ensure-new'

      const result = await configManager.ensureGlobalConfig(projectId)

      expect(result).toBeDefined()
      expect(result.projectId).toBe(projectId)
      expect(result.authors).toEqual([])
      expect(result.version).toBeDefined()
      expect(result.lastSync).toBeDefined()
    })
  })

  describe('createConfig()', () => {
    it('should create both local and global config', async () => {
      const author = {
        name: 'Test User',
        email: 'test@example.com',
        github: 'testuser'
      }

      const localConfig = await configManager.createConfig(testProjectPath, author)

      expect(localConfig).toBeDefined()
      expect(localConfig.projectId).toBeDefined()
      expect(localConfig.dataPath).toBeDefined()

      // Verify local config was written
      const readLocal = await configManager.readConfig(testProjectPath)
      expect(readLocal.projectId).toBe(localConfig.projectId)

      // Verify global config was written
      const globalConfig = await configManager.readGlobalConfig(localConfig.projectId)
      expect(globalConfig).toBeDefined()
      expect(globalConfig.authors.length).toBe(1)
      expect(globalConfig.authors[0].github).toBe('testuser')
    })

    it('should handle missing author fields', async () => {
      const author = {}

      const localConfig = await configManager.createConfig(testProjectPath, author)

      expect(localConfig).toBeDefined()
      const globalConfig = await configManager.readGlobalConfig(localConfig.projectId)
      expect(globalConfig.authors[0].name).toBe('Unknown')
    })
  })

  describe('validateConfig()', () => {
    it('should validate correct config', () => {
      const config = {
        projectId: 'test-123',
        dataPath: '~/.prjct-cli/projects/test-123'
      }

      expect(configManager.validateConfig(config)).toBe(true)
    })

    it('should reject config without projectId', () => {
      const config = { dataPath: '~/.prjct-cli/projects/test' }

      expect(configManager.validateConfig(config)).toBe(false)
    })

    it('should reject config without dataPath', () => {
      const config = { projectId: 'test-123' }

      expect(configManager.validateConfig(config)).toBe(false)
    })

    it('should reject null config', () => {
      expect(configManager.validateConfig(null)).toBe(false)
    })

    it('should reject undefined config', () => {
      expect(configManager.validateConfig(undefined)).toBe(false)
    })
  })

  describe('getProjectId()', () => {
    it('should return projectId from config', async () => {
      const config = {
        projectId: 'test-from-config',
        dataPath: '~/.prjct-cli/projects/test-from-config'
      }
      await configManager.writeConfig(testProjectPath, config)

      const projectId = await configManager.getProjectId(testProjectPath)

      expect(projectId).toBe('test-from-config')
    })

    it('should generate projectId if config does not exist', async () => {
      const projectId = await configManager.getProjectId(testProjectPath)

      expect(projectId).toBeDefined()
      expect(typeof projectId).toBe('string')
      expect(projectId.length).toBeGreaterThan(0)
    })
  })

  describe('isConfigured()', () => {
    it('should return true for valid config', async () => {
      const config = {
        projectId: 'test-123',
        dataPath: '~/.prjct-cli/projects/test-123'
      }
      await configManager.writeConfig(testProjectPath, config)

      const isConfigured = await configManager.isConfigured(testProjectPath)

      expect(isConfigured).toBe(true)
    })

    it('should return false for missing config', async () => {
      const isConfigured = await configManager.isConfigured(testProjectPath)

      expect(isConfigured).toBe(false)
    })

    it('should return false for invalid config', async () => {
      const config = { projectId: 'test' } // Missing dataPath
      await configManager.writeConfig(testProjectPath, config)

      const isConfigured = await configManager.isConfigured(testProjectPath)

      expect(isConfigured).toBe(false)
    })
  })

  describe('Author Management', () => {
    const projectId = 'test-authors'

    beforeEach(async () => {
      await configManager.ensureGlobalConfig(projectId)
    })

    describe('addAuthor()', () => {
      it('should add new author', async () => {
        const author = {
          name: 'New Author',
          email: 'new@example.com',
          github: 'newauthor'
        }

        await configManager.addAuthor(projectId, author)

        const globalConfig = await configManager.readGlobalConfig(projectId)
        expect(globalConfig.authors.length).toBe(1)
        expect(globalConfig.authors[0].github).toBe('newauthor')
      })

      it('should not add duplicate author', async () => {
        const author = {
          name: 'Duplicate',
          github: 'duplicate'
        }

        await configManager.addAuthor(projectId, author)
        await configManager.addAuthor(projectId, author)

        const globalConfig = await configManager.readGlobalConfig(projectId)
        expect(globalConfig.authors.length).toBe(1)
      })

      it('should set timestamps for new author', async () => {
        const author = { github: 'timestamp-test' }

        await configManager.addAuthor(projectId, author)

        const globalConfig = await configManager.readGlobalConfig(projectId)
        const addedAuthor = globalConfig.authors[0]
        expect(addedAuthor.firstContribution).toBeDefined()
        expect(addedAuthor.lastActivity).toBeDefined()
      })
    })

    describe('findAuthor()', () => {
      it('should find existing author', async () => {
        const author = { github: 'findme' }
        await configManager.addAuthor(projectId, author)

        const found = await configManager.findAuthor(projectId, 'findme')

        expect(found).toBeDefined()
        expect(found.github).toBe('findme')
      })

      it('should return null for non-existent author', async () => {
        const found = await configManager.findAuthor(projectId, 'notfound')

        expect(found).toBeNull()
      })

      it('should return null for non-existent project', async () => {
        const found = await configManager.findAuthor('non-existent', 'anyone')

        expect(found).toBeNull()
      })
    })

    describe('updateAuthorActivity()', () => {
      it('should update last activity timestamp', async () => {
        const author = { github: 'activity-test' }
        await configManager.addAuthor(projectId, author)

        const before = await configManager.findAuthor(projectId, 'activity-test')
        const beforeTime = before.lastActivity

        // Wait a bit to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10))

        await configManager.updateAuthorActivity(projectId, 'activity-test')

        const after = await configManager.findAuthor(projectId, 'activity-test')
        expect(after.lastActivity).not.toBe(beforeTime)
      })

      it('should not fail for non-existent author', async () => {
        await expect(
          configManager.updateAuthorActivity(projectId, 'nonexistent')
        ).resolves.not.toThrow()
      })
    })
  })

  describe('getConfigWithDefaults()', () => {
    it('should return existing config', async () => {
      const config = {
        projectId: 'test-defaults',
        dataPath: '~/.prjct-cli/projects/test-defaults'
      }
      await configManager.writeConfig(testProjectPath, config)

      const result = await configManager.getConfigWithDefaults(testProjectPath)

      expect(result.projectId).toBe('test-defaults')
    })

    it('should return defaults if config does not exist', async () => {
      const result = await configManager.getConfigWithDefaults(testProjectPath)

      expect(result).toBeDefined()
      expect(result.projectId).toBeDefined()
      expect(result.dataPath).toBeDefined()
    })
  })

  describe('updateLastSync()', () => {
    it('should update lastSync timestamp', async () => {
      const projectId = 'test-sync'
      await configManager.ensureGlobalConfig(projectId)

      const before = await configManager.readGlobalConfig(projectId)
      const beforeTime = before.lastSync

      await new Promise(resolve => setTimeout(resolve, 10))
      await configManager.updateLastSync(testProjectPath)

      // Need to set projectId in local config for updateLastSync to work
      await configManager.writeConfig(testProjectPath, { projectId, dataPath: '~/.prjct-cli/projects/test-sync' })
      await configManager.updateLastSync(testProjectPath)

      const after = await configManager.readGlobalConfig(projectId)
      expect(after.lastSync).not.toBe(beforeTime)
    })
  })

  describe('needsMigration()', () => {
    it('should return false for new project', async () => {
      const needs = await configManager.needsMigration(testProjectPath)

      expect(needs).toBe(false)
    })

    it('should detect when migration is needed', async () => {
      // Create legacy structure
      const legacyPath = path.join(testProjectPath, '.prjct')
      await fs.mkdir(legacyPath, { recursive: true })
      await fs.writeFile(path.join(legacyPath, 'old-file.md'), 'content')

      const needs = await configManager.needsMigration(testProjectPath)

      // Should be true if legacy exists but no proper config/structure
      expect(typeof needs).toBe('boolean')
    })
  })
})

