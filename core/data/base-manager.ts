/**
 * Base Manager
 *
 * Abstract base class for JSON file managers.
 * Provides common CRUD operations for all data types.
 */

import path from 'path'
import * as fileHelper from '../utils/file-helper'
import pathManager from '../infrastructure/path-manager'

export abstract class BaseManager<T> {
  protected filename: string
  protected cache: Map<string, T> = new Map()
  protected cacheTimeout = 5000 // 5 seconds
  protected lastRead: Map<string, number> = new Map()

  constructor(filename: string) {
    this.filename = filename
  }

  /**
   * Get file path for a project.
   */
  protected getFilePath(projectId: string): string {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    return path.join(globalPath, this.filename)
  }

  /**
   * Get default value for this data type.
   */
  protected abstract getDefault(projectId: string): T

  /**
   * Read data from JSON file.
   */
  async read(projectId: string): Promise<T> {
    const now = Date.now()
    const lastReadTime = this.lastRead.get(projectId) || 0

    // Return cached if fresh
    if (now - lastReadTime < this.cacheTimeout && this.cache.has(projectId)) {
      return this.cache.get(projectId)!
    }

    const filePath = this.getFilePath(projectId)
    const data = await fileHelper.readJson<T>(filePath, this.getDefault(projectId))

    // Update cache
    this.cache.set(projectId, data!)
    this.lastRead.set(projectId, now)

    return data!
  }

  /**
   * Write data to JSON file.
   */
  async write(projectId: string, data: T): Promise<void> {
    const filePath = this.getFilePath(projectId)

    // Ensure directory exists
    await fileHelper.ensureDir(path.dirname(filePath))

    await fileHelper.writeJson(filePath, data)

    // Update cache
    this.cache.set(projectId, data)
    this.lastRead.set(projectId, Date.now())
  }

  /**
   * Check if file exists.
   */
  async exists(projectId: string): Promise<boolean> {
    const filePath = this.getFilePath(projectId)
    return fileHelper.fileExists(filePath)
  }

  /**
   * Initialize with default data.
   */
  async initialize(projectId: string): Promise<T> {
    const data = this.getDefault(projectId)
    await this.write(projectId, data)
    return data
  }

  /**
   * Clear cache.
   */
  clearCache(projectId?: string): void {
    if (projectId) {
      this.cache.delete(projectId)
      this.lastRead.delete(projectId)
    } else {
      this.cache.clear()
      this.lastRead.clear()
    }
  }

  /**
   * Update data with a partial update.
   */
  async update(projectId: string, updater: (data: T) => T): Promise<T> {
    const current = await this.read(projectId)
    const updated = updater(current)
    await this.write(projectId, updated)
    return updated
  }
}

/**
 * Base manager for array-based JSON files.
 */
export abstract class ArrayManager<T> extends BaseManager<T[]> {
  protected getDefault(): T[] {
    return []
  }

  /**
   * Add item to array.
   */
  async add(projectId: string, item: T): Promise<T[]> {
    return this.update(projectId, (data) => [...data, item])
  }

  /**
   * Remove item by predicate.
   */
  async remove(projectId: string, predicate: (item: T) => boolean): Promise<T[]> {
    return this.update(projectId, (data) => data.filter((item) => !predicate(item)))
  }

  /**
   * Find item by predicate.
   */
  async find(projectId: string, predicate: (item: T) => boolean): Promise<T | undefined> {
    const data = await this.read(projectId)
    return data.find(predicate)
  }

  /**
   * Update item by predicate.
   */
  async updateItem(
    projectId: string,
    predicate: (item: T) => boolean,
    updater: (item: T) => T
  ): Promise<T[]> {
    return this.update(projectId, (data) =>
      data.map((item) => (predicate(item) ? updater(item) : item))
    )
  }
}
