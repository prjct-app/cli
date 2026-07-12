/**
 * Find the closest registered command to a user-entered name.
 *
 * Used by:
 *   - core/index.ts → "Did you mean…" hint when an unknown command is run.
 *   - core/index.ts + core/daemon/daemon.ts → typo guard on the bare-verb
 *     auto-route to capture (a single-word near-typo of a real command
 *     should surface as "unknown" instead of being silently captured).
 *
 * Levenshtein distance ≤ 2 is the suggestion threshold — close enough to
 * catch fat-finger typos, far enough to not match unrelated short words.
 */

import { COMMANDS } from './command-data'

/**
 * Closest match across the FULL command manifest (including bin-only verbs
 * like health/crew/harness). Registry-only matching missed pure bin-only
 * names, so typos never suggested them.
 */
export function findClosestCommand(input: string): string | null {
  const needle = input.toLowerCase()
  let best: string | null = null
  let bestDist = Infinity

  for (const cmd of COMMANDS) {
    const name = cmd.name
    // Early exit: length delta > threshold cannot be within edit distance 2.
    if (Math.abs(name.length - needle.length) > 2) continue
    const dist = editDistance(needle, name.toLowerCase())
    if (dist < bestDist) {
      bestDist = dist
      best = name
      if (dist === 0) break
    }
  }

  return bestDist <= 2 ? best : null
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 2) return 3
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    }
  }
  return dp[m]![n]!
}
