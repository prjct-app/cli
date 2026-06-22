import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { saveLlmAnalysis } from '../../commands/analysis/llm'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'

async function freshProject(): Promise<{ projectPath: string; projectId: string }> {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-llm-analysis-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  const projectId = `test-${Math.random().toString(36).slice(2, 10)}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  })
  await pathManager.ensureProjectStructure(projectId)
  return { projectPath, projectId }
}

const MINIMAL_VALID = {
  version: 1 as const,
  commitHash: null,
  analyzedAt: '2026-06-22T00:00:00.000Z',
  architecture: {
    style: 'modular-monolith',
    insights: ['commands route through services'],
    domains: [],
  },
  patterns: [],
  antiPatterns: [],
  techDebt: [],
  riskAreas: [],
  refactorSuggestions: [],
  projectInsights: ['Use direct imports.'],
  conventions: [],
}

describe('analysis-save-llm', () => {
  let projectPath: string
  let projectId: string
  let spies: Array<ReturnType<typeof spyOn>> = []

  beforeEach(async () => {
    ;({ projectPath, projectId } = await freshProject())
    const vaultRoot = path.join(projectPath, '.test-vault')
    spies.push(spyOn(pathManager, 'getWikiPath').mockImplementation(async () => vaultRoot))
  })

  afterEach(async () => {
    for (const s of spies) s.mockRestore()
    spies = []
    if (projectPath) await fs.rm(projectPath, { recursive: true, force: true })
  })

  test('saves freeform Markdown notes as safe LLM analysis', async () => {
    const notes = [
      '# Project notes',
      '- Commands should route through the manifest.',
      '- AGENTS.md is the universal agent surface.',
    ].join('\n')

    const result = await saveLlmAnalysis(notes, projectPath, { md: true })

    expect(result.success).toBe(true)
    const saved = llmAnalysisStorage.getActive(projectId)
    expect(saved?.architecture.style).toBe('unknown')
    expect(saved?.projectInsights).toContain('Commands should route through the manifest.')
    expect(saved?.projectInsights).toContain('AGENTS.md is the universal agent surface.')
  })

  test('reads a JSON analysis file path instead of parsing the path string as JSON', async () => {
    const file = path.join(projectPath, 'analysis.json')
    await fs.writeFile(file, JSON.stringify(MINIMAL_VALID), 'utf-8')

    const result = await saveLlmAnalysis(file, projectPath, { md: true })

    expect(result.success).toBe(true)
    const saved = llmAnalysisStorage.getActive(projectId)
    expect(saved?.architecture.style).toBe('modular-monolith')
    expect(saved?.projectInsights).toContain('Use direct imports.')
  })
})
