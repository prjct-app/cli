/**
 * ContextSelector - Task-based context selection for Smart Context
 *
 * When user runs `p. task "add payment webhook"`:
 * 1. Detects relevant domains from task description
 * 2. Filters files to only those in matching domains
 * 3. Returns precise, focused context
 *
 * Benefits:
 * - 70-90% reduction in context tokens
 * - More relevant responses from LLM
 * - Faster task understanding
 */

import { CHARS_PER_TOKEN, DEFAULT_TOKEN_BUDGET } from '../constants/token'
import { indexStorage } from '../storage/index-storage'
import type { ContextSelectionOptions, SelectedContext } from '../types/services.js'
import type { DomainDefinition, ScoredFile } from '../types/storage.js'

// ============================================================================
// CONTEXT SELECTOR CLASS
// ============================================================================

export class ContextSelector {
  // ==========================================================================
  // MAIN METHODS
  // ==========================================================================

  /**
   * Select relevant files for a task description
   */
  async selectForTask(
    taskDescription: string,
    projectId: string,
    options: ContextSelectionOptions = {}
  ): Promise<SelectedContext> {
    const maxFiles = options.maxFiles || 50
    const minScore = options.minScore || 30
    const includeGeneral = options.includeGeneral !== false
    const tokenBudget = options.tokenBudget || DEFAULT_TOKEN_BUDGET

    // Load index and categories
    const [index, domainsData, categoriesCache] = await Promise.all([
      indexStorage.readIndex(projectId),
      indexStorage.readDomains(projectId),
      indexStorage.readCategories(projectId),
    ])

    if (!index || !domainsData || !categoriesCache) {
      // No categorization data available, return all relevant files
      return this.fallbackSelection(index?.relevantFiles || [], options)
    }

    // Detect domains from task description
    const detectedDomains = this.detectTaskDomains(taskDescription, domainsData.domains)

    // Get files for detected domains
    const selectedPaths = new Set<string>()

    for (const domain of detectedDomains) {
      const domainFiles = categoriesCache.domainIndex[domain] || []
      for (const filePath of domainFiles) {
        selectedPaths.add(filePath)
      }
    }

    // Optionally include 'general' files
    if (includeGeneral && categoriesCache.domainIndex.general) {
      // Add top general files by score
      const generalFiles = categoriesCache.domainIndex.general.slice(0, 10)
      for (const filePath of generalFiles) {
        selectedPaths.add(filePath)
      }
    }

    // Filter to only files in the index with score >= minScore
    const selectedFiles = index.relevantFiles.filter(
      (f) => selectedPaths.has(f.path) && f.score >= minScore
    )

    // Sort by score and limit
    selectedFiles.sort((a, b) => b.score - a.score)

    // Apply token budget
    let estimatedTokens = 0
    const budgetedFiles: ScoredFile[] = []

    for (const file of selectedFiles) {
      const fileTokens = Math.ceil(file.size / CHARS_PER_TOKEN)
      if (estimatedTokens + fileTokens > tokenBudget) {
        break
      }
      if (budgetedFiles.length >= maxFiles) {
        break
      }
      budgetedFiles.push(file)
      estimatedTokens += fileTokens
    }

    // Calculate metrics
    const totalTokens = Math.ceil(
      index.relevantFiles.reduce((sum, f) => sum + f.size, 0) / CHARS_PER_TOKEN
    )
    const compressionRate = totalTokens > 0 ? (totalTokens - estimatedTokens) / totalTokens : 0

    return {
      files: budgetedFiles,
      domains: detectedDomains,
      metrics: {
        totalFiles: index.relevantFiles.length,
        selectedFiles: budgetedFiles.length,
        compressionRate,
        estimatedTokensSaved: totalTokens - estimatedTokens,
      },
    }
  }

  /**
   * Detect domains from task description using project-specific domains only.
   */
  detectTaskDomains(description: string, projectDomains: DomainDefinition[]): string[] {
    const normalizedDesc = description.toLowerCase()
    const detectedDomains = new Set<string>()

    // Check against project-specific domains (real project data)
    for (const domain of projectDomains) {
      // Check domain name
      if (normalizedDesc.includes(domain.name.toLowerCase())) {
        detectedDomains.add(domain.name)
        continue
      }

      // Check domain keywords
      for (const keyword of domain.keywords) {
        if (normalizedDesc.includes(keyword.toLowerCase())) {
          detectedDomains.add(domain.name)
          break
        }
      }
    }

    return Array.from(detectedDomains)
  }

  /**
   * Filter files by specific domains
   */
  async filterByDomains(
    projectId: string,
    domains: string[],
    files?: ScoredFile[]
  ): Promise<ScoredFile[]> {
    const categoriesCache = await indexStorage.readCategories(projectId)
    if (!categoriesCache) {
      return files || []
    }

    // Get all file paths for requested domains
    const domainFilePaths = new Set<string>()
    for (const domain of domains) {
      const domainFiles = categoriesCache.domainIndex[domain] || []
      for (const filePath of domainFiles) {
        domainFilePaths.add(filePath)
      }
    }

    // If files provided, filter them; otherwise use all categorized files
    if (files) {
      return files.filter((f) => domainFilePaths.has(f.path))
    }

    // Load index and filter
    const index = await indexStorage.readIndex(projectId)
    if (!index) {
      return []
    }

    return index.relevantFiles.filter((f) => domainFilePaths.has(f.path))
  }

  /**
   * Get domains for a specific file
   */
  async getFilesDomains(projectId: string, filePaths: string[]): Promise<Map<string, string[]>> {
    return indexStorage.getFileCategories(projectId, filePaths)
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Fallback selection when no categorization data available
   */
  private fallbackSelection(
    files: ScoredFile[],
    options: ContextSelectionOptions
  ): SelectedContext {
    const maxFiles = options.maxFiles || 50
    const minScore = options.minScore || 30
    const tokenBudget = options.tokenBudget || DEFAULT_TOKEN_BUDGET

    // Filter and sort by score
    const filteredFiles = files.filter((f) => f.score >= minScore).sort((a, b) => b.score - a.score)

    // Apply token budget
    let estimatedTokens = 0
    const selectedFiles: ScoredFile[] = []

    for (const file of filteredFiles) {
      const fileTokens = Math.ceil(file.size / CHARS_PER_TOKEN)
      if (estimatedTokens + fileTokens > tokenBudget) {
        break
      }
      if (selectedFiles.length >= maxFiles) {
        break
      }
      selectedFiles.push(file)
      estimatedTokens += fileTokens
    }

    const totalTokens = Math.ceil(files.reduce((sum, f) => sum + f.size, 0) / CHARS_PER_TOKEN)

    return {
      files: selectedFiles,
      domains: [], // No domain data available
      metrics: {
        totalFiles: files.length,
        selectedFiles: selectedFiles.length,
        compressionRate: totalTokens > 0 ? (totalTokens - estimatedTokens) / totalTokens : 0,
        estimatedTokensSaved: totalTokens - estimatedTokens,
      },
    }
  }
}

export const contextSelector = new ContextSelector()
export default ContextSelector
