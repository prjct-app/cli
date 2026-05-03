/**
 * AGENTS.md discovery + parsing + chain merging.
 *
 * Expected per-agent format:
 *
 *   ## AgentName @override?
 *
 *   Description text.
 *
 *   ### Triggers
 *   - phrase
 *
 *   ### Rules
 *   - rule
 *
 *   ### Patterns
 *   ```typescript
 *   // pattern
 *   ```
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { MonorepoInfo, MonorepoPackage } from '../../types/infrastructure'
import type { AgentDefinition, NestedAgents, ResolvedAgents } from '../../types/services.js'
import * as fileHelper from '../../utils/file-helper'
import {
  buildInheritanceChain,
  computeDepth,
  findParentByDir,
  pickBestMatchForPath,
  scanForNestedFiles,
} from './_shared'

const FILENAME = 'AGENTS.md'

export class AgentsDiscovery {
  constructor(
    private rootPath: string,
    private monoInfo: MonorepoInfo | null
  ) {}

  async discoverFiles(): Promise<NestedAgents[]> {
    const agentFiles: NestedAgents[] = []

    const rootFile = path.join(this.rootPath, FILENAME)
    if (await fileHelper.fileExists(rootFile)) {
      agentFiles.push(await this.loadFile(rootFile, null))
    }

    if (this.monoInfo?.isMonorepo) {
      for (const pkg of this.monoInfo.packages) {
        const pkgFile = path.join(pkg.path, FILENAME)
        if (await fileHelper.fileExists(pkgFile)) {
          const parent = agentFiles.find((a) => a.depth === 0) || null
          const agents = await this.loadFile(pkgFile, parent, pkg)
          agentFiles.push(agents)
          parent?.children.push(agents)
        }
      }
    }

    const existingPaths = new Set(agentFiles.map((a) => a.path))
    await scanForNestedFiles(this.rootPath, FILENAME, existingPaths, async (filePath) => {
      const parent = findParentByDir(filePath, agentFiles)
      const agents = await this.loadFile(filePath, parent)
      agentFiles.push(agents)
      parent?.children.push(agents)
    })

    return agentFiles
  }

  async resolveForPath(targetPath: string): Promise<ResolvedAgents> {
    const agentFiles = await this.discoverFiles()
    const best = pickBestMatchForPath(targetPath, agentFiles)
    if (!best) return { agents: [], sources: [], overrides: [] }
    return mergeChain(buildInheritanceChain(best))
  }

  private async loadFile(
    filePath: string,
    parent: NestedAgents | null,
    pkg: MonorepoPackage | null = null
  ): Promise<NestedAgents> {
    const content = await fs.readFile(filePath, 'utf-8')
    return {
      path: filePath,
      relativePath: path.relative(this.rootPath, filePath),
      depth: computeDepth(this.rootPath, filePath),
      parent,
      children: [],
      content,
      agents: parseAgents(content),
      package: pkg,
    }
  }
}

function parseAgents(content: string): AgentDefinition[] {
  const agents: AgentDefinition[] = []
  let current: AgentDefinition | null = null
  let subsection: string | null = null
  let buf: string[] = []

  const flushBuf = () => {
    if (!current) return
    if (subsection) {
      const text = buf.join('\n').trim()
      switch (subsection.toLowerCase()) {
        case 'triggers':
          current.triggers = parseListItems(text)
          break
        case 'rules':
          current.rules = parseListItems(text)
          break
        case 'patterns':
          current.patterns = parseCodeBlocks(text)
          break
        case 'examples':
          current.examples = parseListItems(text)
          break
        case 'domain':
          current.domain = text
          break
      }
    } else {
      const desc = buf.join('\n').trim()
      if (desc && !current.description) current.description = desc
    }
    buf = []
  }

  for (const line of content.split('\n')) {
    const agentMatch = line.match(/^##\s+([^#].+)$/)
    if (agentMatch) {
      if (current) {
        flushBuf()
        agents.push(current)
      }
      const name = agentMatch[1]
      current = {
        name: name.replace(/@override|\(override\)/gi, '').trim(),
        description: '',
        override: name.includes('@override') || name.includes('(override)'),
      }
      subsection = null
      buf = []
      continue
    }

    const subMatch = line.match(/^###\s+(.+)$/)
    if (subMatch && current) {
      flushBuf()
      subsection = subMatch[1].trim()
      buf = []
      continue
    }

    if (current) buf.push(line)
  }

  if (current) {
    flushBuf()
    agents.push(current)
  }

  return agents
}

function parseListItems(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => line.match(/^\s*[-*]\s+/))
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter((item) => item.length > 0)
}

function parseCodeBlocks(content: string): string[] {
  const blocks: string[] = []
  const re = /```[\w]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = re.exec(content)) !== null) {
    blocks.push(match[1].trim())
  }

  if (blocks.length === 0 && content.trim()) {
    blocks.push(content.trim())
  }
  return blocks
}

function mergeChain(chain: NestedAgents[]): ResolvedAgents {
  const merged = new Map<string, AgentDefinition>()
  const sources: string[] = []
  const overrides: string[] = []

  for (const file of chain) {
    sources.push(file.relativePath)

    for (const agent of file.agents) {
      const existing = merged.get(agent.name)

      if (agent.override || !existing) {
        merged.set(agent.name, { ...agent })
        if (agent.override && existing) {
          overrides.push(`${file.relativePath}:${agent.name}`)
        }
      } else {
        const next: AgentDefinition = { ...existing }

        if (agent.triggers) next.triggers = [...(existing.triggers || []), ...agent.triggers]
        if (agent.rules) next.rules = [...(existing.rules || []), ...agent.rules]
        if (agent.patterns) next.patterns = [...(existing.patterns || []), ...agent.patterns]
        if (agent.examples) next.examples = [...(existing.examples || []), ...agent.examples]

        if (agent.description) {
          next.description = `${existing.description}\n\n${agent.description}`
        }
        if (agent.domain) next.domain = agent.domain

        merged.set(agent.name, next)
      }
    }
  }

  return {
    agents: Array.from(merged.values()),
    sources,
    overrides,
  }
}
