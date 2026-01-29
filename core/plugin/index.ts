/**
 * Plugin System - Main Entry Point
 *
 * Exports all plugin-related functionality.
 *
 * @version 1.0.0
 */

import { HookPoints, HookSystem, hookSystem, hooks } from './hooks'
import { PluginLoader, pluginLoader } from './loader'
import { PluginRegistry, pluginRegistry } from './registry'

/**
 * Initialize the complete plugin system
 */
async function initializePlugins(
  projectPath: string,
  config: Record<string, unknown> = {}
): Promise<void> {
  await pluginRegistry.initialize()
  await pluginLoader.initialize(projectPath, config)
}

/**
 * Shutdown the plugin system
 */
async function shutdownPlugins(): Promise<void> {
  const plugins = pluginLoader.getAllPlugins()

  for (const plugin of plugins) {
    await pluginLoader.unloadPlugin(plugin.name)
  }
}

export {
  // Hook system
  HookSystem,
  HookPoints,
  hookSystem,
  hooks,
  // Plugin loader
  PluginLoader,
  pluginLoader,
  // Plugin registry
  PluginRegistry,
  pluginRegistry,
  // Convenience functions
  initializePlugins,
  shutdownPlugins,
}

export default {
  HookSystem,
  HookPoints,
  hookSystem,
  hooks,
  PluginLoader,
  pluginLoader,
  PluginRegistry,
  pluginRegistry,
  initializePlugins,
  shutdownPlugins,
}
