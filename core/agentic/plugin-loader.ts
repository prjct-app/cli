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

import fs from 'node:fs/promises'
import path from 'node:path'
import { eventBus } from '../events/pub-sub'
import pathManager from '../infrastructure/path-manager'
import type { EventCallback } from '../types/bus'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { hookSystem } from './hooks'

type PluginSource = 'builtin' | 'global' | 'project'
type HookHandler = (data: unknown) => unknown | Promise<unknown>

interface Plugin {
  name: string
  version?: string
  description?: string
  hooks?: Record<string, HookHandler>
  events?: Record<string, EventCallback>
  commands?: Record<string, { handler: () => void; description?: string }>
  priority?: number
  activate?: (context: PluginContext) => Promise<void>
  deactivate?: () => Promise<void>
  source?: PluginSource
  config?: Record<string, unknown>
}

interface PluginContext {
  config: Record<string, unknown>
  eventBus: typeof eventBus
  hookSystem: typeof hookSystem
  projectPath: string
}

interface PluginSpec {
  path: string
  config?: Record<string, unknown>
}

interface CommandInfo {
  handler: () => void
  plugin: string
  description: string
}

class PluginLoader {
  private plugins: Map<string, Plugin>
  private pluginPaths: Map<string, string>
  private initialized: boolean
  private projectPath: string
  private config: Record<string, unknown>

  constructor() {
    this.plugins = new Map()
    this.pluginPaths = new Map()
    this.initialized = false
    this.projectPath = ''
    this.config = {}
  }

  /**
   * Initialize plugin system
   */
  async initialize(projectPath: string, config: Record<string, unknown> = {}): Promise<void> {
    if (this.initialized) return

    this.projectPath = projectPath
    this.config = config

    // Load plugins in order
    await this.loadBuiltinPlugins()
    await this.loadGlobalPlugins()
    await this.loadProjectPlugins((config.plugins as Array<string | PluginSpec>) || [])

    this.initialized = true
  }

  /**
   * Load built-in plugins from core/plugin/builtin
   */
  async loadBuiltinPlugins(): Promise<void> {
    const builtinPath = path.join(__dirname, 'builtin')

    try {
      const files = await fs.readdir(builtinPath)

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          const pluginPath = path.join(builtinPath, file)
          await this.loadPlugin(pluginPath, 'builtin')
        }
      }
    } catch (error) {
      // No built-in plugins directory yet - expected
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  /**
   * Load global plugins from ~/.prjct-cli/plugins
   */
  async loadGlobalPlugins(): Promise<void> {
    const globalPath = path.join(pathManager.getGlobalBasePath(), 'plugins')

    try {
      const files = await fs.readdir(globalPath)

      for (const file of files) {
        const filePath = path.join(globalPath, file)
        if (file.endsWith('.js') || file.endsWith('.ts') || (await this.isDirectory(filePath))) {
          const pluginPath =
            file.endsWith('.js') || file.endsWith('.ts')
              ? filePath
              : path.join(filePath, 'index.js')
          await this.loadPlugin(pluginPath, 'global')
        }
      }
    } catch (error) {
      // No global plugins directory - expected
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  /**
   * Load project-specific plugins from config
   */
  async loadProjectPlugins(plugins: Array<string | PluginSpec>): Promise<void> {
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
        console.error(`Failed to load plugin: ${spec}`, getErrorMessage(error))
      }
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(
    pluginPath: string,
    source: PluginSource,
    config: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      // Check if file exists
      await fs.access(pluginPath)

      // Import the plugin dynamically
      const pluginModule = await import(pluginPath)
      const plugin: Plugin = pluginModule.default || pluginModule

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
        config: { ...config, ...((this.config[plugin.name] as Record<string, unknown>) || {}) },
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
          config: this.plugins.get(plugin.name)!.config!,
          eventBus,
          hookSystem,
          projectPath: this.projectPath,
        })
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        // File not found - skip silently
      } else if (err.code === 'MODULE_NOT_FOUND') {
        console.error(`Plugin module not found: ${pluginPath}`)
      } else {
        console.error(`Failed to load plugin from ${pluginPath}:`, err.message)
      }
    }
  }

  /**
   * Register plugin hooks
   */
  registerPluginHooks(plugin: Plugin): void {
    for (const [hookPoint, handler] of Object.entries(plugin.hooks || {})) {
      hookSystem.register(hookPoint, handler, {
        pluginName: plugin.name,
        priority: plugin.priority || 10,
      })
    }
  }

  /**
   * Register plugin event listeners
   */
  registerPluginEvents(plugin: Plugin): void {
    for (const [eventType, handler] of Object.entries(plugin.events || {})) {
      eventBus.on(eventType, handler)
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(name: string): Promise<void> {
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

    // Clear plugin path reference
    this.pluginPaths.delete(name)
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(name: string): Promise<void> {
    const pluginPath = this.pluginPaths.get(name)
    const plugin = this.plugins.get(name)

    if (!pluginPath || !plugin) {
      throw new Error(`Plugin not found: ${name}`)
    }

    await this.unloadPlugin(name)
    await this.loadPlugin(pluginPath, plugin.source!, plugin.config)
  }

  /**
   * Get a loaded plugin
   */
  getPlugin(name: string): Plugin | null {
    return this.plugins.get(name) || null
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugins by source
   */
  getPluginsBySource(source: PluginSource): Plugin[] {
    return this.getAllPlugins().filter((p) => p.source === source)
  }

  /**
   * Get custom commands from all plugins
   */
  getPluginCommands(): Record<string, CommandInfo> {
    const commands: Record<string, CommandInfo> = {}

    for (const plugin of this.plugins.values()) {
      if (plugin.commands) {
        for (const [name, handler] of Object.entries(plugin.commands)) {
          commands[name] = {
            handler: handler.handler,
            plugin: plugin.name,
            description: handler.description || `Command from ${plugin.name}`,
          }
        }
      }
    }

    return commands
  }

  /**
   * Check if path is a directory
   */
  async isDirectory(p: string): Promise<boolean> {
    try {
      const stat = await fs.stat(p)
      return stat.isDirectory()
    } catch (error) {
      if (isNotFoundError(error)) {
        return false
      }
      throw error
    }
  }
}

// Singleton instance
const pluginLoader = new PluginLoader()

export { PluginLoader, pluginLoader, type Plugin }
