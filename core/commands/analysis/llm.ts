/**
 * LLM Analysis Commands — `saveLlmAnalysis` + `getLlmAnalysis`.
 *
 * Extracted from the AnalysisCommands god-class so the file stays
 * under the 500-LOC limit. Both functions use only `requireProject`
 * from the guards module + the storage layer; no `this` access.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { parseLlmAnalysis } from '../../schemas/llm-analysis'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import type { MdOption } from '../../types/cli'
import type { CommandResult } from '../../types/commands'
import type { LLMAnalysis } from '../../types/llm-analysis'
import { getTimestamp } from '../../utils/date-helper'
import { execFileAsync } from '../../utils/exec'
import { failFromError } from '../../utils/md-aware'
import { mdDone, mdList, mdOutput, mdSection, mdStats } from '../../utils/md-formatter'
import { requireProject } from '../guards'

export async function saveLlmAnalysis(
  analysisInput: string,
  projectPath: string = process.cwd(),
  options: MdOption = {}
): Promise<CommandResult> {
  try {
    const proj = await requireProject(projectPath)
    if (!proj.ok) return proj.result
    const projectId = proj.value

    const resolved = await resolveAnalysisInput(analysisInput, projectPath)
    const analysis = await normalizeAnalysis(resolved.content, projectPath)

    llmAnalysisStorage.save(projectId, analysis)

    // Keep the vault in sync — without this, analysis-save-llm writes to
    // SQLite but the Obsidian vault (and its append-only archive) stays
    // stale until the next remember/capture/ship happens to fire regen.
    const { regenerateWikiDeferred } = await import('../../services/wiki-generator')
    await regenerateWikiDeferred(projectPath, projectId)

    if (options.md) {
      console.log(
        mdOutput(
          mdDone('LLM Analysis Saved'),
          mdStats({
            Input: resolved.source,
            Architecture: analysis.architecture.style,
            Patterns: analysis.patterns.length,
            'Anti-patterns': analysis.antiPatterns?.length || 0,
            'Tech debt items': analysis.techDebt?.length || 0,
            'Risk areas': analysis.riskAreas?.length || 0,
            Conventions: analysis.conventions?.length || 0,
          })
        )
      )
    } else {
      console.log(
        JSON.stringify({
          success: true,
          message: 'LLM analysis saved',
          input: resolved.source,
          stats: {
            patterns: analysis.patterns.length,
            antiPatterns: analysis.antiPatterns?.length || 0,
            techDebt: analysis.techDebt?.length || 0,
          },
        })
      )
    }

    return { success: true }
  } catch (error) {
    return failFromError(error)
  }
}

type ResolvedAnalysisInput = {
  content: string
  source: 'file' | 'inline'
}

async function resolveAnalysisInput(
  input: string,
  projectPath: string
): Promise<ResolvedAnalysisInput> {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('analysis-save-llm requires analysis text, JSON, or a file path')
  }

  const candidate = path.isAbsolute(trimmed) ? trimmed : path.resolve(projectPath, trimmed)
  try {
    const stat = await fs.stat(candidate)
    if (stat.isFile()) {
      return { content: await fs.readFile(candidate, 'utf-8'), source: 'file' }
    }
  } catch {
    // Not a readable file path; treat the argument as inline analysis text.
  }

  return { content: input, source: 'inline' }
}

async function normalizeAnalysis(input: string, projectPath: string): Promise<LLMAnalysis> {
  const text = input.trim()
  if (!text) throw new Error('analysis-save-llm received an empty analysis')

  const parsed = tryParseJson(text)
  if (parsed.ok) {
    const validation = parseLlmAnalysis(parsed.value)
    if (validation.ok) return validation.value
    return analysisFromText(
      `Structured analysis did not match the legacy schema; preserved as LLM notes.\n\n${JSON.stringify(
        parsed.value,
        null,
        2
      )}`,
      projectPath
    )
  }

  return analysisFromText(text, projectPath)
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

async function analysisFromText(text: string, projectPath: string): Promise<LLMAnalysis> {
  const insights = textToInsights(text)
  return {
    version: 1,
    commitHash: await resolveCurrentCommit(projectPath),
    analyzedAt: getTimestamp(),
    architecture: {
      style: 'unknown',
      insights: insights.slice(0, 8),
      domains: [],
    },
    patterns: [],
    antiPatterns: [],
    techDebt: [],
    riskAreas: [],
    refactorSuggestions: [],
    projectInsights: insights,
    conventions: [],
  }
}

function textToInsights(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/^\s*[-*]\s+\[[ xX]\]\s+/, '')
        .replace(/^\s*[-*]\s+/, '')
        .replace(/^\s*\d+[.)]\s+/, '')
        .trim()
    )
    .filter(Boolean)

  const unique: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(line)
    if (unique.length >= 40) break
  }

  return unique.length > 0 ? unique : [text.slice(0, 2000)]
}

async function resolveCurrentCommit(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectPath })
    return stdout.trim() || null
  } catch {
    return null
  }
}

/**
 * Get the current LLM analysis for a project.
 */
export async function getLlmAnalysis(
  projectPath: string = process.cwd(),
  options: { json?: boolean; md?: boolean } = {}
): Promise<CommandResult> {
  try {
    const proj = await requireProject(projectPath)
    if (!proj.ok) return proj.result
    const projectId = proj.value

    const analysis = llmAnalysisStorage.getActive(projectId)

    if (!analysis) {
      if (options.md) {
        console.log(mdOutput('## No LLM Analysis', '> Run `prjct sync` to generate.'))
      } else {
        console.log(JSON.stringify({ success: false, message: 'No LLM analysis found' }))
      }
      return { success: false, message: 'No LLM analysis found' }
    }

    if (options.md) {
      const sections: string[] = [mdDone(`LLM Analysis (${analysis.architecture.style})`), '']

      if (analysis.architecture.insights.length > 0) {
        sections.push(
          mdSection('Architecture Insights', mdList(analysis.architecture.insights.slice(0, 5)))
        )
      }

      if (analysis.patterns.length > 0) {
        const shown = analysis.patterns.slice(0, 8)
        sections.push(
          mdSection(
            `Patterns (${analysis.patterns.length})`,
            mdList(shown.map((p) => `**${p.name}** — ${p.description} (${p.category})`))
          )
        )
      }

      if (analysis.antiPatterns.length > 0) {
        const shown = analysis.antiPatterns.slice(0, 5)
        sections.push(
          mdSection(
            `Anti-Patterns (${analysis.antiPatterns.length})`,
            mdList(shown.map((a) => `[${a.severity}] ${a.issue} — ${a.suggestion}`))
          )
        )
      }

      if (analysis.techDebt.length > 0) {
        const shown = analysis.techDebt.slice(0, 5)
        sections.push(
          mdSection(
            `Tech Debt (${analysis.techDebt.length})`,
            mdList(shown.map((d) => `[${d.priority}/${d.effort}] ${d.description}`))
          )
        )
      }

      if (analysis.conventions.length > 0) {
        sections.push(
          mdSection(
            'Conventions',
            mdList(analysis.conventions.slice(0, 5).map((c) => `**${c.category}**: ${c.rule}`))
          )
        )
      }

      console.log(mdOutput(...sections))
    } else {
      // Cap arrays for context efficiency
      const compact = {
        ...analysis,
        patterns: analysis.patterns.slice(0, 10),
        antiPatterns: analysis.antiPatterns.slice(0, 6),
        techDebt: analysis.techDebt.slice(0, 6),
        conventions: analysis.conventions.slice(0, 6),
      }
      console.log(JSON.stringify({ success: true, analysis: compact }))
    }

    return { success: true, data: analysis }
  } catch (error) {
    return failFromError(error)
  }
}
