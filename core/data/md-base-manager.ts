/**
 * MD Base Manager
 *
 * Abstract base class for MD file managers.
 * MD-First Architecture: MD is the source of truth.
 *
 * Each concrete manager must implement:
 * - parse(content: string): T - Convert MD to schema
 * - serialize(data: T): string - Convert schema to MD
 * - getDefault(projectId: string): T - Default value when file doesn't exist
 */

import path from 'path'
import fs from 'fs/promises'
import * as fileHelper from '../utils/file-helper'
import pathManager from '../infrastructure/path-manager'

export abstract class MdBaseManager<T> {
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
   * Parse MD content to schema.
   */
  protected abstract parse(content: string): T

  /**
   * Serialize schema to MD content.
   */
  protected abstract serialize(data: T): string

  /**
   * Read data from MD file.
   */
  async read(projectId: string): Promise<T> {
    const now = Date.now()
    const lastReadTime = this.lastRead.get(projectId) || 0

    // Return cached if fresh
    if (now - lastReadTime < this.cacheTimeout && this.cache.has(projectId)) {
      return this.cache.get(projectId)!
    }

    const filePath = this.getFilePath(projectId)
    const content = await fileHelper.readFile(filePath, '')

    const data = content.trim() ? this.parse(content) : this.getDefault(projectId)

    // Update cache
    this.cache.set(projectId, data)
    this.lastRead.set(projectId, now)

    return data
  }

  /**
   * Write data to MD file using atomic write (prevents partial writes).
   */
  async write(projectId: string, data: T): Promise<void> {
    const filePath = this.getFilePath(projectId)
    const content = this.serialize(data)

    // Ensure directory exists
    await fileHelper.ensureDir(path.dirname(filePath))

    // Atomic write: write to temp file, then rename
    const tempPath = `${filePath}.${Date.now()}.tmp`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, filePath)

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
   * Update data with an updater function (read-modify-write).
   */
  async update(projectId: string, updater: (data: T) => T): Promise<T> {
    const current = await this.read(projectId)
    const updated = updater(current)
    await this.write(projectId, updated)
    return updated
  }

  /**
   * Get raw MD content without parsing.
   */
  async readRaw(projectId: string): Promise<string> {
    const filePath = this.getFilePath(projectId)
    return fileHelper.readFile(filePath, '')
  }

  /**
   * Write raw MD content without serialization.
   */
  async writeRaw(projectId: string, content: string): Promise<void> {
    const filePath = this.getFilePath(projectId)
    await fileHelper.ensureDir(path.dirname(filePath))
    await fileHelper.atomicWrite(filePath, content)
    this.clearCache(projectId)
  }
}

/**
 * Base manager for array-based MD files (like shipped, ideas).
 */
export abstract class MdArrayManager<T> extends MdBaseManager<T[]> {
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
   * Prepend item to array (add at beginning).
   */
  async prepend(projectId: string, item: T): Promise<T[]> {
    return this.update(projectId, (data) => [item, ...data])
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
