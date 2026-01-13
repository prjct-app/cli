/**
 * Context Generator
 *
 * Generates MD files in context/ from JSON data in data/
 * These MD files are for Claude to read.
 *
 * context/
 * ├── CLAUDE.md    - Full project context
 * ├── now.md       - Current task context
 * ├── queue.md     - Task queue
 * └── summary.md   - Project summary
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getStorage } from '../storage'
import pathManager from '../infrastructure/path-manager'

const execAsync = promisify(exec)

interface Task {
  id: string
  description: string
  status: string
  priority?: string
  startedAt?: string
  completedAt?: string
}

interface Feature {
  id: string
  name: string
  status: string
  description?: string
}

interface Idea {
  id: string
  title: string
  status?: string
}

interface ProjectData {
  name?: string
  repoPath?: string
  techStack?: string[]
  version?: string
}

interface Agent {
  name: string
  role?: string
  domain?: string
}

/**
 * Generate all context MD files from JSON data
 */
export async function generateContext(projectId: string, repoPath: string): Promise<void> {
  const globalPath = pathManager.getGlobalProjectPath(projectId)
  const contextPath = pathManager.getContextPath(projectId)
  const storage = getStorage(projectId)

  // Ensure context directory exists
  await fs.mkdir(contextPath, { recursive: true })

  // Read all data
  const project = await storage.read<ProjectData>(['project']) || {}
  const taskPaths = await storage.list(['task'])
  const featurePaths = await storage.list(['feature'])
  const ideaPaths = await storage.list(['idea'])
  const agentPaths = await storage.list(['agent'])

  const tasks: Task[] = []
  for (const p of taskPaths) {
    const task = await storage.read<Task>(p)
    if (task) tasks.push({ ...task, id: p[1] })
  }

  const features: Feature[] = []
  for (const p of featurePaths) {
    const feature = await storage.read<Feature>(p)
    if (feature) features.push({ ...feature, id: p[1] })
  }

  const ideas: Idea[] = []
  for (const p of ideaPaths) {
    const idea = await storage.read<Idea>(p)
    if (idea) ideas.push({ ...idea, id: p[1] })
  }

  const agents: Agent[] = []
  for (const p of agentPaths) {
    const agent = await storage.read<Agent>(p)
    if (agent) agents.push({ ...agent, name: p[1] })
  }

  // Get git data
  const gitData = await getGitData(repoPath)

  // Get package.json data
  const pkgData = await getPackageData(repoPath)

  // Generate each context file
  await generateClaudeMd(contextPath, projectId, project, tasks, features, ideas, agents, gitData, pkgData, repoPath)
  await generateNowMd(contextPath, tasks)
  await generateQueueMd(contextPath, tasks)
  await generateSummaryMd(contextPath, project, gitData, pkgData)
}

async function getGitData(repoPath: string) {
  const data = {
    branch: 'main',
    commits: 0,
    contributors: 0,
    hasChanges: false,
    recentCommits: [] as { hash: string; message: string; date: string }[]
  }

  try {
    const { stdout: branch } = await execAsync('git branch --show-current', { cwd: repoPath })
    data.branch = branch.trim() || 'main'

    const { stdout: commits } = await execAsync('git rev-list --count HEAD', { cwd: repoPath })
    data.commits = parseInt(commits.trim()) || 0

    const { stdout: contributors } = await execAsync('git shortlog -sn --all | wc -l', { cwd: repoPath })
    data.contributors = parseInt(contributors.trim()) || 0

    const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoPath })
    data.hasChanges = status.trim().length > 0

    const { stdout: log } = await execAsync('git log --oneline -10 --pretty=format:"%h|%s|%ad" --date=short', { cwd: repoPath })
    data.recentCommits = log.split('\n').filter(Boolean).map(line => {
      const [hash, message, date] = line.split('|')
      return { hash, message, date }
    })
  } catch (_error) {
    // Not a git repo - expected
  }

  return data
}

async function getPackageData(repoPath: string) {
  const data = {
    dependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>,
    scripts: {} as Record<string, string>
  }

  try {
    const pkgPath = path.join(repoPath, 'package.json')
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'))
    data.dependencies = pkg.dependencies || {}
    data.devDependencies = pkg.devDependencies || {}
    data.scripts = pkg.scripts || {}
  } catch (_error) {
    // No package.json - expected
  }

  return data
}

async function generateClaudeMd(
  contextPath: string,
  projectId: string,
  project: ProjectData,
  tasks: Task[],
  features: Feature[],
  ideas: Idea[],
  agents: Agent[],
  gitData: Awaited<ReturnType<typeof getGitData>>,
  pkgData: Awaited<ReturnType<typeof getPackageData>>,
  repoPath: string
) {
  const projectName = project.name || path.basename(repoPath)
  const currentTask = tasks.find(t => t.status === 'in_progress')
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const activeFeatures = features.filter(f => f.status === 'in_progress' || f.status === 'active')

  const deps = Object.keys(pkgData.dependencies)
  const devDeps = Object.keys(pkgData.devDependencies)

  const content = `# ${projectName} - Project Context
<!-- projectId: ${projectId} -->
<!-- Generated: ${new Date().toISOString()} -->

## PROJECT DATA

### Dependencies (${deps.length + devDeps.length})

**Production** (${deps.length}):
${deps.length > 0 ? deps.map(d => `- ${d}: ${pkgData.dependencies[d]}`).join('\n') : '_None_'}

**Dev** (${devDeps.length}):
${devDeps.length > 0 ? devDeps.map(d => `- ${d}: ${pkgData.devDependencies[d]}`).join('\n') : '_None_'}

### Scripts

${Object.keys(pkgData.scripts).length > 0 ? Object.entries(pkgData.scripts).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n') : '_None_'}

### Git

- Branch: ${gitData.branch}
- Commits: ${gitData.commits}
- Contributors: ${gitData.contributors}
- Uncommitted: ${gitData.hasChanges ? 'Yes' : 'No'}

**Recent:**
${gitData.recentCommits.length > 0 ? gitData.recentCommits.slice(0, 5).map(c => `- \`${c.hash}\` ${c.message}`).join('\n') : '_None_'}

---

## CURRENT STATE

**Now:** ${currentTask ? currentTask.description : '_No active task_'}

**Queue (${pendingTasks.length}):**
${pendingTasks.length > 0 ? pendingTasks.slice(0, 10).map((t, i) => `${i + 1}. ${t.description}`).join('\n') : '_Empty_'}

**Active Features (${activeFeatures.length}):**
${activeFeatures.length > 0 ? activeFeatures.map(f => `- ${f.name}`).join('\n') : '_None_'}

**Ideas (${ideas.length}):**
${ideas.length > 0 ? ideas.slice(0, 5).map(i => `- ${i.title}`).join('\n') : '_None_'}

---

## AGENTS

${agents.length > 0 ? agents.map(a => `- **${a.name}**: ${a.role || 'Specialist'}`).join('\n') : '_None_'}

---

## DATA LOCATION

\`\`\`
~/.prjct-cli/projects/${projectId}/
├── data/           # JSON (source of truth)
│   ├── project.json
│   ├── tasks/
│   ├── features/
│   ├── ideas/
│   └── agents/
├── context/        # MD (for Claude)
│   ├── CLAUDE.md
│   ├── now.md
│   └── queue.md
└── sync/           # Sync state
    └── pending.json
\`\`\`
`

  await fs.writeFile(path.join(contextPath, 'CLAUDE.md'), content, 'utf-8')
}

async function generateNowMd(contextPath: string, tasks: Task[]) {
  const currentTask = tasks.find(t => t.status === 'in_progress')

  const content = currentTask
    ? `# NOW

**Task:** ${currentTask.description}

**Started:** ${currentTask.startedAt || 'Unknown'}

**Priority:** ${currentTask.priority || 'medium'}
`
    : `# NOW

_No active task. Use /p:now to start._
`

  await fs.writeFile(path.join(contextPath, 'now.md'), content, 'utf-8')
}

async function generateQueueMd(contextPath: string, tasks: Task[]) {
  const pendingTasks = tasks.filter(t => t.status === 'pending')

  const content = `# QUEUE

${pendingTasks.length > 0
    ? pendingTasks.map((t, i) => `${i + 1}. ${t.description}${t.priority ? ` [${t.priority}]` : ''}`).join('\n')
    : '_Empty queue. Use /p:next to add tasks._'
}
`

  await fs.writeFile(path.join(contextPath, 'queue.md'), content, 'utf-8')
}

async function generateSummaryMd(
  contextPath: string,
  project: ProjectData,
  gitData: Awaited<ReturnType<typeof getGitData>>,
  pkgData: Awaited<ReturnType<typeof getPackageData>>
) {
  const content = `# PROJECT SUMMARY

**Name:** ${project.name || 'Unknown'}
**Version:** ${project.version || 'N/A'}
**Stack:** ${project.techStack?.join(', ') || 'Not detected'}

## Git

- Branch: ${gitData.branch}
- Commits: ${gitData.commits}
- Status: ${gitData.hasChanges ? 'Has uncommitted changes' : 'Clean'}

## Dependencies

- Production: ${Object.keys(pkgData.dependencies).length}
- Dev: ${Object.keys(pkgData.devDependencies).length}
`

  await fs.writeFile(path.join(contextPath, 'summary.md'), content, 'utf-8')
}

export default { generateContext }
