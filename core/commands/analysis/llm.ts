/**
 * LLM Analysis Commands — `saveLlmAnalysis` + `getLlmAnalysis`.
 *
 * Extracted from the AnalysisCommands god-class so the file stays
 * under the 500-LOC limit. Both functions use only `requireProject`
 * from the guards module + the storage layer; no `this` access.
 */

import { parseLlmAnalysis } from '../../schemas/llm-analysis'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import type { MdOption } from '../../types/cli'
import type { CommandResult } from '../../types/commands'
import { failFromError } from '../../utils/md-aware'
import { mdDone, mdList, mdOutput, mdSection, mdStats } from '../../utils/md-formatter'
import { requireProject } from '../guards'

export async function saveLlmAnalysis(
  analysisJson: string,
  projectPath: string = process.cwd(),
  options: MdOption = {}
): Promise<CommandResult> {
  try {
    const proj = await requireProject(projectPath)
    if (!proj.ok) return proj.result
    const projectId = proj.value

    let parsed: unknown
    try {
      parsed = JSON.parse(analysisJson)
    } catch (error) {
      return {
        success: false,
        error: `Invalid JSON: ${error instanceof Error ? error.message : 'parse failed'}`,
      }
    }

    const validation = parseLlmAnalysis(parsed)
    if (!validation.ok) {
      return {
        success: false,
        error: `Invalid LLM analysis schema: ${validation.error}`,
      }
    }
    const analysis = validation.value

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
