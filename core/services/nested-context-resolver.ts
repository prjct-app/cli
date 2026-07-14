/**
 * NestedContextResolver — facade over PRJCT.md + AGENTS.md discovery in monorepos.
 *
 * Splits responsibilities into:
 *   - ContextDiscovery (PRJCT.md)
 *   - AgentsDiscovery (AGENTS.md)
 *
 * Pattern from OpenAI Codex AGENTS.md:
 * "Scope = directory tree. Deeper files take precedence."
 */

import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import type { MonorepoInfo } from '../types/infrastructure'
import type {
  NestedAgents,
  NestedContext,
  ResolvedAgents,
  ResolvedContext,
} from '../types/services/extracted'
import { AgentsDiscovery } from './nested-context/agents-md-discovery'
import { ContextDiscovery } from './nested-context/context-discovery'

class NestedContextResolver {
  private rootPath: string
  private monoInfo: MonorepoInfo | null = null
  private contextDiscovery: ContextDiscovery | null = null
  private agentsDiscovery: AgentsDiscovery | null = null

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath)
  }

  async initialize(): Promise<void> {
    this.monoInfo = await pathManager.detectMonorepo(this.rootPath)
    this.contextDiscovery = new ContextDiscovery(this.rootPath, this.monoInfo)
    this.agentsDiscovery = new AgentsDiscovery(this.rootPath, this.monoInfo)
  }

  // --- PRJCT.md ---

  async discoverContextFiles(): Promise<NestedContext[]> {
    return this.context().discoverFiles()
  }

  async resolveContextForPath(targetPath: string): Promise<ResolvedContext> {
    return this.context().resolveForPath(targetPath)
  }

  async getPackageContext(packageName: string): Promise<ResolvedContext | null> {
    const pkg = this.findPackage(packageName)
    return pkg ? this.context().resolveForPath(pkg.path) : null
  }

  async getAllPackageContexts(): Promise<Map<string, ResolvedContext>> {
    const results = new Map<string, ResolvedContext>()
    if (!this.monoInfo?.isMonorepo) return results

    for (const pkg of this.monoInfo.packages) {
      results.set(pkg.name, await this.context().resolveForPath(pkg.path))
    }
    return results
  }

  // --- AGENTS.md ---

  async discoverAgentFiles(): Promise<NestedAgents[]> {
    return this.agents().discoverFiles()
  }

  async resolveAgentsForPath(targetPath: string): Promise<ResolvedAgents> {
    return this.agents().resolveForPath(targetPath)
  }

  async getPackageAgents(packageName: string): Promise<ResolvedAgents | null> {
    const pkg = this.findPackage(packageName)
    return pkg ? this.agents().resolveForPath(pkg.path) : null
  }

  async getAllPackageAgents(): Promise<Map<string, ResolvedAgents>> {
    const results = new Map<string, ResolvedAgents>()
    if (!this.monoInfo?.isMonorepo) return results

    for (const pkg of this.monoInfo.packages) {
      results.set(pkg.name, await this.agents().resolveForPath(pkg.path))
    }
    return results
  }

  // --- internals ---

  private context(): ContextDiscovery {
    if (!this.contextDiscovery) {
      this.contextDiscovery = new ContextDiscovery(this.rootPath, this.monoInfo)
    }
    return this.contextDiscovery
  }

  private agents(): AgentsDiscovery {
    if (!this.agentsDiscovery) {
      this.agentsDiscovery = new AgentsDiscovery(this.rootPath, this.monoInfo)
    }
    return this.agentsDiscovery
  }

  private findPackage(packageName: string) {
    return this.monoInfo?.isMonorepo
      ? this.monoInfo.packages.find((p) => p.name === packageName) || null
      : null
  }
}

export default NestedContextResolver
