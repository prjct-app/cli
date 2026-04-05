#!/usr/bin/env bun
/**
 * Import Linear CSV export into Obsidian vault as project manager.
 *
 * Structure: vault/{team}/issues/{ID}.md — flat, filter by frontmatter status.
 * Generates: Kanban board, Dataview dashboard, Homepage, KB folders.
 * Plugins: Kanban + Dataview + Calendar + Homepage.
 *
 * Usage:
 *   bun scripts/import-linear-to-obsidian.ts --vault-path ~/Obsidian/prjct-vault \
 *     --csv "/path/to/Export.csv"
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { mdFrontmatter } from '../core/utils/md-formatter'

// =============================================================================
// Config
// =============================================================================

const TEAM_TO_FOLDER: Record<string, string> = {
  prjct: 'prjct-cli',
  treevo: 'treevo',
  'Sistemas Celulares': 'sistemas-celulares',
  vōlt: 'volt',
  fluenty: 'fluenty',
}

const STATUS_MAP: Record<string, string> = {
  Done: 'done',
  Backlog: 'backlog',
  Todo: 'todo',
  'In Progress': 'in-progress',
  'In Review': 'in-review',
  Canceled: 'canceled',
  Duplicate: 'duplicate',
}

const PRIORITY_MAP: Record<string, string> = {
  Urgent: 'urgent',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
  'No priority': 'none',
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[āáàäâ]/g, 'a')
    .replace(/[ēéèëê]/g, 'e')
    .replace(/[īíìïî]/g, 'i')
    .replace(/[ōóòöô]/g, 'o')
    .replace(/[ūúùüû]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch {
    return null
  }
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseIssueRefs(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.match(/[A-Z]+-\d+/g) || []
}

// =============================================================================
// CSV Parser
// =============================================================================

function parseCSV(content: string): Record<string, string>[] {
  const rows: Record<string, string>[] = []
  const lines = content.split('\n')
  let headers: string[] = []
  let currentRow: string[] = []
  let inQuote = false
  let currentField = ''

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuote) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            currentField += '"'
            i++
          } else {
            inQuote = false
          }
        } else {
          currentField += ch
        }
      } else {
        if (ch === '"') {
          inQuote = true
        } else if (ch === ',') {
          currentRow.push(currentField)
          currentField = ''
        } else {
          currentField += ch
        }
      }
    }

    if (inQuote) {
      currentField += '\n'
      continue
    }

    currentRow.push(currentField)
    currentField = ''

    if (headers.length === 0) {
      headers = currentRow
    } else if (currentRow.length === headers.length) {
      const obj: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = currentRow[i] || ''
      }
      rows.push(obj)
    }
    currentRow = []
  }

  return rows
}

// =============================================================================
// Issue Model
// =============================================================================

interface LinearIssue {
  id: string
  team: string
  title: string
  description: string
  status: string
  estimate: string
  priority: string
  project: string
  labels: string[]
  cycle: string
  creator: string
  assignee: string
  created: string | null
  updated: string | null
  started: string | null
  completed: string | null
  canceled: string | null
  parent: string | null
  related: string[]
  blockedBy: string[]
  duplicateOf: string | null
  milestone: string
  uuid: string
}

function parseIssue(row: Record<string, string>): LinearIssue {
  return {
    id: row.ID || '',
    team: row.Team || '',
    title: row.Title || '',
    description: row.Description || '',
    status: row.Status || '',
    estimate: row.Estimate || '',
    priority: row.Priority || '',
    project: row.Project || '',
    labels: parseList(row.Labels),
    cycle: row['Cycle Name'] || '',
    creator: row.Creator || '',
    assignee: row.Assignee || '',
    created: parseDate(row.Created),
    updated: parseDate(row.Updated),
    started: parseDate(row.Started),
    completed: parseDate(row.Completed),
    canceled: parseDate(row.Canceled),
    parent: parseIssueRefs(row['Parent issue'])[0] || null,
    related: parseIssueRefs(row['Related to']),
    blockedBy: parseIssueRefs(row['Blocked by']),
    duplicateOf: parseIssueRefs(row['Duplicate of'])[0] || null,
    milestone: row['Project Milestone'] || '',
    uuid: row.UUID || '',
  }
}

// =============================================================================
// Note Builder
// =============================================================================

function buildTags(issue: LinearIssue): string[] {
  const tags: string[] = []

  // Labels → lowercase
  for (const label of issue.labels) {
    tags.push(slugify(label))
  }

  // Status
  const status = STATUS_MAP[issue.status] || slugify(issue.status)
  tags.push(`status/${status}`)

  // Priority
  const priority = PRIORITY_MAP[issue.priority] || slugify(issue.priority)
  if (priority !== 'none') tags.push(`priority/${priority}`)

  // Project
  if (issue.project) tags.push(`project/${slugify(issue.project)}`)

  return [...new Set(tags)] // dedup
}

function buildNote(issue: LinearIssue): string {
  const status = STATUS_MAP[issue.status] || slugify(issue.status)
  const priority = PRIORITY_MAP[issue.priority] || slugify(issue.priority)
  const tags = buildTags(issue)

  const fm: Record<string, unknown> = {
    id: issue.id,
    status,
    priority,
    estimate: issue.estimate ? Number(issue.estimate) || undefined : undefined,
    project: issue.project || undefined,
    assignee: issue.assignee || undefined,
    creator: issue.creator || undefined,
    cycle: issue.cycle || undefined,
    milestone: issue.milestone || undefined,
    created: issue.created,
    updated: issue.updated,
    started: issue.started || undefined,
    completed: issue.completed || undefined,
    canceled: issue.canceled || undefined,
    tags,
  }

  // Clean undefined values
  for (const key of Object.keys(fm)) {
    if (fm[key] === undefined) delete fm[key]
  }

  const sections: string[] = []
  sections.push(`# ${issue.title}`)

  if (issue.description) {
    sections.push(issue.description)
  }

  // Relationships as wikilinks
  const rels: string[] = []
  if (issue.parent) rels.push(`- Parent: [[${issue.parent}]]`)
  if (issue.related.length > 0)
    rels.push(`- Related: ${issue.related.map((r) => `[[${r}]]`).join(', ')}`)
  if (issue.blockedBy.length > 0)
    rels.push(`- Blocked by: ${issue.blockedBy.map((r) => `[[${r}]]`).join(', ')}`)
  if (issue.duplicateOf) rels.push(`- Duplicate of: [[${issue.duplicateOf}]]`)

  if (rels.length > 0) {
    sections.push(`## Relationships\n\n${rels.join('\n')}`)
  }

  return `${mdFrontmatter(fm)}\n\n${sections.join('\n\n')}`
}

// =============================================================================
// Kanban Board Generator
// =============================================================================

const PRIORITY_ORDER = ['Urgent', 'High', 'Medium', 'Low', 'No priority']

function sortByPriority(issues: LinearIssue[]): LinearIssue[] {
  return [...issues].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  )
}

function formatCard(issue: LinearIssue, checked = false): string {
  const mark = checked ? 'x' : ' '
  const priority = issue.priority !== 'No priority' ? ` @{${issue.priority.toLowerCase()}}` : ''
  const labels =
    issue.labels.length > 0 ? ` ${issue.labels.map((l) => `#${slugify(l)}`).join(' ')}` : ''
  return `- [${mark}] [[${issue.id}]] ${issue.title}${priority}${labels}`
}

/** Main board: only active work (In Progress + In Review + top Todo). Focused. */
function buildMainBoard(_teamName: string, issues: LinearIssue[]): string {
  const inProgress = sortByPriority(issues.filter((i) => i.status === 'In Progress'))
  const inReview = sortByPriority(issues.filter((i) => i.status === 'In Review'))
  const todo = sortByPriority(issues.filter((i) => i.status === 'Todo')).slice(0, 15)
  const recentDone = sortByPriority(issues.filter((i) => i.status === 'Done'))
    .sort((a, b) => (b.completed || '').localeCompare(a.completed || ''))
    .slice(0, 10)

  const lines: string[] = ['---', 'kanban-plugin: board', '---', '']

  lines.push('## In Progress')
  for (const i of inProgress) lines.push(formatCard(i))
  lines.push('')

  lines.push('## In Review')
  for (const i of inReview) lines.push(formatCard(i))
  lines.push('')

  lines.push('## Todo')
  for (const i of todo) lines.push(formatCard(i))
  lines.push('')

  lines.push('## Done')
  for (const i of recentDone) lines.push(formatCard(i, true))
  lines.push('')

  return lines.join('\n')
}

/** Per-project board: filtered to one Linear project */
function buildProjectBoard(_projectName: string, issues: LinearIssue[]): string {
  const backlog = sortByPriority(issues.filter((i) => i.status === 'Backlog'))
  const todo = sortByPriority(issues.filter((i) => i.status === 'Todo'))
  const inProgress = sortByPriority(issues.filter((i) => i.status === 'In Progress'))
  const inReview = sortByPriority(issues.filter((i) => i.status === 'In Review'))
  const done = sortByPriority(issues.filter((i) => i.status === 'Done'))
    .sort((a, b) => (b.completed || '').localeCompare(a.completed || ''))
    .slice(0, 20)

  const lines: string[] = ['---', 'kanban-plugin: board', '---', '']

  lines.push('## Backlog')
  for (const i of backlog) lines.push(formatCard(i))
  lines.push('')

  lines.push('## Todo')
  for (const i of todo) lines.push(formatCard(i))
  lines.push('')

  lines.push('## In Progress')
  for (const i of inProgress) lines.push(formatCard(i))
  lines.push('')

  lines.push('## In Review')
  for (const i of inReview) lines.push(formatCard(i))
  lines.push('')

  lines.push('## Done')
  for (const i of done) lines.push(formatCard(i, true))
  lines.push('')

  return lines.join('\n')
}

// =============================================================================
// Dashboard Generator
// =============================================================================

function buildDashboard(teamName: string, teamFolder: string): string {
  return `# ${teamName}

## Active Work
\`\`\`dataview
TABLE priority, project, assignee, estimate
FROM "${teamFolder}/issues"
WHERE status = "in-progress" OR status = "in-review"
SORT choice(priority = "urgent", 1, choice(priority = "high", 2, choice(priority = "medium", 3, 4))) ASC
\`\`\`

## Todo
\`\`\`dataview
TABLE priority, project, assignee
FROM "${teamFolder}/issues"
WHERE status = "todo"
SORT choice(priority = "urgent", 1, choice(priority = "high", 2, choice(priority = "medium", 3, 4))) ASC
\`\`\`

## Backlog (Top 25)
\`\`\`dataview
TABLE priority, project, tags
FROM "${teamFolder}/issues"
WHERE status = "backlog"
SORT choice(priority = "urgent", 1, choice(priority = "high", 2, choice(priority = "medium", 3, 4))) ASC
LIMIT 25
\`\`\`

## Recently Completed
\`\`\`dataview
TABLE priority, project, completed
FROM "${teamFolder}/issues"
WHERE status = "done"
SORT completed DESC
LIMIT 15
\`\`\`

## Stats
\`\`\`dataview
TABLE length(rows) as "Count"
FROM "${teamFolder}/issues"
WHERE id
GROUP BY status
\`\`\`

## By Project
\`\`\`dataview
TABLE length(rows) as "Total"
FROM "${teamFolder}/issues"
WHERE id AND project
GROUP BY project
\`\`\`

## By Priority
\`\`\`dataview
TABLE length(rows) as "Count"
FROM "${teamFolder}/issues"
WHERE id
GROUP BY priority
\`\`\`
`
}

// =============================================================================
// Homepage Generator
// =============================================================================

function buildHomepage(teams: Map<string, string>): string {
  const projectRows = [...teams.entries()]
    .map(
      ([team, folder]) =>
        `| ${team} | [[${folder}/_board\\|Board]] | [[${folder}/_dashboard\\|Dashboard]] |`
    )
    .join('\n')

  return `# Project Hub

## Active Work (All Projects)
\`\`\`dataview
TABLE status, priority, id as "Issue"
FROM ""
WHERE (status = "in-progress" OR status = "in-review") AND id
SORT choice(priority = "urgent", 1, choice(priority = "high", 2, choice(priority = "medium", 3, 4))) ASC
\`\`\`

## Projects
| Project | Board | Dashboard |
|---------|-------|-----------|
${projectRows}

## Global Stats
\`\`\`dataview
TABLE length(rows) as "Count"
FROM ""
WHERE id
GROUP BY status
\`\`\`

## Recently Completed (All)
\`\`\`dataview
TABLE priority, project, completed
FROM ""
WHERE status = "done" AND id
SORT completed DESC
LIMIT 10
\`\`\`
`
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  let vaultPath = ''
  let csvPath = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault-path' && args[i + 1]) vaultPath = args[++i]
    else if (args[i] === '--csv' && args[i + 1]) csvPath = args[++i]
    else if (!csvPath && !args[i].startsWith('--')) csvPath = args[i]
  }

  if (!vaultPath || !csvPath) {
    console.error(
      'Usage: bun scripts/import-linear-to-obsidian.ts --vault-path /path/to/vault --csv /path/to/export.csv'
    )
    process.exit(1)
  }

  // Read CSV
  console.log(`Reading: ${csvPath}`)
  const raw = await fs.readFile(csvPath, 'utf-8')
  const rows = parseCSV(raw)
  console.log(`Parsed: ${rows.length} issues\n`)

  // Group by team
  const teams = new Map<string, LinearIssue[]>()
  for (const row of rows) {
    const issue = parseIssue(row)
    if (!issue.id) continue
    const team = issue.team || 'unknown'
    if (!teams.has(team)) teams.set(team, [])
    teams.get(team)!.push(issue)
  }

  // Clean old data
  for (const [, folder] of Object.entries(TEAM_TO_FOLDER)) {
    const issuesDir = path.join(vaultPath, folder, 'issues')
    try {
      await fs.rm(issuesDir, { recursive: true, force: true })
    } catch {
      // doesn't exist yet
    }
  }

  // Import
  let totalImported = 0
  const teamFolders = new Map<string, string>()

  for (const [team, issues] of teams) {
    const folder = TEAM_TO_FOLDER[team] || slugify(team)
    teamFolders.set(team, folder)
    const teamPath = path.join(vaultPath, folder)

    // Create structure
    for (const dir of ['issues', 'boards', 'architecture', 'design', 'research', 'notes']) {
      await fs.mkdir(path.join(teamPath, dir), { recursive: true })
    }

    // Write issues
    for (const issue of issues) {
      const content = buildNote(issue)
      await fs.writeFile(path.join(teamPath, 'issues', `${issue.id}.md`), content, 'utf-8')
      totalImported++
    }

    // Main board: only active work (focused)
    const mainKanban = buildMainBoard(team, issues)
    await fs.writeFile(path.join(teamPath, '_board.md'), mainKanban, 'utf-8')

    // Per-project boards (filtered views — like Linear's project filter)
    const byProject = new Map<string, LinearIssue[]>()
    for (const issue of issues) {
      const proj = issue.project || 'unassigned'
      if (!byProject.has(proj)) byProject.set(proj, [])
      byProject.get(proj)!.push(issue)
    }

    let boardCount = 0
    for (const [proj, projIssues] of byProject) {
      const projSlug = slugify(proj)
      const projBoard = buildProjectBoard(proj, projIssues)
      await fs.writeFile(path.join(teamPath, 'boards', `${projSlug}.md`), projBoard, 'utf-8')
      boardCount++
    }

    // Write Dashboard
    const dashboard = buildDashboard(team, folder)
    await fs.writeFile(path.join(teamPath, '_dashboard.md'), dashboard, 'utf-8')

    console.log(`${team} (${folder}/): ${issues.length} issues, ${boardCount} boards, dashboard`)
  }

  // Write Homepage
  const homepage = buildHomepage(teamFolders)
  await fs.writeFile(path.join(vaultPath, '_home.md'), homepage, 'utf-8')

  console.log(`\n=== Import Complete ===`)
  console.log(`Total: ${totalImported} issues`)
  console.log(`Vault: ${vaultPath}`)
  console.log(`\nNext steps:`)
  console.log(`  1. Open vault in Obsidian`)
  console.log(`  2. Install plugins: Kanban, Dataview, Calendar, Homepage`)
  console.log(`  3. Set _home.md as homepage in Homepage plugin settings`)
  console.log(`  4. Graph View → Settings → Groups → add color groups by tag`)
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
