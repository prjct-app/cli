/**
 * Design Commands
 *
 * System architecture, API, and component design operations.
 */

import path from 'path'

import type { CommandResult, DesignOptions } from '../types'
import {
  pathManager,
  configManager,
  fileHelper,
  dateHelper,
  out
} from '../base'
import { memoryService } from '../../services'

/**
 * /p:design - Design system architecture, APIs, and components
 */
export async function design(
  target: string | null = null,
  options: DesignOptions = {},
  projectPath: string = process.cwd()
): Promise<CommandResult> {
  try {
    const designType = options.type || 'architecture'
    const validTypes = ['architecture', 'api', 'component', 'database', 'flow']

    if (!validTypes.includes(designType)) {
      out.fail(`invalid type: ${designType}`)
      return { success: false, error: 'Invalid design type' }
    }

    const designTarget = target || 'system'
    out.spin(`designing ${designType}...`)

    const projectId = await configManager.getProjectId(projectPath)
    const designsPath = path.join(
      pathManager.getGlobalProjectPath(projectId!),
      'planning',
      'designs'
    )
    await fileHelper.ensureDir(designsPath)

    let designContent = ''

    switch (designType) {
      case 'architecture':
        designContent = `# Architecture Design: ${designTarget}\n\n*Use templates/design/architecture.md for full design*\n`
        break
      case 'api':
        designContent = `# API Design: ${designTarget}\n\n*Use templates/design/api.md for full design*\n`
        break
      case 'component':
        designContent = `# Component Design: ${designTarget}\n\n*Use templates/design/component.md for full design*\n`
        break
      case 'database':
        designContent = `# Database Design: ${designTarget}\n\n*Use templates/design/database.md for full design*\n`
        break
      case 'flow':
        designContent = `# Flow Design: ${designTarget}\n\n*Use templates/design/flow.md for full design*\n`
        break
    }

    const designFileName = `${designType}-${designTarget.toLowerCase().replace(/\s+/g, '-')}.md`
    const designFilePath = path.join(designsPath, designFileName)
    await fileHelper.writeFile(designFilePath, designContent)

    await memoryService.log(projectPath, 'design_created', {
      type: designType,
      target: designTarget,
      timestamp: dateHelper.getTimestamp(),
    })

    out.done(`${designType} design created`)
    return { success: true, designPath: designFilePath, type: designType, target: designTarget }
  } catch (error) {
    out.fail((error as Error).message)
    return { success: false, error: (error as Error).message }
  }
}
