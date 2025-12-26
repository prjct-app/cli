/**
 * Granular Storage (Legacy)
 *
 * OpenCode-style per-entity storage
 * For future per-entity storage: data/{entity}s/{id}.json
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { eventBus, inferEventType } from '../events'
import type { Storage } from '../types'

class FileStorage implements Storage {
  private projectId: string
  private basePath: string

  constructor(projectId: string) {
    this.projectId = projectId
    this.basePath = path.join(os.homedir(), '.prjct-cli/projects', projectId, 'data')
  }

  /**
   * Convert path array to file path
   * ["task", "abc123"] → data/tasks/abc123.json
   * ["project"] → data/project.json
   */
  private pathToFile(pathArray: string[]): string {
    if (pathArray.length === 1) {
      return path.join(this.basePath, `${pathArray[0]}.json`)
    }

    // Pluralize first segment for directory
    const dir = pathArray[0] + 's'
    const rest = pathArray.slice(1)
    const filename = rest.join('/') + '.json'

    return path.join(this.basePath, dir, filename)
  }

  async write<T>(pathArray: string[], data: T): Promise<void> {
    const filePath = this.pathToFile(pathArray)

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // Write data
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

    // Publish event for sync
    eventBus.publish({
      type: inferEventType(pathArray, 'write'),
      path: pathArray,
      data,
      timestamp: new Date().toISOString(),
      projectId: this.projectId
    })

    // Update index if it's a collection item
    if (pathArray.length === 2) {
      await this.updateIndex(pathArray[0], pathArray[1], 'add')
    }
  }

  async read<T>(pathArray: string[]): Promise<T | null> {
    const filePath = this.pathToFile(pathArray)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch {
      return null
    }
  }

  async list(prefix: string[]): Promise<string[][]> {
    const dir = path.join(this.basePath, prefix[0] + 's')

    try {
      const files = await fs.readdir(dir)
      return files
        .filter(f => f.endsWith('.json') && f !== 'index.json')
        .map(f => [...prefix, f.replace('.json', '')])
    } catch {
      return []
    }
  }

  async delete(pathArray: string[]): Promise<void> {
    const filePath = this.pathToFile(pathArray)

    try {
      await fs.unlink(filePath)

      // Publish event for sync
      eventBus.publish({
        type: inferEventType(pathArray, 'delete'),
        path: pathArray,
        data: null,
        timestamp: new Date().toISOString(),
        projectId: this.projectId
      })

      // Update index if it's a collection item
      if (pathArray.length === 2) {
        await this.updateIndex(pathArray[0], pathArray[1], 'remove')
      }
    } catch {
      // File doesn't exist, ignore
    }
  }

  async exists(pathArray: string[]): Promise<boolean> {
    const filePath = this.pathToFile(pathArray)

    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Update collection index
   */
  private async updateIndex(collection: string, id: string, action: 'add' | 'remove'): Promise<void> {
    const indexPath = path.join(this.basePath, collection + 's', 'index.json')

    let index: { ids: string[]; updatedAt: string } = { ids: [], updatedAt: '' }

    try {
      const content = await fs.readFile(indexPath, 'utf-8')
      index = JSON.parse(content)
    } catch {
      // Index doesn't exist yet
    }

    if (action === 'add' && !index.ids.includes(id)) {
      index.ids.push(id)
    } else if (action === 'remove') {
      index.ids = index.ids.filter(i => i !== id)
    }

    index.updatedAt = new Date().toISOString()

    await fs.mkdir(path.dirname(indexPath), { recursive: true })
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
  }
}

/**
 * Get storage instance for a project
 */
export function getStorage(projectId: string): Storage {
  return new FileStorage(projectId)
}

export default { getStorage }

