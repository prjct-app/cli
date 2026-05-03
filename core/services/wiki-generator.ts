/**
 * Context Export Generator — emit an agent-readable markdown map of the
 * project's memory + shipped history to the configured vault location
 * (default: `~/Documents/prjct/<slug>/_generated/`; see path-manager).
 *
 * Why: prjct already holds the answers (memories, patterns, ships). The
 * fastest way for a subagent to read them is through its native Read/Glob
 * tools, not a CLI round-trip into SQLite. A static markdown tree eats
 * zero tokens until the agent opens the specific file it cares about.
 *
 * Obsidian compatibility is a side effect, not the design goal — the
 * export happens to be a valid Obsidian vault, but no agent or workflow
 * requires Obsidian to be installed.
 *
 * Regenerated on `prjct remember`, `prjct capture`, `prjct ship`,
 * `prjct sync`, and the SessionStart / Stop hooks. Regeneration is
 * incremental (hash-per-file manifest) so the common case — one new
 * memory entry touching 1-2 files — rewrites those 1-2 files instead of
 * the whole tree.
 *
 * Implementation lives in `./wiki/`:
 *   - _shared.ts                — slugify, sha256, types, CONCEPT_FOLDERS
 *   - memory-builder.ts         — memory/<type>.md, tags/<key>.md, ships/*
 *   - llm-analysis-builder.ts   — patterns/architecture/tech-debt/insights
 *   - concept-builder.ts        — analysis/<kind>/<concept>.md + history
 *   - release-builder.ts        — releases/* (parses CHANGELOG.md)
 *   - workflow-builder.ts       — workflows/<command>.md
 *   - index-builder.ts          — index.md (top-level)
 *   - manifest.ts               — manifest read/write/sweep
 *   - fingerprint.ts            — cheap input-state hash for short-circuit
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { projectMemory } from '../memory/project-memory'
import { analysisStorage } from '../storage/analysis-storage'
import llmAnalysisStorage from '../storage/llm-analysis-storage'
import shippedStorage from '../storage/shipped-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { WorkflowRule } from '../types/storage'
import { ensureObsidianVault } from './obsidian-vault'
import type { Manifest } from './wiki/_shared'
import { sha256, slugify } from './wiki/_shared'
import { buildAnalysisArchiveFiles, collectConcepts } from './wiki/concept-builder'
import { computeRegenFingerprint, FINGERPRINT_FILE } from './wiki/fingerprint'
import { buildIndexFile } from './wiki/index-builder'
import {
  buildArchitectureFile,
  buildInsightsFile,
  buildPatternsFile,
  buildTechDebtFile,
} from './wiki/llm-analysis-builder'
import {
  MANIFEST_FILE,
  readManifest,
  removeFile,
  sweepStaleFiles,
  writeFile,
} from './wiki/manifest'
import { buildMemoryFiles, buildTagFiles, formatShipBody } from './wiki/memory-builder'
import { buildReleasesFiles } from './wiki/release-builder'
import { buildWorkflowFiles } from './wiki/workflow-builder'
import { ensureCapturedReadme, ensureWorkflowsReadme } from './wiki-ingest'
import { resolveVaultRoot } from './wiki-migration'

// Generated output goes into a dedicated subdir so user notes placed in
// the vault root survive wiki rebuilds. Only this subdir gets touched.
const GENERATED_SUBDIR = '_generated'

export async function generateWiki(
  projectPath: string,
  projectId: string
): Promise<{
  wikiRoot: string
  filesWritten: number
  filesSkipped: number
  filesRemoved: number
}> {
  // Resolve vault location (new default is ~/Documents/prjct/<slug>/);
  // pre-2.2.0 projects get their old `.prjct/wiki/` migrated in-place.
  const wikiRoot = await resolveVaultRoot(projectPath)
  const generatedRoot = path.join(wikiRoot, GENERATED_SUBDIR)
  await fs.mkdir(generatedRoot, { recursive: true })

  // Fast path: if no input has changed since the last successful regen,
  // skip the entire build/diff/sweep dance. Regen runs on every hook
  // fire (session-start, stop, remember, capture, ship, sync), so
  // short-circuiting here saves ~50ms per call on quiet sessions. The
  // manifest read keeps the `filesSkipped` contract honest for callers.
  const fingerprintPath = path.join(generatedRoot, FINGERPRINT_FILE)
  const newFingerprint = await computeRegenFingerprint(projectPath, projectId)
  const oldFingerprint = await fs.readFile(fingerprintPath, 'utf-8').catch(() => null)
  if (oldFingerprint === newFingerprint) {
    const manifest = await readManifest(generatedRoot)
    return {
      wikiRoot,
      filesWritten: 0,
      filesSkipped: Object.keys(manifest).length,
      filesRemoved: 0,
    }
  }

  // --- Gather sources ---
  const [ships, entries, analysis, llmAnalysis, workflowRules] = await Promise.all([
    shippedStorage.getAll(projectId),
    Promise.resolve(projectMemory.recall(projectId, { limit: 5000 })),
    analysisStorage.getActive(projectId).catch(() => null),
    Promise.resolve(llmAnalysisStorage.getActive(projectId)).catch(() => null),
    Promise.resolve(workflowRuleStorage.getAllRules(projectId)).catch(() => [] as WorkflowRule[]),
  ])
  const declared = entries.filter((e) => e.type !== 'shipped')

  // --- Build all file bodies in memory ---
  const files = new Map<string, string>()

  for (const ship of ships) {
    files.set(`ships/${slugify(ship.name)}.md`, formatShipBody(ship))
  }
  for (const [rel, body] of buildMemoryFiles(declared)) files.set(rel, body)
  for (const [rel, body] of buildTagFiles(declared)) files.set(rel, body)

  // Prefer LLM analysis (richer fields) when available, fallback to heuristic.
  const patterns = llmAnalysis?.patterns ?? analysis?.patterns ?? []
  const antiPatterns = llmAnalysis?.antiPatterns ?? analysis?.antiPatterns ?? []
  const patternsBody = buildPatternsFile(patterns, antiPatterns)
  if (patternsBody) files.set('patterns.md', patternsBody)

  // LLM-only sections: architecture, tech debt, risks, refactors, conventions,
  // project insights. Each lands in its own markdown file so the vault stays
  // browsable and agents can fetch them individually.
  if (llmAnalysis) {
    const archBody = buildArchitectureFile(llmAnalysis)
    if (archBody) files.set('architecture.md', archBody)

    const debtBody = buildTechDebtFile(llmAnalysis)
    if (debtBody) files.set('tech-debt.md', debtBody)

    const insightsBody = buildInsightsFile(llmAnalysis)
    if (insightsBody) files.set('insights.md', insightsBody)
  }

  // M1b: workflows visible in vault. Read-only snapshot from SQLite.
  // Bidirectional editing (drop a .md in <vault>/workflows/ → ingest)
  // happens via wiki-ingest in a separate commit.
  const workflowResult = buildWorkflowFiles(workflowRules)
  for (const [rel, body] of workflowResult.files) files.set(rel, body)
  const workflowCount = workflowResult.commandCount

  // Append-only analysis archive: one file per concept, deduped across
  // historical syncs. The manifest-diff pass never rewrites an existing
  // snapshot because its body is deterministic in the entry — this is how
  // the vault preserves trace across overwrites of the top-level
  // architecture.md / tech-debt.md / insights.md.
  const archiveEntries = llmAnalysisStorage.getAllFull(projectId)
  for (const [rel, body] of buildAnalysisArchiveFiles(archiveEntries)) files.set(rel, body)

  // Parse CHANGELOG.md (if present) so every release shows up in the
  // vault. This is usually the largest historical signal — the DB
  // tables (ships, memory, analysis) only cover what was recorded with
  // prjct, while CHANGELOG.md predates and outpaces the tool itself.
  const releasesMap = await buildReleasesFiles(projectPath)
  for (const [rel, body] of releasesMap) files.set(rel, body)
  // Exclude the index file from the count so the overview reads "181
  // releases" not "182 files".
  const releaseCount = releasesMap.size > 0 ? releasesMap.size - 1 : 0

  const memoryTypeCounts = new Map<string, number>()
  for (const e of declared) memoryTypeCounts.set(e.type, (memoryTypeCounts.get(e.type) ?? 0) + 1)
  const tagKeyCounts = new Map<string, number>()
  for (const e of declared) {
    for (const k of Object.keys(e.tags)) {
      tagKeyCounts.set(k, (tagKeyCounts.get(k) ?? 0) + 1)
    }
  }
  files.set(
    'index.md',
    buildIndexFile({
      ships,
      memoryTypeCounts,
      tagKeyCounts,
      patternsCount: patterns.length,
      antiPatternsCount: antiPatterns.length,
      llmAnalysis,
      // "Archive" used to mean per-save snapshots; now it's the concept
      // drill-down. Keep the same arg name so the signature stays stable
      // but count distinct concepts across history.
      archiveCount: collectConcepts(archiveEntries).size,
      releaseCount,
      workflowCount,
    })
  )

  // --- Diff against manifest ---
  const oldManifest = await readManifest(generatedRoot)
  const newManifest: Manifest = {}
  let filesWritten = 0
  let filesSkipped = 0
  let filesRemoved = 0

  for (const [rel, body] of files) {
    const hash = sha256(body)
    newManifest[rel] = hash
    if (oldManifest[rel] === hash) {
      filesSkipped++
      continue
    }
    await writeFile(generatedRoot, rel, body)
    filesWritten++
  }

  // Remove files that existed last run but no longer should.
  for (const oldRel of Object.keys(oldManifest)) {
    if (newManifest[oldRel]) continue
    await removeFile(generatedRoot, oldRel)
    filesRemoved++
  }

  // Filesystem-level sweep. The manifest-diff above only catches files
  // the *previous run* also knew about; that misses two real cases:
  //   1. iCloud Drive (macOS) silently creates " 2.md" / " 3.md"
  //      duplicates when it thinks there's a sync collision. They
  //      accumulate as orphans and never enter our manifest.
  //   2. A lost manifest (deleted, partial write, user copied the
  //      vault from elsewhere) means oldManifest is empty and every
  //      stale file from previous regens survives.
  // Scan the whole generated tree, and drop any .md we didn't just
  // write. `_generated/` is 100% generated — anything in there that
  // isn't in newManifest is cruft by definition.
  const swept = await sweepStaleFiles(generatedRoot, newManifest)
  filesRemoved += swept

  // Persist new manifest (always rewrite — it's tiny).
  await writeFile(generatedRoot, MANIFEST_FILE, `${JSON.stringify(newManifest, null, 2)}\n`)

  // Stamp the fingerprint last — only after a successful regen — so a
  // crash mid-build leaves the previous fingerprint in place and forces
  // the next call to redo the work.
  await writeFile(generatedRoot, FINGERPRINT_FILE, newFingerprint)

  // Top-level README pointer, written only if absent so user files aren't clobbered.
  const topReadmePath = path.join(wikiRoot, 'README.md')
  const topReadmeExists = await fs.stat(topReadmePath).then(
    () => true,
    () => false
  )
  if (!topReadmeExists) {
    await writeFile(
      wikiRoot,
      'README.md',
      `# Project Wiki\n\nOpen this folder as an Obsidian vault to browse project memory.\n\n- Auto-generated content lives in \`${GENERATED_SUBDIR}/\` — start at [${GENERATED_SUBDIR}/index.md](${GENERATED_SUBDIR}/index.md). Do not edit; it rebuilds on \`prjct ship\` / \`prjct remember\`.\n- Drop notes into \`captured/\` with frontmatter, then run \`prjct context wiki sync\` to ingest them into project memory. See [captured/README.md](captured/README.md).\n- Any other markdown you place here survives rebuilds.\n`
    )
    filesWritten++
  }

  // Seed the captured dropzone with a README so users who open the vault
  // in Obsidian discover the capture workflow. No-op if the README
  // already exists.
  await ensureCapturedReadme(projectPath)

  // M1b INPUT: seed the workflows/ dropzone with its own README so users
  // discover that they can override workflow rules from Obsidian.
  await ensureWorkflowsReadme(projectPath)

  // Make the folder a one-click-open Obsidian vault: bootstrap a
  // minimal `.obsidian/` and register the path in Obsidian's vault
  // registry so `obsidian://open?vault=<slug>` works. Best-effort; if
  // Obsidian isn't installed, this quietly no-ops.
  await ensureObsidianVault(wikiRoot).catch(() => undefined)

  return { wikiRoot, filesWritten, filesSkipped, filesRemoved }
}

/**
 * Fire-and-forget wiki regen. In daemon mode the promise keeps running
 * after the CLI response is flushed. In raw CLI mode it still awaits,
 * since process.exit() would drop the pending promise. Detected via the
 * `PRJCT_IN_DAEMON` env var set by `core/daemon/daemon.ts` on startup.
 */
export async function regenerateWikiDeferred(
  projectPath: string,
  projectId: string
): Promise<void> {
  const inDaemon = process.env.PRJCT_IN_DAEMON === '1'
  if (inDaemon) {
    // Let the CLI response flush first, then run without blocking.
    setImmediate(() => {
      generateWiki(projectPath, projectId).catch(() => {
        // Non-critical — the next regen will recover.
      })
    })
    return
  }
  try {
    await generateWiki(projectPath, projectId)
  } catch {
    // Non-critical.
  }
}
