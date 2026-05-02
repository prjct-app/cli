/**
 * ChangelogService - Stack-aware changelog detection and updates
 *
 * Detects changelog files in the project, identifies their format,
 * and updates them with new version entries. Supports:
 * - Keep a Changelog format (default)
 * - Generic markdown changelogs
 * - Multiple file conventions (CHANGELOG.md, HISTORY.md, NEWS.md, CHANGES.md)
 */

import path from 'node:path'
import type { ChangelogDetection, ChangelogEntry, ChangelogFormat } from '../types/services.js'
import * as dateHelper from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Changelog filenames in priority order */
const CHANGELOG_FILES = ['CHANGELOG.md', 'HISTORY.md', 'NEWS.md', 'CHANGES.md'] as const

const KEEPACHANGELOG_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
`

// ============================================================================
// CHANGELOG SERVICE
// ============================================================================

export class ChangelogService {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  /**
   * Detect the changelog file and its format.
   * If no changelog exists, creates a default CHANGELOG.md.
   */
  async detect(): Promise<ChangelogDetection> {
    // Search for existing changelog in priority order
    for (const fileName of CHANGELOG_FILES) {
      const filePath = path.join(this.projectPath, fileName)
      if (await fileHelper.fileExists(filePath)) {
        const content = await fileHelper.readFile(filePath)
        const format = this.detectFormat(content)
        return { filePath, fileName, format, created: false }
      }
    }

    // No changelog found - create default
    const fileName = 'CHANGELOG.md'
    const filePath = path.join(this.projectPath, fileName)
    await fileHelper.writeFile(filePath, `${KEEPACHANGELOG_HEADER}\n`)
    return { filePath, fileName, format: 'keepachangelog', created: true }
  }

  /**
   * Add a new version entry to the changelog.
   * Prepends the entry after the header (newest first).
   *
   * Idempotent: when an entry for `entry.version` already exists in the
   * file (e.g. a prior failed ship wrote it but never committed), this
   * is a no-op. Prevents stacked duplicate entries on ship retry.
   */
  async addEntry(entry: ChangelogEntry): Promise<void> {
    const detection = await this.detect()
    const content = await fileHelper.readFile(detection.filePath)
    if (this.hasVersionEntry(content, entry.version, detection.format)) {
      return
    }
    const date = entry.date || dateHelper.formatDate(new Date())

    let updated: string
    if (detection.format === 'keepachangelog') {
      updated = this.insertKeepAChangelogEntry(content, entry, date)
    } else {
      updated = this.insertMarkdownEntry(content, entry, date)
    }

    await fileHelper.writeFile(detection.filePath, updated)
  }

  /**
   * Check whether the changelog already has a heading for `version`.
   * Keep-a-Changelog format uses `## [1.2.3] - YYYY-MM-DD`, generic
   * markdown uses `## 1.2.3 - YYYY-MM-DD`.
   */
  private hasVersionEntry(content: string, version: string, format: ChangelogFormat): boolean {
    const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern =
      format === 'keepachangelog'
        ? new RegExp(`^## \\[${escaped}\\]`, 'm')
        : new RegExp(`^## ${escaped}\\b`, 'm')
    return pattern.test(content)
  }

  /**
   * Add a feature to the changelog under the "Added" section.
   * Convenience wrapper around addEntry for the most common case.
   */
  async addFeature(version: string, description: string): Promise<void> {
    await this.addEntry({
      version,
      sections: { Added: [description] },
    })
  }

  // ==========================================================================
  // FORMAT DETECTION
  // ==========================================================================

  /**
   * Detect whether a changelog follows Keep a Changelog format or generic markdown.
   */
  private detectFormat(content: string): ChangelogFormat {
    // Keep a Changelog markers
    if (
      content.includes('Keep a Changelog') ||
      content.includes('keepachangelog.com') ||
      /^### (?:Added|Changed|Deprecated|Removed|Fixed|Security)\s*$/m.test(content)
    ) {
      return 'keepachangelog'
    }
    return 'markdown'
  }

  // ==========================================================================
  // ENTRY INSERTION
  // ==========================================================================

  /**
   * Insert an entry in Keep a Changelog format.
   * Looks for the first ## heading (version entry) and inserts before it.
   * If no version heading exists, appends after the header block.
   */
  private insertKeepAChangelogEntry(content: string, entry: ChangelogEntry, date: string): string {
    const entryText = this.formatKeepAChangelogEntry(entry, date)

    // Find the first version heading (## [...] or ## Unreleased)
    const versionHeadingIndex = content.search(/^## /m)

    if (versionHeadingIndex !== -1) {
      // Insert before the first version heading
      const before = content.slice(0, versionHeadingIndex)
      const after = content.slice(versionHeadingIndex)
      return `${before + entryText}\n${after}`
    }

    // No version headings - append after header
    return `${content.trimEnd()}\n\n${entryText}`
  }

  /**
   * Insert an entry in generic markdown format.
   * Inserts after the first heading (# Changelog, # History, etc.).
   */
  private insertMarkdownEntry(content: string, entry: ChangelogEntry, date: string): string {
    const entryText = this.formatMarkdownEntry(entry, date)

    // Find the end of the first heading line
    const firstHeadingEnd = content.indexOf('\n')

    if (firstHeadingEnd !== -1) {
      const before = content.slice(0, firstHeadingEnd + 1)
      const after = content.slice(firstHeadingEnd + 1)
      return `${before}\n${entryText}\n${after}`
    }

    // No heading found at all - prepend
    return `${entryText}\n\n${content}`
  }

  // ==========================================================================
  // ENTRY FORMATTING
  // ==========================================================================

  /**
   * Format an entry in Keep a Changelog style.
   *
   * Example output:
   * ## [1.2.3] - 2026-02-13
   *
   * ### Added
   * - New feature description
   */
  private formatKeepAChangelogEntry(entry: ChangelogEntry, date: string): string {
    const lines: string[] = [`## [${entry.version}] - ${date}`]
    lines.push('')

    if (entry.sections) {
      for (const [section, items] of Object.entries(entry.sections)) {
        lines.push(`### ${section}`)
        for (const item of items) {
          lines.push(`- ${item}`)
        }
        lines.push('')
      }
    } else if (entry.description) {
      lines.push(`### Added`)
      lines.push(`- ${entry.description}`)
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Format an entry in generic markdown style.
   *
   * Example output:
   * ## 1.2.3 - 2026-02-13
   *
   * - New feature description
   */
  private formatMarkdownEntry(entry: ChangelogEntry, date: string): string {
    const lines: string[] = [`## ${entry.version} - ${date}`]
    lines.push('')

    if (entry.sections) {
      for (const [section, items] of Object.entries(entry.sections)) {
        lines.push(`### ${section}`)
        for (const item of items) {
          lines.push(`- ${item}`)
        }
        lines.push('')
      }
    } else if (entry.description) {
      lines.push(`- ${entry.description}`)
      lines.push('')
    }

    return lines.join('\n')
  }
}
