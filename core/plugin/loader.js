/**
 * PluginLoader - Dynamic Plugin Loading for prjct-cli
 *
 * Loads plugins from:
 * 1. Built-in plugins (core/plugins/*)
 * 2. Global plugins (~/.prjct-cli/plugins/*)
 * 3. Project plugins (configured in prjct.config.json)
 *
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const { hookSystem } = require('./hooks')
const { eventBus } = require('../bus')
const pathManager = require('../infrastructure/path-manager')

/**
 * Plugin Interface
 * @typedef {Object} Plugin
 * @property {string} name - Unique plugin name
 * @property {string} version - Semver version
 * @property {string} [description] - Plugin description
 * @property {Object} [hooks] - Hook handlers
 * @property {Object} [commands] - Custom commands
 * @property {Function} [activate] - Called when plugin loads
 * @property {Function} [deactivate] - Called when plugin unloads
 */

class PluginLoader {
  constructor() {
    this.plugins = new Map()
    this.pluginPaths = new Map()
    this.initialized = false
  }

  /**
   * Initialize plugin system
   * @param {string} projectPath - Project root path
   * @param {Object} config - Project config
   */
  async initialize(projectPath, config = {}) {
    if (this.initialized) return

    this.projectPath = projectPath
    this.config = config

    // Load plugins in order
    await this.loadBuiltinPlugins()
    await this.loadGlobalPlugins()
    await this.loadProjectPlugins(config.plugins || [])

    this.initialized = true
  }

  /**
   * Load built-in plugins from core/plugins
   */
  async loadBuiltinPlugins() {
    const builtinPath = path.join(__dirname, '..', 'plugins')

    try {
      const files = await fs.readdir(builtinPath)

      for (const file of files) {
        if (file.endsWith('.js')) {
          const pluginPath = path.join(builtinPath, file)
          await this.loadPlugin(pluginPath, 'builtin')
        }
      }
    } catch {
      // No built-in plugins directory yet
    }
  }

  /**
   * Load global plugins from ~/.prjct-cli/plugins
   */
  async loadGlobalPlugins() {
    const globalPath = path.join(pathManager.getGlobalStoragePath(), 'plugins')

    try {
      const files = await fs.readdir(globalPath)

      for (const file of files) {
        if (file.endsWith('.js') || (await this.isDirectory(path.join(globalPath, file)))) {
          const pluginPath = file.endsWith('.js')
            ? path.join(globalPath, file)
            : path.join(globalPath, file, 'index.js')
          await this.loadPlugin(pluginPath, 'global')
        }
      }
    } catch {
      // No global plugins directory
    }
  }

  /**
   * Load project-specific plugins from config
   * @param {Array<string|Object>} plugins - Plugin specs from config
   */
  async loadProjectPlugins(plugins) {
    for (const spec of plugins) {
      try {
        if (typeof spec === 'string') {
          // Simple name or path
          if (spec.startsWith('file://')) {
            // Local file path
            const filePath = spec.replace('file://', '')
            const fullPath = path.resolve(this.projectPath, filePath)
            await this.loadPlugin(fullPath, 'project')
          } else if (spec.startsWith('./') || spec.startsWith('../')) {
            // Relative path
            const fullPath = path.resolve(this.projectPath, spec)
            await this.loadPlugin(fullPath, 'project')
          } else {
            // Plugin name - check if already loaded
            if (!this.plugins.has(spec)) {
              console.warn(`Plugin not found: ${spec}`)
            }
          }
        } else if (typeof spec === 'object' && spec.path) {
          // Object with path and config
          const fullPath = path.resolve(this.projectPath, spec.path)
          await this.loadPlugin(fullPath, 'project', spec.config)
        }
      } catch (error) {
        console.error(`Failed to load plugin: ${spec}`, error.message)
      }
    }
  }

  /**
   * Load a single plugin
   * @param {string} pluginPath - Path to plugin file
   * @param {string} source - 'builtin', 'global', or 'project'
   * @param {Object} config - Plugin-specific config
   */
  async loadPlugin(pluginPath, source, config = {}) {
    try {
      // Check if file exists
      await fs.access(pluginPath)

      // Require the plugin
      const plugin = require(pluginPath)

      // Validate plugin structure
      if (!plugin.name) {
        throw new Error('Plugin must have a name property')
      }

      if (this.plugins.has(plugin.name)) {
        console.warn(`Plugin already loaded: ${plugin.name}`)
        return
      }

      // Store plugin
      this.plugins.set(plugin.name, {
        ...plugin,
        source,
        config: { ...config, ...this.config[plugin.name] }
      })
      this.pluginPaths.set(plugin.name, pluginPath)

      // Register hooks
      if (plugin.hooks) {
        this.registerPluginHooks(plugin)
      }

      // Register event listeners
      if (plugin.events) {
        this.registerPluginEvents(plugin)
      }

      // Call activate if exists
      if (typeof plugin.activate === 'function') {
        await plugin.activate({
          config: this.plugins.get(plugin.name).config,
          eventBus,
          hookSystem,
          projectPath: this.projectPath
        })
      }

    } catch (error) {
      if (error.code === 'ENOENT') {
        // File not found - skip silently
      } else if (error.code === 'MODULE_NOT_FOUND') {
        console.error(`Plugin module not found: ${pluginPath}`)
      } else {
        console.error(`Failed to load plugin from ${pluginPath}:`, error.message)
      }
    }
  }

  /**
   * Register plugin hooks
   * @param {Plugin} plugin
   */
  registerPluginHooks(plugin) {
    for (const [hookPoint, handler] of Object.entries(plugin.hooks)) {
      hookSystem.register(hookPoint, handler, {
        pluginName: plugin.name,
        priority: plugin.priority || 10
      })
    }
  }

  /**
   * Register plugin event listeners
   * @param {Plugin} plugin
   */
  registerPluginEvents(plugin) {
    for (const [eventType, handler] of Object.entries(plugin.events)) {
      eventBus.on(eventType, handler)
    }
  }

  /**
   * Unload a plugin
   * @param {string} name - Plugin name
   */
  async unloadPlugin(name) {
    const plugin = this.plugins.get(name)
    if (!plugin) return

    // Call deactivate if exists
    if (typeof plugin.deactivate === 'function') {
      await plugin.deactivate()
    }

    // Unregister hooks
    hookSystem.unregisterPlugin(name)

    // Remove from loaded plugins
    this.plugins.delete(name)
    this.pluginPaths.delete(name)

    // Clear require cache
    const pluginPath = this.pluginPaths.get(name)
    if (pluginPath) {
      delete require.cache[require.resolve(pluginPath)]
    }
  }

  /**
   * Reload a plugin
   * @param {string} name - Plugin name
   */
  async reloadPlugin(name) {
    const pluginPath = this.pluginPaths.get(name)
    const plugin = this.plugins.get(name)

    if (!pluginPath || !plugin) {
      throw new Error(`Plugin not found: ${name}`)
    }

    await this.unloadPlugin(name)
    await this.loadPlugin(pluginPath, plugin.source, plugin.config)
  }

  /**
   * Get a loaded plugin
   * @param {string} name
   * @returns {Plugin|null}
   */
  getPlugin(name) {
    return this.plugins.get(name) || null
  }

  /**
   * Get all loaded plugins
   * @returns {Plugin[]}
   */
  getAllPlugins() {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugins by source
   * @param {string} source - 'builtin', 'global', or 'project'
   * @returns {Plugin[]}
   */
  getPluginsBySource(source) {
    return this.getAllPlugins().filter(p => p.source === source)
  }

  /**
   * Get custom commands from all plugins
   * @returns {Object} Map of command name to handler
   */
  getPluginCommands() {
    const commands = {}

    for (const plugin of this.plugins.values()) {
      if (plugin.commands) {
        for (const [name, handler] of Object.entries(plugin.commands)) {
          commands[name] = {
            handler,
            plugin: plugin.name,
            description: handler.description || `Command from ${plugin.name}`
          }
        }
      }
    }

    return commands
  }

  /**
   * Check if path is a directory
   * @param {string} p
   * @returns {Promise<boolean>}
   */
  async isDirectory(p) {
    try {
      const stat = await fs.stat(p)
      return stat.isDirectory()
    } catch {
      return false
    }
  }
}

// Singleton instance
const pluginLoader = new PluginLoader()

module.exports = {
  PluginLoader,
  pluginLoader
}
