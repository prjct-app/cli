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

import { commandRegistry } from './registry'

export function findClosestCommand(input: string): string | null {
  const allNames = commandRegistry.getAll().map((c) => c.name)
  let best: string | null = null
  let bestDist = Infinity

  for (const name of allNames) {
    const dist = editDistance(input.toLowerCase(), name.toLowerCase())
    if (dist < bestDist) {
      bestDist = dist
      best = name
    }
  }

  return bestDist <= 2 ? best : null
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
