/**
 * Project ID resolution for MCP tools.
 *
 * Resolves projectPath → projectId using configManager.
 */

import configManager from '../infrastructure/config-manager'

export async function resolveProjectId(projectPath: string): Promise<string> {
  return configManager.getProjectId(projectPath)
}
