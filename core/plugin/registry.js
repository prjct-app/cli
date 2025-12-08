/**
 * PluginRegistry - Plugin Discovery and Management
 *
 * Central registry for plugin information, discovery, and management.
 *
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const pathManager = require('../infrastructure/path-manager')
const { pluginLoader } = require('./loader')

class PluginRegistry {
  constructor() {
    this.availablePlugins = new Map()
    this.initialized = false
  }

  /**
   * Initialize registry and discover available plugins
   */
  async initialize() {
    if (this.initialized) return

    await this.discoverPlugins()
    this.initialized = true
  }

  /**
   * Discover all available plugins (not necessarily loaded)
   */
  async discoverPlugins() {
    // Built-in plugins
    await this.discoverFromPath(
      path.join(__dirname, '..', 'plugins'),
      'builtin'
    )

    // Global plugins
    await this.discoverFromPath(
      path.join(pathManager.getGlobalStoragePath(), 'plugins'),
      'global'
    )
  }

  /**
   * Discover plugins from a path
   * @param {string} dir
   * @param {string} source
   */
  async discoverFromPath(dir, source) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        try {
          let pluginPath

          if (entry.isFile() && entry.name.endsWith('.js')) {
            pluginPath = path.join(dir, entry.name)
          } else if (entry.isDirectory()) {
            pluginPath = path.join(dir, entry.name, 'index.js')
          } else {
            continue
          }

          // Check if file exists
          await fs.access(pluginPath)

          // Read plugin metadata without loading
          const metadata = await this.readPluginMetadata(pluginPath)
          if (metadata) {
            this.availablePlugins.set(metadata.name, {
              ...metadata,
              path: pluginPath,
              source
            })
          }
        } catch {
          // Skip invalid plugins
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  /**
   * Read plugin metadata without fully loading
   * @param {string} pluginPath
   * @returns {Object|null}
   */
  async readPluginMetadata(pluginPath) {
    try {
      const content = await fs.readFile(pluginPath, 'utf-8')

      // Extract basic metadata from comments or exports
      const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/)
      const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/)
      const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/)

      if (nameMatch) {
        return {
          name: nameMatch[1],
          version: versionMatch ? versionMatch[1] : '1.0.0',
          description: descMatch ? descMatch[1] : ''
        }
      }

      // Fallback: try to require (might have side effects)
      const plugin = require(pluginPath)
      delete require.cache[require.resolve(pluginPath)]

      if (plugin.name) {
        return {
          name: plugin.name,
          version: plugin.version || '1.0.0',
          description: plugin.description || ''
        }
      }
    } catch {
      // Can't read metadata
    }

    return null
  }

  /**
   * Get all available plugins
   * @returns {Object[]}
   */
  getAvailable() {
    return Array.from(this.availablePlugins.values())
  }

  /**
   * Get available plugins by source
   * @param {string} source
   * @returns {Object[]}
   */
  getAvailableBySource(source) {
    return this.getAvailable().filter(p => p.source === source)
  }

  /**
   * Check if a plugin is available
   * @param {string} name
   * @returns {boolean}
   */
  isAvailable(name) {
    return this.availablePlugins.has(name)
  }

  /**
   * Check if a plugin is loaded
   * @param {string} name
   * @returns {boolean}
   */
  isLoaded(name) {
    return pluginLoader.getPlugin(name) !== null
  }

  /**
   * Get plugin info
   * @param {string} name
   * @returns {Object|null}
   */
  getPluginInfo(name) {
    const available = this.availablePlugins.get(name)
    const loaded = pluginLoader.getPlugin(name)

    if (!available && !loaded) return null

    return {
      ...(available || {}),
      loaded: !!loaded,
      active: loaded ? true : false
    }
  }

  /**
   * Install a plugin (copy to global plugins)
   * @param {string} sourcePath - Path to plugin file/directory
   * @param {string} [name] - Optional name override
   */
  async install(sourcePath, name = null) {
    const globalPluginsPath = path.join(pathManager.getGlobalStoragePath(), 'plugins')
    await fs.mkdir(globalPluginsPath, { recursive: true })

    const stat = await fs.stat(sourcePath)

    if (stat.isFile()) {
      // Single file plugin
      const pluginName = name || path.basename(sourcePath)
      const destPath = path.join(globalPluginsPath, pluginName)
      await fs.copyFile(sourcePath, destPath)
    } else if (stat.isDirectory()) {
      // Directory plugin
      const pluginName = name || path.basename(sourcePath)
      const destPath = path.join(globalPluginsPath, pluginName)
      await this.copyDirectory(sourcePath, destPath)
    }

    // Refresh available plugins
    await this.discoverPlugins()
  }

  /**
   * Uninstall a plugin
   * @param {string} name
   */
  async uninstall(name) {
    const plugin = this.availablePlugins.get(name)

    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`)
    }

    if (plugin.source === 'builtin') {
      throw new Error('Cannot uninstall built-in plugins')
    }

    // Unload if loaded
    if (this.isLoaded(name)) {
      await pluginLoader.unloadPlugin(name)
    }

    // Delete plugin file/directory
    const pluginPath = plugin.path
    const stat = await fs.stat(path.dirname(pluginPath))

    if (path.basename(pluginPath) === 'index.js') {
      // Directory plugin
      await fs.rm(path.dirname(pluginPath), { recursive: true })
    } else {
      // Single file plugin
      await fs.unlink(pluginPath)
    }

    // Remove from registry
    this.availablePlugins.delete(name)
  }

  /**
   * Copy directory recursively
   * @param {string} src
   * @param {string} dest
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  /**
   * Generate plugin list for display
   * @returns {string}
   */
  generatePluginList() {
    const available = this.getAvailable()

    if (available.length === 0) {
      return 'No plugins installed.'
    }

    let output = '## Installed Plugins\n\n'

    const bySource = {
      builtin: [],
      global: [],
      project: []
    }

    for (const plugin of available) {
      bySource[plugin.source].push(plugin)
    }

    if (bySource.builtin.length > 0) {
      output += '### Built-in\n'
      for (const p of bySource.builtin) {
        const status = this.isLoaded(p.name) ? '●' : '○'
        output += `- ${status} **${p.name}** v${p.version}\n`
        if (p.description) {
          output += `  ${p.description}\n`
        }
      }
      output += '\n'
    }

    if (bySource.global.length > 0) {
      output += '### Global\n'
      for (const p of bySource.global) {
        const status = this.isLoaded(p.name) ? '●' : '○'
        output += `- ${status} **${p.name}** v${p.version}\n`
        if (p.description) {
          output += `  ${p.description}\n`
        }
      }
      output += '\n'
    }

    output += '\n● = loaded, ○ = available'

    return output
  }
}

// Singleton instance
const pluginRegistry = new PluginRegistry()

module.exports = {
  PluginRegistry,
  pluginRegistry
}
