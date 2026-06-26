#!/usr/bin/env bun
/**
 * Retrieval eval entrypoint. Bun resolves the TS module directly.
 *   bun run scripts/eval-retrieval.mjs <projectId> [k]
 */
import { runEval } from '../core/eval/run.ts'

const projectId = process.argv[2]
const k = process.argv[3] ? Number(process.argv[3]) : 10
if (!projectId) {
  console.error('usage: bun run scripts/eval-retrieval.mjs <projectId> [k]')
  process.exit(1)
}
runEval(projectId, k).catch((err) => {
  console.error(err)
  process.exit(1)
})
