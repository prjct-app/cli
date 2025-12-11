import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const SETTINGS_PATH = join(homedir(), '.prjct-cli', 'settings.json')
const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

// Complete JSON Schema definitions for new architecture
// JSON is source of truth, MD is generated for Claude
// ENRICHED SCHEMAS - Extract all rich data from MD files
const SCHEMAS = {
  state: `{
  "currentTask": {
    "id": "task_xxxxxxxx - unique ID",
    "description": "string",
    "startedAt": "ISO-8601 timestamp",
    "sessionId": "sess_xxxxxxxx",
    "featureId": "feat_xxxxxxxx (optional)"
  } | null,
  "previousTask": {
    "id": "string",
    "description": "string",
    "status": "paused",
    "startedAt": "ISO-8601",
    "pausedAt": "ISO-8601"
  } | null (optional - for paused tasks),
  "lastUpdated": "ISO-8601 timestamp"
}`,

  queue: `{
  "tasks": [{
    "id": "task_xxxxxxxx",
    "description": "string",
    "priority": "critical|high|medium|low",
    "type": "feature|bug|improvement|chore (detect from emoji 🐛=bug)",
    "featureId": "feat_xxx (optional)",
    "originFeature": "string - from (from: Feature Name) pattern (optional)",
    "completed": boolean,
    "completedAt": "ISO-8601 (if completed)",
    "createdAt": "ISO-8601",
    "section": "active|backlog|previously_active (based on MD section)",
    "agent": "fe|be|fe + be (extract from **Agent**: pattern in task group)",
    "groupName": "string - group/section name like 'Sales Reports', 'Stock Audits'",
    "groupId": "string - unique ID for the group (optional)"
  }],
  "lastUpdated": "ISO-8601"
}`,

  ideas: `{
  "ideas": [{
    "id": "idea_xxxxxxxx",
    "text": "title/summary",
    "details": "expanded description (optional)",
    "priority": "high|medium|low",
    "status": "pending|converted|completed|archived",
    "tags": ["array", "of", "tags"],
    "addedAt": "ISO-8601",
    "completedAt": "ISO-8601 (if status=completed, extract from 'COMPLETED YYYY-MM-DD')",
    "convertedTo": "feat_xxx (if status=converted)",
    "source": "docs/technical-spec-v1.md, docs/edr-v1.md (from **Source**: pattern)",
    "sourceFiles": ["array of source file paths"],
    "painPoints": ["array of pain points from ### Pain Points or ### Riesgos section"],
    "solutions": ["array of solutions from ### Solutions section"],
    "filesAffected": ["array of file paths from **Files:** section"],
    "impactEffort": {"impact": "high|medium|low", "effort": "high|medium|low"} (optional),
    "stack": {
      "frontend": "Next.js 14, HeroUI",
      "backend": "Supabase (Auth, DB, RLS, Realtime)",
      "payments": "Stripe Billing",
      "ai": "Vercel AI SDK",
      "deploy": "Vercel"
    } (extract from ### Stack section),
    "modules": [{"name": "Multi-tenant", "description": "Empresas con RLS estricto"}] (from ### Módulos section),
    "roles": [{"name": "SUPER_ADMIN", "description": "(global, impersonation)"}] (from ### Roles section),
    "risks": ["array of risks from ### Riesgos Críticos section"],
    "risksCount": number (from '33 pitfalls documented')
  }],
  "lastUpdated": "ISO-8601"
}`,

  roadmap: `{
  "strategy": {
    "goal": "strategic goal string (optional)",
    "phases": [{"id": "P0", "name": "string", "status": "completed|active|planned", "completedAt": "ISO"}],
    "successMetrics": ["array of KPIs"]
  } | null (optional),
  "features": [{
    "id": "feat_xxxxxxxx",
    "name": "string",
    "description": "string (optional)",
    "date": "YYYY-MM-DD creation date",
    "impact": "high|medium|low (from Impact: HIGH)",
    "effort": "1-2 days or similar string",
    "status": "planned|active|completed|shipped",
    "progress": 0-100 (calculate from tasks completed/total),
    "type": "feature|breaking_change|refactor|infrastructure (from Type: BREAKING CHANGE)",
    "roi": 1-5 (count ⭐ stars, optional),
    "why": ["array from ### Why This Feature? section"],
    "technicalNotes": ["array from ### Technical Notes section"],
    "compatibility": "string (optional)",
    "phase": "P0|P1|P2|P3 (optional)",
    "tasks": [{
      "id": "task_xxxxxxxx",
      "description": "string",
      "completed": boolean ([ ]=false, [x]=true),
      "completedAt": "ISO-8601 (if completed)"
    }],
    "createdAt": "ISO-8601",
    "shippedAt": "ISO-8601 (if shipped)",
    "version": "0.11.6 (extract from v0.11.6 pattern)",
    "duration": {"hours": number, "minutes": number, "totalMinutes": number, "display": "~25m"} (parse from '~25m', '~1h'),
    "taskCount": number (extract from '7 tasks' in header),
    "agent": "fe+be|fe|be (from **Agent**: pattern)",
    "sprintName": "Sprint 6 - Reports + Audits (full sprint name)",
    "completedDate": "2025-12-09 (exact completion date from MD)"
  }],
  "backlog": ["string array"],
  "lastUpdated": "ISO-8601"
}`,

  shipped: `{
  "items": [{
    "id": "ship_xxxxxxxx",
    "name": "string",
    "version": "0.11.6 (extract from (v0.11.6) or v0.11.6 patterns, null if none)",
    "type": "feature|fix|improvement|refactor",
    "agent": "fe|be|fe+be|devops|ai (extract from **Agent**: pattern)",
    "description": "string - full narrative description text (NOT bullet points)",
    "changes": [{"description": "string", "type": "added|changed|fixed|removed"}] (from bullet points),
    "codeSnippets": ["string array of code blocks if any"] (optional),
    "commit": {
      "hash": "0a7bbea (short hash from **Commit**: pattern)",
      "message": "feat(security): Multi-tenant... (commit message)"
    } (optional),
    "codeMetrics": {
      "filesChanged": number|null,
      "linesAdded": number|null,
      "linesRemoved": number|null,
      "commits": number|null
    } (extract from 'Files: 4 | +160/-31 | Commits: 0'),
    "qualityMetrics": {
      "lintStatus": "pass|warning|fail|skipped|null",
      "lintDetails": "string (optional)",
      "testStatus": "pass|warning|fail|skipped|null",
      "testDetails": "string - e.g. (2 date-helper tests)"
    } (extract from 'Lint: warnings | Tests: failed (details)'),
    "quantitativeImpact": "81% (1,079 → 204 lines) (optional)",
    "duration": {"hours": number, "minutes": number, "totalMinutes": number} (parse from '~45m', '~1h', '13h 38m'),
    "tasksCompleted": number|null (extract from 'Tasks: 6' or '6 tasks'),
    "shippedAt": "ISO-8601",
    "featureId": "feat_xxx (optional)"
  }],
  "lastUpdated": "ISO-8601"
}`,

  metrics: `{
  "currentSprint": {
    "tasksStarted": number,
    "tasksCompleted": number,
    "inProgress": number
  },
  "allTime": {
    "featuresShipped": number,
    "tasksCompleted": number,
    "totalTimeTracked": {"hours": number, "minutes": number, "totalMinutes": number},
    "daysActive": number
  },
  "velocity": {
    "featuresPerWeek": number,
    "tasksPerDay": number
  },
  "recentActivity": [{
    "timestamp": "ISO-8601",
    "action": "started|completed|shipped|paused",
    "description": "string",
    "duration": {"hours": number, "minutes": number} (optional, parse from '(1m)' or '(7h 39m)'),
    "codeChanges": {"files": number, "added": number, "removed": number, "commits": number} (optional)
  }] (parse from Last Activity section and activity lines),
  "lastUpdated": "ISO-8601"
}`
}

async function getApiKey(): Promise<string | null> {
  try {
    const content = await fs.readFile(SETTINGS_PATH, 'utf-8')
    const settings = JSON.parse(content)
    return settings.openRouterApiKey || null
  } catch {
    return null
  }
}

async function readMdFile(projectId: string, relativePath: string): Promise<string | null> {
  try {
    const fullPath = join(GLOBAL_STORAGE, projectId, relativePath)
    return await fs.readFile(fullPath, 'utf-8')
  } catch {
    return null
  }
}

async function writeJsonFile(projectId: string, relativePath: string, data: unknown): Promise<void> {
  const fullPath = join(GLOBAL_STORAGE, projectId, relativePath)
  const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2))
}

type MigrationFile = {
  mdPaths: string[] // Multiple source files to read
  jsonPath: string  // Destination in data/ directory
  schemaKey: keyof typeof SCHEMAS
  name: string
}

// New architecture: MD → data/*.json
// All JSON files go to data/ directory
const MIGRATION_FILES: MigrationFile[] = [
  {
    mdPaths: ['core/now.md', 'core/now.json', 'sessions/current.json'],
    jsonPath: 'data/state.json',
    schemaKey: 'state',
    name: 'state'
  },
  {
    mdPaths: ['core/next.md', 'core/next.json'],
    jsonPath: 'data/queue.json',
    schemaKey: 'queue',
    name: 'queue'
  },
  {
    mdPaths: ['planning/ideas.md', 'planning/ideas.json'],
    jsonPath: 'data/ideas.json',
    schemaKey: 'ideas',
    name: 'ideas'
  },
  {
    mdPaths: ['planning/roadmap.md', 'planning/roadmap.json'],
    jsonPath: 'data/roadmap.json',
    schemaKey: 'roadmap',
    name: 'roadmap'
  },
  {
    mdPaths: ['progress/shipped.md', 'progress/shipped.json'],
    jsonPath: 'data/shipped.json',
    schemaKey: 'shipped',
    name: 'shipped'
  },
  {
    mdPaths: ['progress/metrics.md'],
    jsonPath: 'data/metrics.json',
    schemaKey: 'metrics',
    name: 'metrics'
  }
]

// Legacy files to delete after successful migration
const LEGACY_FILES = [
  'core/now.md',
  'core/now.json',
  'core/next.md',
  'core/next.json',
  'core/context.md',
  'planning/ideas.md',
  'planning/ideas.json',
  'planning/roadmap.md',
  'planning/roadmap.json',
  'progress/shipped.md',
  'progress/shipped.json',
  'progress/metrics.md',
]

async function deleteLegacyFiles(projectId: string): Promise<string[]> {
  const deleted: string[] = []
  for (const file of LEGACY_FILES) {
    try {
      await fs.unlink(join(GLOBAL_STORAGE, projectId, file))
      deleted.push(file)
    } catch {
      // File doesn't exist or can't be deleted
    }
  }

  // Try to remove empty directories
  const dirsToCheck = ['core', 'planning', 'progress']
  for (const dir of dirsToCheck) {
    try {
      const dirPath = join(GLOBAL_STORAGE, projectId, dir)
      const files = await fs.readdir(dirPath)
      if (files.length === 0) {
        await fs.rmdir(dirPath)
        deleted.push(dir + '/')
      }
    } catch {
      // Directory doesn't exist or not empty
    }
  }

  return deleted
}

export type MigrationResult = {
  file: string
  success: boolean
  error?: string
}

export async function migrateProject(projectId: string, deleteLegacy: boolean = true): Promise<{
  success: boolean
  results: MigrationResult[]
  deletedFiles: string[]
  viewsGenerated?: boolean
  error?: string
}> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    return { success: false, results: [], deletedFiles: [], error: 'No OpenRouter API key configured' }
  }

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey
  })

  const results: MigrationResult[] = []

  for (const file of MIGRATION_FILES) {
    // Read all source files for this migration
    const sourceContents: string[] = []
    for (const mdPath of file.mdPaths) {
      const content = await readMdFile(projectId, mdPath)
      if (content && content.trim()) {
        sourceContents.push(`## Source: ${mdPath}\n${content}`)
      }
    }

    if (sourceContents.length === 0) {
      results.push({ file: file.name, success: true, error: 'No source files found, skipped' })
      continue
    }

    const combinedContent = sourceContents.join('\n\n---\n\n')

    try {
      const schema = SCHEMAS[file.schemaKey]
      const { text } = await generateText({
        model: openrouter('anthropic/claude-3.5-haiku'),
        prompt: `Parse these source files and extract ALL structured data. Return ONLY valid JSON matching this schema (no markdown, no explanation):

## Target Schema:
${schema}

## Source Files Content:
${combinedContent}

## CRITICAL Pattern Extraction Rules - ZERO DATA LOSS:

AGENT PATTERNS - Extract agent type:
- "**Agent**: be" → agent: "be"
- "**Agent**: fe + be" → agent: "fe+be"
- "**Agent**: fe" → agent: "fe"

COMMIT PATTERNS - Extract git commit info:
- "**Commit**: \`0a7bbea\` feat(security): Multi-tenant..." → commit: {hash: "0a7bbea", message: "feat(security): Multi-tenant..."}
- "**Commits**: \`feat(sprint-6): Sales Reports\`, \`feat(sprint-6): Stock audit\`" → extract multiple commit messages

DURATION PATTERNS - Parse to {hours, minutes, totalMinutes, display}:
- "~1m" or "(1m)" → {hours: 0, minutes: 1, totalMinutes: 1, display: "~1m"}
- "~45m" → {hours: 0, minutes: 45, totalMinutes: 45, display: "~45m"}
- "~1h" or "(1h)" → {hours: 1, minutes: 0, totalMinutes: 60, display: "~1h"}
- "(7h 39m)" → {hours: 7, minutes: 39, totalMinutes: 499, display: "7h 39m"}
- "**Time**: ~28h" → {hours: 28, minutes: 0, totalMinutes: 1680, display: "~28h"}

TASK COUNT PATTERNS:
- "**Tasks**: 7" → taskCount: 7
- "(7 tasks, ~25m)" → taskCount: 7, duration: {hours: 0, minutes: 25, totalMinutes: 25}
- "(8 tasks)" → taskCount: 8

CODE METRICS - Parse "Files: X | +Y/-Z | Commits: N":
- "Files: 4 | +160/-31 | Commits: 0" → {filesChanged: 4, linesAdded: 160, linesRemoved: 31, commits: 0}
- "**Files**: 59" → {filesChanged: 59, linesAdded: null, linesRemoved: null, commits: null}

QUALITY STATUS - Parse "Lint: X | Tests: Y":
- "Lint: warnings" → lintStatus: "warning"
- "Tests: failed (2 date-helper tests)" → testStatus: "fail", testDetails: "2 date-helper tests"

IMPACT/EFFORT - Parse "Impact: X | Effort: Y":
- "Impact: **HIGH** | Effort: 1-2 days" → impact: "high", effort: "1-2 days"

ROI - Count stars:
- "⭐⭐⭐⭐⭐" → roi: 5

TASK TYPE - Detect from emoji:
- "🐛 [HIGH]" → type: "bug", priority: "high"
- "[ ] Task" → completed: false
- "[x] Done" → completed: true

VERSION - Extract number:
- "(v0.11.6)" or "v0.11.6" → version: "0.11.6"
- "Security Hardening v0.2.0" → name: "Security Hardening", version: "0.2.0"

SECTIONS - Detect from headers:
- "## Active Tasks" → section: "active"
- "## Previously Active" → section: "previously_active"
- "### Pain Points:" or "### Riesgos Críticos" → painPoints[] or risks[]
- "### Why This Feature?" → why[]
- "### Technical Notes" → technicalNotes[]
- "### Stack Definido" → stack: {frontend, backend, payments, ai, deploy}
- "### Módulos V1" → modules: [{name, description}]
- "### Roles" → roles: [{name, description}]

SOURCE PATTERNS:
- "**Source**: docs/technical-spec-v1.md, docs/edr-v1.md" → source: "docs/...", sourceFiles: ["docs/technical-spec-v1.md", "docs/edr-v1.md"]

STATUS WITH DATE:
- "**Status**: COMPLETED 2025-11-29" → status: "completed", completedAt: "2025-11-29T00:00:00.000Z"
- "### Sprint 6 - Reports + Audits (7 tasks, ~25m) - 2025-12-09 ✅" → sprintName, taskCount, duration, completedDate, status: "completed"

DESCRIPTION EXTRACTION:
- Capture ALL narrative text between the title and bullet points as "description"
- Code blocks (triple backticks) → codeSnippets: ["code string"]
- "CRITICAL: Multi-tenant isolation..." → description: "CRITICAL: Multi-tenant isolation..."

## Instructions:
- Return ONLY the JSON object, nothing else
- Generate unique IDs: task_xxxxxxxx, feat_xxxxxxxx, idea_xxxxxxxx, ship_xxxxxxxx
- ALL dates must be ISO-8601: YYYY-MM-DDTHH:mm:ss.sssZ
- Set lastUpdated to: "${new Date().toISOString()}"
- Preserve ALL rich data from MD - don't lose any information
- If a field is optional and no data exists, omit it completely`
      })

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response')
      }
      const parsedData = JSON.parse(jsonMatch[0])

      await writeJsonFile(projectId, file.jsonPath, parsedData)
      results.push({ file: file.name, success: true })
    } catch (error) {
      results.push({
        file: file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Copy project.json to data/ if exists
  try {
    const projectJson = await readMdFile(projectId, 'project.json')
    if (projectJson) {
      await writeJsonFile(projectId, 'data/project.json', JSON.parse(projectJson))
      results.push({ file: 'project', success: true })
    }
  } catch {
    // project.json doesn't exist or invalid, skip
  }

  const allSuccess = results.filter(r => !r.error?.includes('skipped')).every(r => r.success)

  // Delete legacy files only if all migrations succeeded
  let deletedFiles: string[] = []
  if (allSuccess && deleteLegacy) {
    deletedFiles = await deleteLegacyFiles(projectId)
  }

  // NOTE: View generation removed from migration to prevent Bun crashes
  // Views are generated on-demand by the view-generator when needed
  // The JSON files in data/ are the source of truth now

  return { success: allSuccess, results, deletedFiles, viewsGenerated: false }
}

export type ProjectInfo = {
  id: string
  name: string
  needsMigration: boolean
  hasMdFiles: boolean
  hasDataDir: boolean
}

export async function getProjectsToMigrate(): Promise<ProjectInfo[]> {
  try {
    const dirs = await fs.readdir(GLOBAL_STORAGE)
    const validProjects: ProjectInfo[] = []

    for (const dir of dirs) {
      // Skip hidden directories
      if (dir.startsWith('.')) continue

      const projectPath = join(GLOBAL_STORAGE, dir)

      // Must have CLAUDE.md or project.json to be a valid project
      let claudeMd: string | null = null
      try {
        claudeMd = await fs.readFile(join(projectPath, 'CLAUDE.md'), 'utf-8')
      } catch {
        // No CLAUDE.md
      }

      // Check for project.json in root or data/
      let projectJson: Record<string, unknown> | null = null
      try {
        projectJson = JSON.parse(await fs.readFile(join(projectPath, 'project.json'), 'utf-8'))
      } catch {
        try {
          projectJson = JSON.parse(await fs.readFile(join(projectPath, 'data', 'project.json'), 'utf-8'))
        } catch {
          // No project.json
        }
      }

      // Must have at least one identifier
      if (!claudeMd && !projectJson) continue

      // Check if project has legacy MD files to migrate
      let hasMdFiles = false
      for (const file of MIGRATION_FILES) {
        for (const mdPath of file.mdPaths) {
          if (mdPath.endsWith('.md')) {
            try {
              const content = await fs.readFile(join(projectPath, mdPath), 'utf-8')
              if (content && content.trim().length > 20) {
                hasMdFiles = true
                break
              }
            } catch {
              // File doesn't exist
            }
          }
        }
        if (hasMdFiles) break
      }

      // Check if data/ directory exists with JSON files
      let hasDataDir = false
      try {
        const dataFiles = await fs.readdir(join(projectPath, 'data'))
        hasDataDir = dataFiles.some(f => f.endsWith('.json'))
      } catch {
        // data/ doesn't exist
      }

      // Project needs migration if it has MD files but no data/ or incomplete data/
      const needsMigration = hasMdFiles

      // Get project name
      let name = dir
      if (projectJson && typeof projectJson.name === 'string') {
        name = projectJson.name
      } else if (claudeMd) {
        const match = claudeMd.match(/# (.+) - Project Context/)
        if (match) name = match[1]
      }

      validProjects.push({
        id: dir,
        name,
        needsMigration,
        hasMdFiles,
        hasDataDir
      })
    }

    // Sort: projects needing migration first, then by name
    return validProjects.sort((a, b) => {
      if (a.needsMigration !== b.needsMigration) {
        return a.needsMigration ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  } catch {
    return []
  }
}
