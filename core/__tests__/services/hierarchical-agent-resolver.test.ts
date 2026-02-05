/**
 * Tests for HierarchicalAgentResolver
 * PRJ-101: Hierarchical scope system
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import HierarchicalAgentResolver from '../../services/hierarchical-agent-resolver'

let testDir: string
let resolver: HierarchicalAgentResolver

beforeEach(async () => {
  testDir = path.join(os.tmpdir(), `prjct-har-test-${Date.now()}`)
  await fs.mkdir(testDir, { recursive: true })
  resolver = new HierarchicalAgentResolver(testDir)
})

afterEach(async () => {
  try {
    await fs.rm(testDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
})

// =============================================================================
// Basic Resolution Tests
// =============================================================================

describe('HierarchicalAgentResolver - Basic', () => {
  test('resolves agents from root AGENTS.md', async () => {
    await fs.writeFile(
      path.join(testDir, 'AGENTS.md'),
      `## Backend

Backend development specialist.

### Triggers
- api
- endpoint
- server

### Rules
- Use async/await
- Validate inputs
`
    )

    const result = await resolver.resolveAgentsForPath(testDir)

    expect(result.agents).toHaveLength(1)
    expect(result.agents[0].name).toBe('Backend')
    expect(result.agents[0].description).toBe('Backend development specialist.')
    expect(result.agents[0].triggers).toContain('api')
    expect(result.agents[0].rules).toContain('Use async/await')
  })

  test('returns empty result when no AGENTS.md exists', async () => {
    const result = await resolver.resolveAgentsForPath(testDir)

    expect(result.agents).toHaveLength(0)
    expect(result.discoveredFiles).toHaveLength(0)
  })

  test('tracks discovered files', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Agent\n\nTest.')

    const result = await resolver.resolveAgentsForPath(testDir)

    expect(result.discoveredFiles).toHaveLength(1)
    expect(result.discoveredFiles[0]).toBe(path.join(testDir, 'AGENTS.md'))
  })

  test('resolveRootAgents uses root path', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Root\n\nRoot agent.')

    const subDir = path.join(testDir, 'sub')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, 'AGENTS.md'), '## Sub\n\nSub agent.')

    // resolveRootAgents should return root agents
    const result = await resolver.resolveRootAgents()

    // Root has only 1 agent (no inheritance from children)
    expect(result.agents).toHaveLength(1)
    expect(result.agents[0].name).toBe('Root')
  })
})

// =============================================================================
// Get Agent By Name Tests
// =============================================================================

describe('HierarchicalAgentResolver - getAgentByName', () => {
  test('finds agent by name', async () => {
    await fs.writeFile(
      path.join(testDir, 'AGENTS.md'),
      `## Frontend

Frontend specialist.

## Backend

Backend specialist.
`
    )

    const agent = await resolver.getAgentByName('Backend')

    expect(agent).not.toBeNull()
    expect(agent?.name).toBe('Backend')
  })

  test('returns null for non-existent agent', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Frontend\n\nFrontend.')

    const agent = await resolver.getAgentByName('NonExistent')

    expect(agent).toBeNull()
  })

  test('case-insensitive search', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Backend\n\nBackend.')

    const agent = await resolver.getAgentByName('BACKEND')

    expect(agent).not.toBeNull()
    expect(agent?.name).toBe('Backend')
  })
})

// =============================================================================
// Get All Agent Names Tests
// =============================================================================

describe('HierarchicalAgentResolver - getAllAgentNames', () => {
  test('returns all unique agent names', async () => {
    await fs.writeFile(
      path.join(testDir, 'AGENTS.md'),
      `## Alpha

Alpha agent.

## Beta

Beta agent.
`
    )

    const names = await resolver.getAllAgentNames()

    expect(names).toEqual(['Alpha', 'Beta'])
  })

  test('includes agents from nested files', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Root\n\nRoot.')

    const subDir = path.join(testDir, 'sub')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, 'AGENTS.md'), '## Sub\n\nSub.')

    const names = await resolver.getAllAgentNames()

    expect(names.sort()).toEqual(['Root', 'Sub'])
  })

  test('deduplicates agent names', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Shared\n\nRoot shared.')

    const subDir = path.join(testDir, 'sub')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, 'AGENTS.md'), '## Shared\n\nSub shared.')

    const names = await resolver.getAllAgentNames()

    expect(names).toEqual(['Shared'])
  })
})

// =============================================================================
// Agent Existence Check Tests
// =============================================================================

describe('HierarchicalAgentResolver - agentExists', () => {
  test('returns true for existing agent', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Frontend\n\nFrontend.')

    const exists = await resolver.agentExists('Frontend')

    expect(exists).toBe(true)
  })

  test('returns false for non-existing agent', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Frontend\n\nFrontend.')

    const exists = await resolver.agentExists('Backend')

    expect(exists).toBe(false)
  })

  test('case-insensitive check', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Frontend\n\nFrontend.')

    const exists = await resolver.agentExists('FRONTEND')

    expect(exists).toBe(true)
  })
})

// =============================================================================
// Markdown Generation Tests
// =============================================================================

describe('HierarchicalAgentResolver - generateAgentMarkdown', () => {
  test('generates markdown with all sections', async () => {
    await fs.writeFile(
      path.join(testDir, 'AGENTS.md'),
      `## Backend

Backend development specialist.

### Domain
backend

### Triggers
- api
- server

### Rules
- Use TypeScript
- Log errors

### Patterns
\`\`\`typescript
export async function handler() {}
\`\`\`
`
    )

    const result = await resolver.resolveAgentsForPath(testDir)
    const md = resolver.generateAgentMarkdown(result.agents[0])

    expect(md).toContain('# Backend Agent')
    expect(md).toContain('Backend development specialist.')
    expect(md).toContain('## DOMAIN AUTHORITY')
    expect(md).toContain('backend domain')
    expect(md).toContain('## Triggers')
    expect(md).toContain('- api')
    expect(md).toContain('## Rules')
    expect(md).toContain('- Use TypeScript')
    expect(md).toContain('## Patterns')
  })

  test('includes source attribution', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Agent\n\nTest agent.')

    const result = await resolver.resolveAgentsForPath(testDir)
    const md = resolver.generateAgentMarkdown(result.agents[0])

    expect(md).toContain('*Resolved from:')
    expect(md).toContain('AGENTS.md')
  })
})

// =============================================================================
// Hierarchical Resolution Tests
// =============================================================================

describe('HierarchicalAgentResolver - Hierarchy', () => {
  test('merges triggers from parent and child', async () => {
    await fs.writeFile(
      path.join(testDir, 'AGENTS.md'),
      `## Shared

Base agent.

### Triggers
- root-trigger
`
    )

    const childDir = path.join(testDir, 'child')
    await fs.mkdir(childDir)
    await fs.writeFile(
      path.join(childDir, 'AGENTS.md'),
      `## Shared

Extended agent.

### Triggers
- child-trigger
`
    )

    const result = await resolver.resolveAgentsForPath(childDir)

    expect(result.agents[0].triggers).toContain('root-trigger')
    expect(result.agents[0].triggers).toContain('child-trigger')
  })

  test('tracks overridden agents', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Agent\n\nRoot.')

    const childDir = path.join(testDir, 'child')
    await fs.mkdir(childDir)
    await fs.writeFile(path.join(childDir, 'AGENTS.md'), '## Agent @override\n\nChild override.')

    const result = await resolver.resolveAgentsForPath(childDir)

    expect(result.overriddenAgents).toContain('Agent')
    expect(result.agents[0].wasOverridden).toBe(true)
  })

  test('path-specific resolution', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Global\n\nGlobal.')

    const apiDir = path.join(testDir, 'packages', 'api')
    await fs.mkdir(apiDir, { recursive: true })
    await fs.writeFile(path.join(apiDir, 'AGENTS.md'), '## API\n\nAPI specific.')

    const webDir = path.join(testDir, 'packages', 'web')
    await fs.mkdir(webDir, { recursive: true })
    await fs.writeFile(path.join(webDir, 'AGENTS.md'), '## Web\n\nWeb specific.')

    // Resolve for API path
    const apiResult = await resolver.resolveAgentsForPath(apiDir)
    expect(apiResult.agents.map((a) => a.name).sort()).toEqual(['API', 'Global'])

    // Resolve for Web path
    const webResult = await resolver.resolveAgentsForPath(webDir)
    expect(webResult.agents.map((a) => a.name).sort()).toEqual(['Global', 'Web'])
  })
})

// =============================================================================
// Agent File Tree Tests
// =============================================================================

describe('HierarchicalAgentResolver - getAgentFileTree', () => {
  test('returns hierarchical tree structure', async () => {
    await fs.writeFile(path.join(testDir, 'AGENTS.md'), '## Root\n\nRoot.')

    const childDir = path.join(testDir, 'child')
    await fs.mkdir(childDir)
    await fs.writeFile(path.join(childDir, 'AGENTS.md'), '## Child\n\nChild.')

    const tree = await resolver.getAgentFileTree()

    expect(tree).toHaveLength(2)
    const root = tree.find((n) => n.depth === 0)
    const child = tree.find((n) => n.depth > 0)

    expect(root?.children).toContain(child)
    expect(child?.parent).toBe(root)
  })
})
