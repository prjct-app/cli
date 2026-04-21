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
export async function buildPromptContext(
  projectPath: string,
  prompt: string
): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  const keywords = extractKeywords(prompt)
  if (keywords.length === 0) return null

  // Try each keyword as a topic and dedupe by entry id. Pulling
  // per-keyword keeps the recall targeted — a single wide search
  // would flood with noise on long prompts.
  const seen = new Set<string>()
  const matches: MemoryEntry[] = []
  for (const kw of keywords) {
    let entries: MemoryEntry[] = []
    try {
      entries = projectMemory.recall(config.projectId, { topic: kw, limit: MAX_ENTRIES })
    } catch {
      return null
    }
    for (const e of entries) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      matches.push(e)
      if (matches.length >= MAX_ENTRIES) break
    }
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
