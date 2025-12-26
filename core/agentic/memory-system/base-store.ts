/**
 * CachedStore - Abstract base class for memory system stores
 *
 * Eliminates duplicated cache/load/save patterns across:
 * - PatternStore (~40 lines of boilerplate)
 * - SemanticMemories (~40 lines of boilerplate)
 *
 * Provides:
 * - Lazy loading with project-scoped cache
 * - Automatic directory creation on save
 * - Reset functionality
 * - Path management via pathManager
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../../infrastructure/path-manager'
import { isNotFoundError } from '../../types/fs'

export abstract class CachedStore<T> {
  private _data: T | null = null
  private _loaded: boolean = false
  private _projectId: string | null = null

  /**
   * Get the filename for this store (e.g., 'patterns.json', 'memories.json')
   */
  protected abstract getFilename(): string

  /**
   * Get default data structure when file doesn't exist
   */
  protected abstract getDefault(): T

  /**
   * Optional: subdirectory within memory folder
   */
  protected getSubdirectory(): string | null {
    return null
  }

  /**
   * Get full path for the store file
   */
  protected getPath(projectId: string): string {
    const basePath = path.join(pathManager.getGlobalProjectPath(projectId), 'memory')

    const subdir = this.getSubdirectory()
    if (subdir) {
      return path.join(basePath, subdir, this.getFilename())
    }

    return path.join(basePath, this.getFilename())
  }

  /**
   * Load data from disk (with caching)
   * Returns cached data if same project and already loaded
   */
  async load(projectId: string): Promise<T> {
    // Return cached if same project and loaded
    if (this._loaded && this._data && this._projectId === projectId) {
      return this._data
    }

    // Load from disk
    const filePath = this.getPath(projectId)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      this._data = JSON.parse(content) as T
      // Allow subclasses to normalize data after load
      this.afterLoad(this._data)
    } catch (error) {
      if (isNotFoundError(error)) {
        this._data = this.getDefault()
      } else {
        throw error
      }
    }

    this._loaded = true
    this._projectId = projectId

    return this._data
  }

  /**
   * Hook for subclasses to normalize data after loading
   * E.g., ensuring all index keys exist
   */
  protected afterLoad(_data: T): void {
    // Override in subclass if needed
  }

  /**
   * Save data to disk
   */
  async save(projectId: string): Promise<void> {
    if (!this._data) return

    const filePath = this.getPath(projectId)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(this._data, null, 2), 'utf-8')
  }

  /**
   * Get cached data without loading (may be null)
   */
  protected getData(): T | null {
    return this._data
  }

  /**
   * Set data directly (for subclass modifications)
   */
  protected setData(data: T): void {
    this._data = data
  }

  /**
   * Update data with a transform function, then save
   */
  async update(projectId: string, updater: (data: T) => T): Promise<T> {
    const data = await this.load(projectId)
    const updated = updater(data)
    this._data = updated
    await this.save(projectId)
    return updated
  }

  /**
   * Check if data has been loaded for a project
   */
  isLoaded(projectId?: string): boolean {
    if (projectId) {
      return this._loaded && this._projectId === projectId
    }
    return this._loaded
  }

  /**
   * Reset cache (forces reload on next access)
   */
  reset(): void {
    this._data = null
    this._loaded = false
    this._projectId = null
  }
}
