/**
 * UserPromptSubmit hook — topical memory recall.
 *
 * Fires when the human submits a prompt. We extract keywords from the
 * prompt and recall matching memories, injecting up to MAX_CHARS as
 * additionalContext so Claude has the relevant prior facts without
 * needing to ask. Pure WHAT — zero "do X" prescription.
 *
 * Degrades gracefully: on any error (bindings missing, no project,
 * no matches), we emit `{}` and stay out of the way.
 */

import configManager from '../infrastructure/config-manager'
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../memory/project-memory'
import { buildHookOutput, emit, extractKeywords, readStdinSafe, safeRun } from './_shared'

const MAX_CHARS = 1500
const MAX_ENTRIES = 4

interface HookInput {
  prompt?: string
}

/**
 * Return recalled memories as markdown, or null if nothing relevant.
 * Exported for tests + for callers that want the string without the
 * hook envelope.
 */
async function buildPromptContext(projectPath: string, prompt: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  const keywords = extractKeywords(prompt)
  if (keywords.length === 0) return null

  // Single recall + in-memory filter on keyword union. The previous
  // implementation called recall() once per keyword (up to 8 times),
  // each re-running the same two SQL queries — a hot-path waste since
  // recall ignores the `topic` filter at the SQL level (it filters
  // post-fetch). One query, recency-sorted, take the first N hits.
  const lowerKeywords = keywords.map((k) => k.toLowerCase())
  let pool: MemoryEntry[] = []
  try {
    pool = projectMemory.recall(config.projectId, { limit: MAX_ENTRIES * 4 })
  } catch {
    return null
  }
  const matches: MemoryEntry[] = []
  for (const e of pool) {
    const hay = `${e.content} ${Object.values(e.tags).join(' ')}`.toLowerCase()
    if (!lowerKeywords.some((kw) => hay.includes(kw))) continue
    matches.push(e)
    if (matches.length >= MAX_ENTRIES) break
  }

  if (matches.length === 0) return null

  const lines = ['# prjct: topical memory']
  lines.push('')
  lines.push(
    `Recalled ${matches.length} entr${matches.length === 1 ? 'y' : 'ies'} matching: ${keywords.slice(0, 3).join(', ')}`
  )
  lines.push('')
  lines.push(formatMemoryMd(matches))
  lines.push('')
  lines.push('> Exposed as state. Use if relevant; ignore if not.')
  const body = lines.join('\n')
  return body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS - 20)}\n… [truncated]` : body
}

export async function runPromptHook(projectPath: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    const input = await readStdinSafe<HookInput>()
    const prompt = (input.prompt ?? '').trim()
    if (!prompt) {
      emit({})
      return
    }
    const context = await buildPromptContext(projectPath, prompt)
    emit(buildHookOutput('UserPromptSubmit', context))
  })
}
