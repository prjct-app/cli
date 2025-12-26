/**
 * Command Registration - Bridges existing command groups to the registry
 *
 * This module registers all commands from the existing command groups
 * into the central CommandRegistry. This enables:
 * - Uniform command execution via registry.execute()
 * - Command introspection and metadata
 * - Future migration to pure handler pattern
 */

import { commandRegistry } from './registry'
import { WorkflowCommands } from './workflow'
import { PlanningCommands } from './planning'
import { ShippingCommands } from './shipping'
import { AnalyticsCommands } from './analytics'
import { MaintenanceCommands } from './maintenance'
import { AnalysisCommands } from './analysis'
import { SetupCommands } from './setup'

// Singleton instances of command groups
const workflow = new WorkflowCommands()
const planning = new PlanningCommands()
const shipping = new ShippingCommands()
const analytics = new AnalyticsCommands()
const maintenance = new MaintenanceCommands()
const analysis = new AnalysisCommands()
const setup = new SetupCommands()

/**
 * Register all commands from existing command groups
 */
export function registerAllCommands(): void {
  // Skip if already registered
  if (commandRegistry.has('work')) return

  // Workflow commands (5)
  commandRegistry.registerMethod('work', workflow, 'now', {
    group: 'workflow',
    description: 'Set or show current task',
  })
  commandRegistry.registerMethod('now', workflow, 'now', {
    group: 'workflow',
    description: 'Set or show current task (alias)',
  })
  commandRegistry.registerMethod('done', workflow, 'done', {
    group: 'workflow',
    description: 'Complete current task',
  })
  commandRegistry.registerMethod('next', workflow, 'next', {
    group: 'workflow',
    description: 'Show priority queue',
  })
  commandRegistry.registerMethod('pause', workflow, 'pause', {
    group: 'workflow',
    description: 'Pause active task',
  })
  commandRegistry.registerMethod('resume', workflow, 'resume', {
    group: 'workflow',
    description: 'Resume paused task',
  })

  // Planning commands (5)
  commandRegistry.registerMethod('init', planning, 'init', {
    group: 'planning',
    description: 'Initialize project',
  })
  commandRegistry.registerMethod('feature', planning, 'feature', {
    group: 'planning',
    description: 'Add feature to roadmap',
  })
  commandRegistry.registerMethod('bug', planning, 'bug', {
    group: 'planning',
    description: 'Report bug with auto-priority',
  })
  commandRegistry.registerMethod('idea', planning, 'idea', {
    group: 'planning',
    description: 'Capture idea',
  })
  commandRegistry.registerMethod('spec', planning, 'spec', {
    group: 'planning',
    description: 'Create specification',
  })

  // Shipping commands (1)
  commandRegistry.registerMethod('ship', shipping, 'ship', {
    group: 'shipping',
    description: 'Ship feature with quality checks',
  })

  // Analytics commands (2)
  commandRegistry.registerMethod('dash', analytics, 'dash', {
    group: 'analytics',
    description: 'Unified dashboard',
  })
  commandRegistry.registerMethod('help', analytics, 'help', {
    group: 'analytics',
    description: 'Contextual help',
  })

  // Maintenance commands (6)
  commandRegistry.registerMethod('cleanup', maintenance, 'cleanup', {
    group: 'maintenance',
    description: 'Clean temp files',
  })
  commandRegistry.registerMethod('design', maintenance, 'design', {
    group: 'maintenance',
    description: 'System design',
  })
  commandRegistry.registerMethod('recover', maintenance, 'recover', {
    group: 'maintenance',
    description: 'Recover abandoned session',
  })
  commandRegistry.registerMethod('undo', maintenance, 'undo', {
    group: 'maintenance',
    description: 'Undo last changes',
  })
  commandRegistry.registerMethod('redo', maintenance, 'redo', {
    group: 'maintenance',
    description: 'Redo undone changes',
  })
  commandRegistry.registerMethod('history', maintenance, 'history', {
    group: 'maintenance',
    description: 'View snapshot history',
  })

  // Analysis commands (2)
  commandRegistry.registerMethod('analyze', analysis, 'analyze', {
    group: 'analysis',
    description: 'Deep repo analysis',
  })
  commandRegistry.registerMethod('sync', analysis, 'sync', {
    group: 'analysis',
    description: 'Sync and generate agents',
  })

  // Setup commands (3)
  commandRegistry.registerMethod('start', setup, 'start', {
    group: 'setup',
    description: 'Interactive setup',
  })
  commandRegistry.registerMethod('setup', setup, 'setup', {
    group: 'setup',
    description: 'Configure prjct',
  })
  commandRegistry.registerMethod('migrateAll', setup, 'migrateAll', {
    group: 'setup',
    description: 'Migrate all projects',
  })
}

// Auto-register on import
registerAllCommands()

// Export command group instances for direct access (legacy support)
export {
  workflow,
  planning,
  shipping,
  analytics,
  maintenance,
  analysis,
  setup
}
