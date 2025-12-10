/**
 * Analysis Manager
 *
 * Manages analysis.json - repository analysis data.
 */

import { BaseManager } from './base-manager'
import type { AnalysisSchema, CodePattern, AntiPattern } from '../schemas'
import { DEFAULT_ANALYSIS } from '../schemas'

class AnalysisManager extends BaseManager<AnalysisSchema> {
  constructor() {
    super('analysis.json')
  }

  protected getDefault(projectId: string): AnalysisSchema {
    return {
      ...DEFAULT_ANALYSIS,
      projectId,
      analyzedAt: new Date().toISOString()
    }
  }

  async getAnalysis(projectId: string): Promise<AnalysisSchema> {
    return this.read(projectId)
  }

  async updateAnalysis(
    projectId: string,
    updates: Partial<Omit<AnalysisSchema, 'projectId'>>
  ): Promise<AnalysisSchema> {
    return this.update(projectId, (analysis) => ({
      ...analysis,
      ...updates,
      analyzedAt: new Date().toISOString()
    }))
  }

  async setLanguages(projectId: string, languages: string[]): Promise<AnalysisSchema> {
    return this.updateAnalysis(projectId, { languages })
  }

  async setFrameworks(projectId: string, frameworks: string[]): Promise<AnalysisSchema> {
    return this.updateAnalysis(projectId, { frameworks })
  }

  async addPattern(projectId: string, pattern: CodePattern): Promise<AnalysisSchema> {
    return this.update(projectId, (analysis) => ({
      ...analysis,
      patterns: [...analysis.patterns, pattern],
      analyzedAt: new Date().toISOString()
    }))
  }

  async addAntiPattern(projectId: string, antiPattern: AntiPattern): Promise<AnalysisSchema> {
    return this.update(projectId, (analysis) => ({
      ...analysis,
      antiPatterns: [...analysis.antiPatterns, antiPattern],
      analyzedAt: new Date().toISOString()
    }))
  }

  async setPatterns(projectId: string, patterns: CodePattern[]): Promise<AnalysisSchema> {
    return this.updateAnalysis(projectId, { patterns })
  }

  async setAntiPatterns(projectId: string, antiPatterns: AntiPattern[]): Promise<AnalysisSchema> {
    return this.updateAnalysis(projectId, { antiPatterns })
  }

  async getPatterns(projectId: string): Promise<CodePattern[]> {
    const analysis = await this.read(projectId)
    return analysis.patterns
  }

  async getAntiPatterns(projectId: string): Promise<AntiPattern[]> {
    const analysis = await this.read(projectId)
    return analysis.antiPatterns
  }
}

export const analysisManager = new AnalysisManager()
export default analysisManager
