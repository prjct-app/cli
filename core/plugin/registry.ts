/**
 * PluginRegistry - Plugin Discovery and Management
 *
 * Central registry for plugin information, discovery, and management.
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../infrastructure/path-manager'
import { pluginLoader } from './loader'

type PluginSource = 'builtin' | 'global' | 'project'

interface PluginMetadata {
  name: string
  version: string
  description: string
  path?: string
  source?: PluginSource
}

interface PluginInfo extends PluginMetadata {
  loaded: boolean
  active: boolean
}

class PluginRegistry {
  private availablePlugins: Map<string, PluginMetadata>
  private initialized: boolean

  constructor() {
    this.availablePlugins = new Map()
    this.initialized = false
  }

  /**
   * Initialize registry and discover available plugins
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.discoverPlugins()
    this.initialized = true
  }

  /**
   * Discover all available plugins (not necessarily loaded)
   */
  async discoverPlugins(): Promise<void> {
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
   */
  async discoverFromPath(dir: string, source: PluginSource): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        try {
          let pluginPath: string

          if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
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
   */
  async readPluginMetadata(pluginPath: string): Promise<PluginMetadata | null> {
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
   */
  getAvailable(): PluginMetadata[] {
    return Array.from(this.availablePlugins.values())
  }

  /**
   * Get available plugins by source
   */
  getAvailableBySource(source: PluginSource): PluginMetadata[] {
    return this.getAvailable().filter(p => p.source === source)
  }

  /**
   * Check if a plugin is available
   */
  isAvailable(name: string): boolean {
    return this.availablePlugins.has(name)
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(name: string): boolean {
    return pluginLoader.getPlugin(name) !== null
  }

  /**
   * Get plugin info
   */
  getPluginInfo(name: string): PluginInfo | null {
    const available = this.availablePlugins.get(name)
    const loaded = pluginLoader.getPlugin(name)

    if (!available && !loaded) return null

    return {
      ...(available || { name, version: '1.0.0', description: '' }),
      loaded: !!loaded,
      active: loaded ? true : false
    }
  }

  /**
   * Install a plugin (copy to global plugins)
   */
  async install(sourcePath: string, name: string | null = null): Promise<void> {
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
   */
  async uninstall(name: string): Promise<void> {
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
    const pluginPath = plugin.path!

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
   */
  async copyDirectory(src: string, dest: string): Promise<void> {
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
   */
  generatePluginList(): string {
    const available = this.getAvailable()

    if (available.length === 0) {
      return 'No plugins installed.'
    }

    let output = '## Installed Plugins\n\n'

    const bySource: Record<PluginSource, PluginMetadata[]> = {
      builtin: [],
      global: [],
      project: []
    }

    for (const plugin of available) {
      if (plugin.source) {
        bySource[plugin.source].push(plugin)
      }
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

export {
  PluginRegistry,
  pluginRegistry,
  PluginMetadata,
  PluginInfo
}

export default { PluginRegistry, pluginRegistry }
