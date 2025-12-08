/**
 * Plugin System - Main Entry Point
 *
 * Exports all plugin-related functionality.
 *
 * @version 1.0.0
 */

const { HookSystem, HookPoints, hookSystem, hooks } = require('./hooks')
const { PluginLoader, pluginLoader } = require('./loader')
const { PluginRegistry, pluginRegistry } = require('./registry')

/**
 * Initialize the complete plugin system
 * @param {string} projectPath
 * @param {Object} config
 */
async function initializePlugins(projectPath, config = {}) {
  await pluginRegistry.initialize()
  await pluginLoader.initialize(projectPath, config)
}

/**
 * Shutdown the plugin system
 */
async function shutdownPlugins() {
  const plugins = pluginLoader.getAllPlugins()

  for (const plugin of plugins) {
    await pluginLoader.unloadPlugin(plugin.name)
  }
}

module.exports = {
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
  shutdownPlugins
}
