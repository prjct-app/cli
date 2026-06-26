/**
 * Display helpers for friction-detector lessons.
 *
 * New detector output is structured:
 *   [category] Lesson: ...
 *   Next action: ...
 *
 * Older rows started with:
 *   [category] User pushback: "..."
 *
 * Keep both readable so existing SQLite rows do not need migration.
 */

import { truncate } from './_shared'

function compact(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

export function summarizeFrictionLesson(content: string, max = 220): string {
  const lines = content.split('\n').map(compact).filter(Boolean)

  const first = lines[0] ?? compact(content)
  const lesson = first.match(/^\[[^\]]+\]\s+Lesson:\s*(.+)$/i)?.[1]
  if (!lesson) return truncate(first, max)

  const nextAction = lines
    .find((line) => /^Next action:\s*/i.test(line))
    ?.replace(/^Next action:\s*/i, '')

  const summary = nextAction ? `${lesson} Next: ${nextAction}` : lesson
  return truncate(summary, max)
}
