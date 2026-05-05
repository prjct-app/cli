/**
 * Spec file builder.
 *
 * Emits `specs/<slug>.md` per spec + `specs/_index.md` overview.
 * Pure function: takes specs in, returns a `{ relPath: body }` map. No
 * I/O — orchestrator (wiki-generator) diffs against the manifest.
 *
 * Specs ARE memory entries (type='spec') AND first-class entities in
 * the `specs` table; this builder reads from the table for the rich
 * structured fields (acceptance_criteria, scope, reviews) the memory
 * stream alone wouldn't carry.
 */

import type { QueueTask } from '../../schemas/state'
import { SPEC_REVIEWERS, type Spec } from '../../types/spec'
import { slugify } from './_shared'

export function buildSpecFiles(specs: Spec[], queueTasks: QueueTask[] = []): Map<string, string> {
  const files = new Map<string, string>()

  if (specs.length === 0) return files

  // Index queue tasks by id so per-spec rendering can resolve linked task
  // descriptions (otherwise "Linked tasks" would be a wall of UUIDs).
  const taskById = new Map<string, QueueTask>()
  for (const t of queueTasks) taskById.set(t.id, t)

  // Per-spec markdown
  const indexEntries: { slug: string; spec: Spec }[] = []
  for (const spec of specs) {
    const slug = slugify(spec.title) || spec.id.slice(0, 8)
    const rel = `specs/${slug}.md`
    files.set(rel, formatSpecBody(spec, taskById))
    indexEntries.push({ slug, spec })
  }

  // Index
  const lines: string[] = [
    '# SPECS',
    '',
    `_${specs.length} spec${specs.length === 1 ? '' : 's'} across statuses._`,
    '',
  ]

  const byStatus = new Map<string, { slug: string; spec: Spec }[]>()
  for (const entry of indexEntries) {
    const bucket = byStatus.get(entry.spec.status) ?? []
    bucket.push(entry)
    byStatus.set(entry.spec.status, bucket)
  }

  // Order: draft → reviewed → in_progress → shipped → archived
  const statusOrder = ['draft', 'reviewed', 'in_progress', 'shipped', 'archived']
  for (const status of statusOrder) {
    const bucket = byStatus.get(status)
    if (!bucket || bucket.length === 0) continue
    lines.push(`## ${status} (${bucket.length})`, '')
    for (const { slug, spec } of bucket) {
      const ac = spec.content.acceptance_criteria.length
      const tasks = spec.content.linked_tasks.length
      lines.push(
        `- [${spec.title}](${slug}.md) — ${ac} AC · ${tasks} task${tasks === 1 ? '' : 's'}`
      )
    }
    lines.push('')
  }

  files.set('specs/_index.md', `${lines.join('\n')}\n`)
  return files
}

function formatSpecBody(spec: Spec, taskById: Map<string, QueueTask>): string {
  const c = spec.content
  const lines: string[] = [
    `# ${spec.title}`,
    '',
    `**id:** \`${spec.id}\` · **status:** ${spec.status} · **created:** ${spec.createdAt}`,
  ]
  if (spec.updatedAt !== spec.createdAt) {
    lines.push(`**updated:** ${spec.updatedAt}`)
  }
  if (spec.shippedAt) {
    lines.push(`**shipped:** ${spec.shippedAt}${spec.shippedPr ? ` (PR #${spec.shippedPr})` : ''}`)
  }
  lines.push('', '## Goal', c.goal)

  if (c.eli10) lines.push('', '## ELI10', c.eli10)
  if (c.stakes) lines.push('', '## Stakes', c.stakes)

  if (c.acceptance_criteria.length > 0) {
    lines.push('', '## Acceptance criteria')
    for (const ac of c.acceptance_criteria) lines.push(`- [ ] ${ac}`)
  }

  if (c.scope.length > 0) {
    lines.push('', '## Scope')
    for (const s of c.scope) lines.push(`- ${s}`)
  }

  if (c.out_of_scope.length > 0) {
    lines.push('', '## Out of scope')
    for (const s of c.out_of_scope) lines.push(`- ${s}`)
  }

  if (c.risks.length > 0) {
    lines.push('', '## Risks')
    for (const r of c.risks) lines.push(`- **${r.risk}** — ${r.mitigation}`)
  }

  if (c.test_plan.length > 0) {
    lines.push('', '## Test plan')
    for (const t of c.test_plan) lines.push(`- ${t}`)
  }

  if (c.reviews) {
    const haveAny = SPEC_REVIEWERS.some((r) => c.reviews?.[r])
    if (haveAny) {
      lines.push('', '## Reviews')
      for (const reviewer of SPEC_REVIEWERS) {
        const r = c.reviews[reviewer]
        if (r) lines.push(`- **${reviewer}:** ${r.verdict} — ${r.notes} _(${r.ts})_`)
      }
    }
  }

  if (c.linked_tasks.length > 0) {
    lines.push('', '## Linked tasks')
    for (const id of c.linked_tasks) {
      const task = taskById.get(id)
      if (task) {
        const status = task.completed ? 'x' : ' '
        const section = task.section === 'backlog' ? ' _(backlog)_' : ''
        lines.push(`- [${status}] ${task.description}${section} · \`${id}\``)
      } else {
        // Task no longer in queue (removed/completed/archived) — render id only.
        lines.push(`- \`${id}\``)
      }
    }
  }

  if (c.notes) lines.push('', '## Notes', c.notes)

  return `${lines.join('\n')}\n`
}
