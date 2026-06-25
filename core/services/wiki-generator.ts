/**
 * Context Export Generator — emit an agent-readable markdown map of the
 * project's memory + shipped history to the configured vault location
 * (default: `<vault-root>/<slug>/_generated/`; see path-manager).
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
import type { WorkflowRule } from '../types/storage/extended'
import { ensureObsidianVault } from './obsidian-vault'
import type { Manifest } from './wiki/_shared'
import { sha256, slugify } from './wiki/_shared'
import { buildArchitectureBaseline } from './wiki/architecture-builder'
import { buildAnalysisArchiveFiles, collectConcepts } from './wiki/concept-builder'
import { buildDeveloperProfile } from './wiki/developer-profile-builder'
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
import {
  buildMemoryFiles,
  buildTagFiles,
  buildVaultOpts,
  formatShipBody,
} from './wiki/memory-builder'
import { buildReleasesFiles } from './wiki/release-builder'
import { buildSignalsFile, isSignalEntry } from './wiki/signals-builder'
import { buildSpecFiles } from './wiki/spec-builder'
import { buildWorkflowFiles } from './wiki/workflow-builder'
import { ensureCapturedReadme, ensureWorkflowsReadme } from './wiki-ingest'
import { resolveVaultRoot } from './wiki-migration'

// Generated output goes into a dedicated subdir so user notes placed in
// the vault root survive wiki rebuilds. Only this subdir gets touched.
const GENERATED_SUBDIR = '_generated'

/**
 * Wrap a single builder call so an exception in one builder cannot abort
 * the whole regen. Emits a structured log line per builder. The two
 * builders added by spec a50b32d1 (`crew-runs`, `team`) use this; the
 * pre-existing builders are progressively retrofitted in follow-up work.
 *
 * See spec a50b32d1 AC #15.
 */
function runBuilder<T>(
  name: string,
  fn: () => T,
  onError: (e: unknown) => T
): { result: T; ok: boolean; ms: number } {
  const start = Date.now()
  try {
    const result = fn()
    const ms = Date.now() - start
    console.log(JSON.stringify({ builder: name, status: 'ok', ms }))
    return { result, ok: true, ms }
  } catch (error) {
    const ms = Date.now() - start
    const msg = error instanceof Error ? error.message : String(error)
    console.log(JSON.stringify({ builder: name, status: 'error', ms, error: msg }))
    return { result: onError(error), ok: false, ms }
  }
}

export async function generateWiki(
  projectPath: string,
  projectId: string
): Promise<{
  wikiRoot: string
  filesWritten: number
  filesSkipped: number
  filesRemoved: number
}> {
  // Resolve vault location (new default is <vault-root>/<slug>/);
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
  const { specStorage } = await import('../storage/spec-storage')
  const { queueStorage } = await import('../storage/queue-storage')
  const { default: crewRunStorageMod } = await import('../storage/crew-run-storage')
  const { teamEnrollmentStorage } = await import('../storage/team-enrollment-storage')
  const [ships, entries, analysis, llmAnalysis, workflowRules, specs, queueTasks] =
    await Promise.all([
      shippedStorage.getAll(projectId),
      // Full set — no recall cap / latest-winner dedupe. The vault is a
      // knowledge GRAPH: every entry a current one still references must
      // exist as a navigable note, or its `[[mem_N|title]]` link rots to
      // a dangling node (mem_3233, at graph scale).
      Promise.resolve(projectMemory.allEntriesForIndex(projectId)),
      analysisStorage.getActive(projectId).catch(() => null),
      Promise.resolve(llmAnalysisStorage.getActive(projectId)).catch(() => null),
      Promise.resolve(workflowRuleStorage.getAllRules(projectId)).catch(() => [] as WorkflowRule[]),
      Promise.resolve(specStorage.list(projectId, { includeArchived: true })).catch(() => []),
      queueStorage.getTasks(projectId).catch(() => []),
    ])
  const crewRuns = (() => {
    try {
      return crewRunStorageMod.list(projectId)
    } catch {
      return []
    }
  })()
  const teamEnrollment = (() => {
    try {
      return teamEnrollmentStorage.get(projectId)
    } catch {
      return null
    }
  })()
  const declared = entries.filter((e) => e.type !== 'shipped')
  // Knowledge vs telemetry: detector output (hot-file churn, skill-miss,
  // friction) renders on ONE signals.md dashboard, never as notes/tags.
  const signals = declared.filter(isSignalEntry)
  const knowledge = declared.filter((e) => !isSignalEntry(e))

  // --- Build all file bodies in memory ---
  const files = new Map<string, string>()

  for (const ship of ships) {
    files.set(`ships/${slugify(ship.name)}.md`, formatShipBody(ship))
  }
  for (const [rel, body] of buildMemoryFiles(declared, entries)) files.set(rel, body)
  for (const [rel, body] of buildTagFiles(declared, entries)) files.set(rel, body)
  const vaultLinkOpts = buildVaultOpts(entries)
  const signalsBody = buildSignalsFile(signals, vaultLinkOpts)
  if (signalsBody) files.set('signals.md', signalsBody)
  for (const [rel, body] of buildSpecFiles(specs, queueTasks, vaultLinkOpts)) files.set(rel, body)

  // crew-runs/<slug>-<ts>.md — one file per recorded crew session.
  // Isolated via runBuilder so a malformed run row doesn't take down
  // the rest of the regen. See spec a50b32d1 AC #15.
  const crewRunResult = runBuilder(
    'crew-runs',
    () => buildCrewRunFiles(crewRuns),
    () => new Map<string, string>()
  )
  for (const [rel, body] of crewRunResult.result) files.set(rel, body)

  // team.md — single page reflecting the kv_store team:enrollment row.
  // Empty/no-enrollment is fine (we skip writing the page in that case).
  const teamResult = runBuilder(
    'team',
    () => buildTeamFile(teamEnrollment),
    () => null
  )
  if (teamResult.result !== null) files.set('team.md', teamResult.result)

  // Prefer LLM analysis (richer fields) when available, fallback to heuristic.
  const patterns = llmAnalysis?.patterns ?? analysis?.patterns ?? []
  const antiPatterns = llmAnalysis?.antiPatterns ?? analysis?.antiPatterns ?? []
  const patternsBody = buildPatternsFile(patterns, antiPatterns)
  if (patternsBody) files.set('patterns.md', patternsBody)

  // architecture.md: prefer the rich LLM analysis when present, otherwise
  // synthesize a baseline from declared memory (decisions + gotchas) so the
  // "read architecture.md first" contract holds for EVERY project, not just
  // ones that ran an LLM analysis.
  const archBody =
    (llmAnalysis ? buildArchitectureFile(llmAnalysis) : null) ?? buildArchitectureBaseline(declared)
  if (archBody) files.set('architecture.md', archBody)

  // developer.md: the "know the developer" half of the model — preferences +
  // friction synthesized so an agent acts as the developer would (RAG north star).
  const devBody = buildDeveloperProfile(declared)
  if (devBody) files.set('developer.md', devBody)

  // tech-debt / insights remain LLM-only — a deterministic baseline would be
  // too thin to be worth a page.
  if (llmAnalysis) {
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

  // Counts reflect what the vault actually renders: knowledge only —
  // telemetry is summarized by signalsCount, and tag keys are limited
  // to the keys buildTagFiles emitted a page for.
  const memoryTypeCounts = new Map<string, number>()
  for (const e of knowledge) memoryTypeCounts.set(e.type, (memoryTypeCounts.get(e.type) ?? 0) + 1)
  const tagKeyCounts = new Map<string, number>()
  for (const rel of files.keys()) {
    const m = rel.match(/^tags\/(.+)\.md$/)
    if (m) tagKeyCounts.set(m[1], 0)
  }
  for (const e of knowledge) {
    for (const k of Object.keys(e.tags)) {
      const slug = slugify(k)
      if (tagKeyCounts.has(slug)) tagKeyCounts.set(slug, (tagKeyCounts.get(slug) ?? 0) + 1)
    }
  }
  const noteRef = (e: { id: string }) => ({
    slug: vaultLinkOpts.idSlugIndex?.get(e.id) ?? '',
    title: vaultLinkOpts.idTitleIndex?.get(e.id) ?? e.id,
  })
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
      signalsCount: signals.length,
      recentDecisions: knowledge
        .filter((e) => e.type === 'decision')
        .slice(0, 5)
        .map(noteRef)
        .filter((r) => r.slug),
      topGotchas: knowledge
        .filter((e) => e.type === 'gotcha')
        .slice(0, 5)
        .map(noteRef)
        .filter((r) => r.slug),
    })
  )

  // --- Diff against manifest ---
  const oldManifest = await readManifest(generatedRoot)
  const newManifest: Manifest = {}
  let filesWritten = 0
  let filesSkipped = 0
  let filesRemoved = 0

  // Hash + classify synchronously (CPU-bound), then write only what's
  // actually changed in parallel (I/O-bound). On big vaults this drops
  // regen from O(N) serial writes to O(N/chunk) round-trips.
  const toWrite: Array<[string, string]> = []
  for (const [rel, body] of files) {
    const hash = sha256(body)
    newManifest[rel] = hash
    if (oldManifest[rel] === hash) {
      filesSkipped++
      continue
    }
    toWrite.push([rel, body])
  }

  const WRITE_CHUNK = 64
  for (let i = 0; i < toWrite.length; i += WRITE_CHUNK) {
    const slice = toWrite.slice(i, i + WRITE_CHUNK)
    await Promise.all(slice.map(([rel, body]) => writeFile(generatedRoot, rel, body)))
    filesWritten += slice.length
  }

  // Remove files that existed last run but no longer should. Same
  // chunked-parallel pattern.
  const toRemove: string[] = []
  for (const oldRel of Object.keys(oldManifest)) {
    if (newManifest[oldRel]) continue
    toRemove.push(oldRel)
  }
  for (let i = 0; i < toRemove.length; i += WRITE_CHUNK) {
    const slice = toRemove.slice(i, i + WRITE_CHUNK)
    await Promise.all(slice.map((oldRel) => removeFile(generatedRoot, oldRel)))
    filesRemoved += slice.length
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
 * Render every crew-run row to `crew-runs/<slug>-<ts>.md`. Slug is
 * spec_id || task_id || run.id; ts is the row's started_at timestamp.
 *
 * See spec a50b32d1 AC #3.
 */
function buildCrewRunFiles(
  runs: ReadonlyArray<{
    id: string
    spec_id: string | null
    task_id: string | null
    started_at: string
    ended_at: string
    implementer_summary: string
    files_touched: string[]
    reviewer_verdict: 'APPROVED' | 'CHANGES_REQUESTED'
    reviewer_notes: string | null
  }>
): Map<string, string> {
  const out = new Map<string, string>()
  for (const run of runs) {
    const slug = run.spec_id ?? run.task_id ?? run.id
    const safeTs = run.started_at.replace(/[:.]/g, '-')
    const rel = `crew-runs/${slug}-${safeTs}.md`
    const body = [
      `# Crew run — ${slug}`,
      '',
      `- **run-id**: \`${run.id}\``,
      `- **spec**: ${run.spec_id ? `\`${run.spec_id}\`` : '_(none)_'}`,
      `- **task**: ${run.task_id ? `\`${run.task_id}\`` : '_(none)_'}`,
      `- **started**: ${run.started_at}`,
      `- **ended**: ${run.ended_at}`,
      `- **verdict**: **${run.reviewer_verdict}**`,
      '',
      '## Implementer summary',
      '',
      run.implementer_summary,
      '',
      '## Files touched',
      '',
      run.files_touched.length === 0
        ? '_(none recorded)_'
        : run.files_touched.map((f) => `- \`${f}\``).join('\n'),
      ...(run.reviewer_notes ? ['', '## Reviewer notes', '', run.reviewer_notes] : []),
      '',
    ].join('\n')
    out.set(rel, body)
  }
  return out
}

/**
 * Render the team:enrollment row (if any) as a single team.md page.
 * Returns null when no enrollment is configured.
 *
 * See spec a50b32d1 AC #1.
 */
function buildTeamFile(
  enrollment: {
    required: boolean
    minVersion: string
    enrolledAt: string
    enrolledBy: string | null
  } | null
): string | null {
  if (enrollment === null) return null
  return [
    '# Team enrollment',
    '',
    `- **required**: ${enrollment.required}`,
    `- **minVersion**: \`${enrollment.minVersion}\``,
    `- **enrolledAt**: ${enrollment.enrolledAt}`,
    `- **enrolledBy**: ${enrollment.enrolledBy ?? '_(unspecified)_'}`,
    '',
    'Authoritative source: `kv_store["team:enrollment"]`. The `.prjct/team.json` file in the repo is a derived mirror written atomically by `prjct team` (the pre-commit hook reads it because it must work before prjct is installed). Do not hand-edit the mirror — run `prjct team check` to detect/heal drift.',
    '',
  ].join('\n')
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
