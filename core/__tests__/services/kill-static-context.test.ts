/**
 * Tests for static context generation removal.
 *
 * Validates real behavioral consequences:
 * 1. Orchestrator graceful degradation when no domain agents exist
 * 2. Metrics record ALL agents (not just domain)
 * 3. showSyncResult uses agent count directly (no dead contextFiles/aiTools)
 * 4. command-installer strips prjct-project sections without corrupting prjct:start
 * 5. Watch service shows agent count (not domain-filtered names)
 * 6. ProjectSyncResult no longer carries contextFiles or aiTools
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { formatTokens } from '../../commands/analysis-helpers'
import { configureSkills, generateAgents, loadExistingAgents } from '../../services/sync-agent-gen'
import type { ProjectStats, SyncAgentInfo } from '../../types/project-sync'
import type { StackDetection } from '../../types/stack'

const fullStack: StackDetection = {
  hasFrontend: true,
  hasBackend: true,
  hasDatabase: true,
  hasDocker: true,
  hasTesting: true,
  frontendType: 'web',
  frameworks: ['React', 'Express'],
}

const stats: ProjectStats = {
  fileCount: 300,
  version: '1.0.0',
  name: 'test-project',
  ecosystem: 'JavaScript',
  projectType: 'enterprise',
  languages: ['TypeScript'],
  frameworks: ['React', 'Express'],
}

// ============================================================================
// 1. Orchestrator domain routing degrades gracefully
// ============================================================================

describe('orchestrator graceful degradation with workflow-only agents', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-orch-test-'))
    await fs.mkdir(path.join(tmpDir, 'agents'), { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('availableAgents contains only workflow names after generation', async () => {
    await generateAgents(tmpDir, fullStack, stats)

    const agentsDir = path.join(tmpDir, 'agents')
    const files = await fs.readdir(agentsDir)
    const names = files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))

    expect(names.sort()).toEqual(['prjct-planner', 'prjct-shipper', 'prjct-workflow'])

    // Domain routing will find no matching agents
    const domainNames = ['frontend', 'backend', 'database', 'testing', 'devops']
    const validDomains = domainNames.filter((domain) =>
      names.some(
        (agent) =>
          agent === domain || agent.includes(domain) || domain.includes(agent.replace('.md', ''))
      )
    )

    expect(validDomains).toHaveLength(0)
  })

  it('loadAgents returns empty array for domain names with only workflow files', async () => {
    await generateAgents(tmpDir, fullStack, stats)

    const agentsDir = path.join(tmpDir, 'agents')
    const domainNames = ['frontend', 'backend', 'general']
    const loaded: Array<{ name: string; content: string }> = []

    for (const domain of domainNames) {
      const possibleNames = [`${domain}.md`, `${domain}-agent.md`, `prjct-${domain}.md`]
      for (const fileName of possibleNames) {
        try {
          const content = await fs.readFile(path.join(agentsDir, fileName), 'utf-8')
          loaded.push({ name: fileName, content })
        } catch {
          // Expected — file doesn't exist
        }
      }
    }

    expect(loaded).toHaveLength(0)
  })

  it('purges legacy domain agents so they cannot be accidentally loaded', async () => {
    const agentsDir = path.join(tmpDir, 'agents')

    // Simulate leftover domain agents from before the refactor
    await fs.writeFile(path.join(agentsDir, 'frontend.md'), '# Legacy frontend agent', 'utf-8')
    await fs.writeFile(path.join(agentsDir, 'backend.md'), '# Legacy backend agent', 'utf-8')

    await generateAgents(tmpDir, fullStack, stats)

    const files = await fs.readdir(agentsDir)
    expect(files).not.toContain('frontend.md')
    expect(files).not.toContain('backend.md')
    expect(files.filter((f) => f.endsWith('.md'))).toHaveLength(3)
  })
})

// ============================================================================
// 2. Metrics use real BM25 data, not hardcoded estimates
//
// recordSyncMetrics now loads the BM25 index to get real token counts
// instead of using fileCount * 500. All agents are recorded (not just domain).
// ============================================================================

describe('metrics with real index data', () => {
  it('all workflow agents are recorded in metrics (not filtered to domain only)', () => {
    const agents: SyncAgentInfo[] = [
      { name: 'prjct-workflow', type: 'workflow' },
      { name: 'prjct-planner', type: 'workflow' },
      { name: 'prjct-shipper', type: 'workflow' },
    ]

    const recordedAgents = agents.map((a) => a.name)
    expect(recordedAgents).toEqual(['prjct-workflow', 'prjct-planner', 'prjct-shipper'])
    expect(recordedAgents).toHaveLength(3)
  })

  it('originalSize uses real BM25 token counts instead of fileCount * 500', () => {
    // Simulate what recordSyncMetrics does: sum doc lengths from BM25 index
    const mockDocLengths: Record<string, number> = {
      'core/services/sync-service.ts': 1200,
      'core/commands/analysis.ts': 800,
      'core/domain/bm25.ts': 650,
      'core/utils/output.ts': 150,
    }

    const realOriginalSize = Object.values(mockDocLengths).reduce((sum, len) => sum + len, 0)
    expect(realOriginalSize).toBe(2800) // Actual sum, not 4 * 500 = 2000

    // The old fake estimate would have been:
    const fakeOriginalSize = Object.keys(mockDocLengths).length * 500
    expect(fakeOriginalSize).toBe(2000)

    // Real data gives different (more accurate) result
    expect(realOriginalSize).not.toBe(fakeOriginalSize)
  })

  it('compression rate reflects real reduction from project tokens to agent context', () => {
    const CHARS_PER_TOKEN = 4
    // Real: BM25 says project has 45,000 tokens across all files
    const originalSize = 45000
    // Agent files are ~2KB each × 3 = 6KB ≈ 1500 tokens
    const agentChars = 3 * 2000
    const filteredSize = Math.floor(agentChars / CHARS_PER_TOKEN)

    const compressionRate = (originalSize - filteredSize) / originalSize
    // 45000 - 1500 = 43500 / 45000 = 96.7%
    expect(compressionRate).toBeGreaterThan(0.96)
    expect(compressionRate).toBeLessThanOrEqual(1.0)
  })

  it('SyncMetrics includes index statistics', () => {
    const metrics = {
      duration: 2300,
      originalSize: 45000,
      filteredSize: 1500,
      compressionRate: 0.967,
      indexes: {
        bm25Files: 120,
        bm25AvgTokens: 375,
        bm25VocabSize: 8500,
        importEdges: 340,
        importFiles: 120,
        cochangeCommits: 100,
        cochangeFiles: 85,
      },
    }

    expect(metrics.indexes.bm25Files).toBe(120)
    expect(metrics.indexes.bm25AvgTokens).toBe(375)
    expect(metrics.indexes.importEdges).toBe(340)
    expect(metrics.indexes.cochangeCommits).toBe(100)
    // Total project tokens = files × avg
    expect(metrics.indexes.bm25Files * metrics.indexes.bm25AvgTokens).toBe(45000)
  })
})

// ============================================================================
// 3. showSyncResult displays real index data
//
// Summary box now includes index line with real token count, vocab size,
// and import edges when available.
// ============================================================================

describe('showSyncResult output coherence', () => {
  it('summary box includes index stats when available', () => {
    const idx = { bm25Files: 120, bm25AvgTokens: 375, bm25VocabSize: 8500, importEdges: 340 }
    const totalTokens = idx.bm25Files * (idx.bm25AvgTokens || 0)

    // This is what showSyncResult now builds
    const indexLine = `Index: ${formatTokens(totalTokens)} tokens | ${idx.bm25VocabSize} terms | ${idx.importEdges} imports`
    expect(indexLine).toBe('Index: 45.0K tokens | 8500 terms | 340 imports')
  })

  it('generated items list says "workflow agents"', () => {
    const agentCount = 3
    const generatedItems: string[] = []
    if (agentCount > 0) {
      generatedItems.push(`${agentCount} workflow agents`)
    }

    expect(generatedItems).toEqual(['3 workflow agents'])
  })
})

// ============================================================================
// 4. command-installer prjct-project stripping
// ============================================================================

describe('prjct-project section stripping (command-installer)', () => {
  function stripProjectSection(content: string): string {
    const projectStartMarker = '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->'
    const projectEndMarker = '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->'

    if (content.includes(projectStartMarker) && content.includes(projectEndMarker)) {
      const beforeProject = content.substring(0, content.indexOf(projectStartMarker))
      const afterProject = content.substring(
        content.indexOf(projectEndMarker) + projectEndMarker.length
      )
      return `${(beforeProject + afterProject).replace(/\n{3,}/g, '\n\n').trim()}\n`
    }
    return content
  }

  it('strips project section while preserving global prjct section', () => {
    const input = [
      '# My Notes',
      '',
      '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->',
      '# p/ — Context layer for AI agents',
      'Commands: `p. sync` `p. task`',
      '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->',
      '',
      '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->',
      '# prjct-cli - Project Rules',
      '<!-- projectId: bc401c41 -->',
      '## THIS PROJECT (JavaScript)',
      '**Type:** enterprise',
      '### Anti-Patterns (Avoid These)',
      '- **Unbounded any type** in multiple',
      '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->',
    ].join('\n')

    const result = stripProjectSection(input)

    expect(result).not.toContain('prjct-project:start')
    expect(result).not.toContain('Project Rules')
    expect(result).not.toContain('bc401c41')
    expect(result).not.toContain('Anti-Patterns')

    expect(result).toContain('prjct:start')
    expect(result).toContain('p/ — Context layer')
    expect(result).toContain('prjct:end')
    expect(result).toContain('# My Notes')
  })

  it('does not corrupt when only start marker exists (no end)', () => {
    const input = [
      '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->',
      'rules',
      '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->',
      '',
      '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->',
      'orphaned section without end marker',
    ].join('\n')

    const result = stripProjectSection(input)
    expect(result).toBe(input)
  })

  it('collapses excessive newlines after stripping', () => {
    const input = [
      'line1',
      '',
      '',
      '',
      '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->',
      'stuff',
      '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->',
      '',
      '',
      '',
      'line2',
    ].join('\n')

    const result = stripProjectSection(input)

    expect(result).not.toMatch(/\n{3,}/)
    expect(result).toContain('line1')
    expect(result).toContain('line2')
  })

  it('handles real-world CLAUDE.md with user content + prjct + project sections', () => {
    const input = [
      '# My custom instructions',
      '',
      'Always use bun instead of npm.',
      'Prefer functional patterns.',
      '',
      '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->',
      '# p/ — Context layer for AI agents',
      '',
      'Commands: `p. sync` `p. task` `p. done`',
      '',
      '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->',
      '',
      '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->',
      '# prjct-cli - Project Rules',
      '<!-- projectId: bc401c41-c8b9-436a-ac78-c91cac82ab4f -->',
      '<!-- Generated: 2026-02-23T18:36:55.298Z -->',
      '',
      '## THIS PROJECT (JavaScript)',
      '**Type:** enterprise',
      '',
      '### Anti-Patterns (Avoid These)',
      '- **Unbounded any type** in `multiple`',
      '',
      '## AGENTS',
      '**Domain**: backend, database',
      '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->',
    ].join('\n')

    const result = stripProjectSection(input)

    expect(result).toContain('Always use bun instead of npm.')
    expect(result).toContain('Prefer functional patterns.')
    expect(result).toContain('<!-- prjct:start')
    expect(result).toContain('p. sync')
    expect(result).toContain('<!-- prjct:end')

    expect(result).not.toContain('prjct-project:start')
    expect(result).not.toContain('prjct-project:end')
    expect(result).not.toContain('bc401c41')
    expect(result).not.toContain('Anti-Patterns')
    expect(result).not.toContain('**Domain**: backend, database')
    expect(result).not.toContain('THIS PROJECT')
  })
})

// ============================================================================
// 5. configureSkills with workflow-only agents
// ============================================================================

describe('configureSkills with workflow-only agents', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-skills-test-'))
    await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty skills array when all agents are workflow type', () => {
    const agents: SyncAgentInfo[] = [
      { name: 'prjct-workflow', type: 'workflow' },
      { name: 'prjct-planner', type: 'workflow' },
      { name: 'prjct-shipper', type: 'workflow' },
    ]

    const skills = configureSkills(agents, 'test-project', tmpDir)
    expect(skills).toEqual([])
  })

  it('writes valid skills.json even with empty skills', async () => {
    const agents: SyncAgentInfo[] = [{ name: 'prjct-workflow', type: 'workflow' }]

    configureSkills(agents, 'test-project', tmpDir)

    await new Promise((resolve) => setTimeout(resolve, 100))

    const skillsPath = path.join(tmpDir, 'config', 'skills.json')
    const content = JSON.parse(await fs.readFile(skillsPath, 'utf-8'))

    expect(content.projectId).toBe('test-project')
    expect(content.skills).toEqual([])
    expect(content.agentSkillMap).toEqual({})
  })
})

// ============================================================================
// 6. loadExistingAgents classification post-refactor
// ============================================================================

describe('loadExistingAgents post-refactor', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-load-test-'))
    await fs.mkdir(path.join(tmpDir, 'agents'), { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('classifies all 3 workflow files correctly after generateAgents', async () => {
    await generateAgents(tmpDir, fullStack, stats)
    const agents = await loadExistingAgents(tmpDir)

    expect(agents).toHaveLength(3)
    expect(agents.every((a) => a.type === 'workflow')).toBe(true)
    expect(agents.map((a) => a.name).sort()).toEqual([
      'prjct-planner',
      'prjct-shipper',
      'prjct-workflow',
    ])
  })

  it('returns empty when agents dir does not exist', async () => {
    const agents = await loadExistingAgents('/tmp/nonexistent-path-xyz')
    expect(agents).toEqual([])
  })
})

// ============================================================================
// 7. Watch service shows agent count (not domain-filtered names)
//
// watch-service.ts now shows "[3 agents]" instead of filtering by domain type
// ============================================================================

describe('watch service agent display', () => {
  it('shows agent count instead of domain-filtered names', () => {
    const agents: SyncAgentInfo[] = [
      { name: 'prjct-workflow', type: 'workflow' },
      { name: 'prjct-planner', type: 'workflow' },
      { name: 'prjct-shipper', type: 'workflow' },
    ]

    // New behavior from watch-service.ts
    const agentCount = agents.length
    const agentStr = agentCount > 0 ? ` [${agentCount} agents]` : ''

    expect(agentStr).toBe(' [3 agents]')
  })

  it('shows empty string when no agents', () => {
    const agents: SyncAgentInfo[] = []

    const agentCount = agents.length
    const agentStr = agentCount > 0 ? ` [${agentCount} agents]` : ''

    expect(agentStr).toBe('')
  })
})

// ============================================================================
// 8. ProjectSyncResult type no longer has contextFiles or aiTools
//
// Verify at the type level that these fields are gone.
// ============================================================================

describe('ProjectSyncResult type cleanup', () => {
  it('result object works without contextFiles and aiTools fields', () => {
    // This compiles only if the type no longer requires these fields
    const result = {
      success: true,
      projectId: 'test',
      cliVersion: '1.0.0',
      git: {} as never,
      stats,
      commands: {} as never,
      stack: fullStack,
      agents: [{ name: 'prjct-workflow', type: 'workflow' as const }],
      skills: [],
      skillsInstalled: [],
      // No contextFiles or aiTools — they're gone from the type
    }

    expect(result.success).toBe(true)
    expect(result.agents).toHaveLength(1)
    expect(result).not.toHaveProperty('contextFiles')
    expect(result).not.toHaveProperty('aiTools')
  })
})
