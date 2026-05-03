/**
 * Directory classification + stack/pattern detection rules and helpers.
 *
 * Pure functions extracted from ProjectIndexer so the orchestrator stays
 * focused on the scan→score→persist pipeline.
 */

import path from 'node:path'
import type {
  ConfigFileEntry,
  DetectedPattern,
  DetectedStack,
  DirectoryEntry,
  ProjectIndex,
} from '../../types/storage/extended'
import { fileExists } from '../../utils/file-helper'

const DIR_TYPE_PATTERNS: { type: DirectoryEntry['type']; patterns: RegExp[] }[] = [
  { type: 'test', patterns: [/^tests?$/i, /^__tests__$/i, /^spec$/i, /^e2e$/i] },
  {
    type: 'source',
    patterns: [
      /^src$/i,
      /^lib$/i,
      /^core$/i,
      /^app$/i,
      /^pages$/i,
      /^components$/i,
      /^services$/i,
      /^utils$/i,
    ],
  },
  { type: 'config', patterns: [/^config$/i, /^\.config$/i, /^settings$/i] },
  { type: 'build', patterns: [/^dist$/i, /^build$/i, /^out$/i, /^\.next$/i] },
  { type: 'vendor', patterns: [/^node_modules$/i, /^vendor$/i, /^packages$/i] },
  { type: 'docs', patterns: [/^docs?$/i, /^documentation$/i] },
]

const PATTERN_DETECTORS: {
  name: string
  detect: (index: ProjectIndex) => number
  evidence: (index: ProjectIndex) => string[]
}[] = [
  {
    name: 'monorepo',
    detect: (idx) => {
      const hasWorkspaces = idx.configFiles.some(
        (cf) => cf.type === 'package.json' && cf.parsed?.workspaces
      )
      const hasPackages = idx.directories.some((d) => d.path === 'packages' || d.path === 'apps')
      return hasWorkspaces ? 0.9 : hasPackages ? 0.7 : 0
    },
    evidence: (idx) => {
      const ev: string[] = []
      if (idx.directories.some((d) => d.path === 'packages')) ev.push('packages/')
      if (idx.directories.some((d) => d.path === 'apps')) ev.push('apps/')
      return ev
    },
  },
  {
    name: 'api-first',
    detect: (idx) => {
      const hasApiDir = idx.directories.some(
        (d) => d.path.includes('api') || d.path.includes('routes')
      )
      const hasOpenApi = idx.configFiles.some(
        (cf) => cf.path.includes('openapi') || cf.path.includes('swagger')
      )
      return hasOpenApi ? 0.9 : hasApiDir ? 0.6 : 0
    },
    evidence: (idx) =>
      idx.directories
        .filter((d) => d.path.includes('api') || d.path.includes('routes'))
        .map((d) => `${d.path}/`),
  },
  {
    name: 'component-based',
    detect: (idx) => {
      const hasComponents = idx.directories.some((d) => d.path.includes('components'))
      const hasReact = idx.detectedStack.frameworks.includes('React')
      const hasVue = idx.detectedStack.frameworks.includes('Vue')
      return hasComponents && (hasReact || hasVue) ? 0.8 : hasComponents ? 0.5 : 0
    },
    evidence: (idx) =>
      idx.directories.filter((d) => d.path.includes('components')).map((d) => `${d.path}/`),
  },
  {
    name: 'serverless',
    detect: (idx) => {
      const hasServerless = idx.configFiles.some(
        (cf) =>
          cf.path.includes('serverless') ||
          cf.path.includes('netlify') ||
          cf.path.includes('vercel')
      )
      const hasLambda = idx.directories.some(
        (d) => d.path.includes('functions') || d.path.includes('lambda')
      )
      return hasServerless ? 0.9 : hasLambda ? 0.6 : 0
    },
    evidence: (idx) =>
      idx.configFiles
        .filter((cf) => cf.path.includes('serverless') || cf.path.includes('vercel'))
        .map((cf) => cf.path),
  },
]

export function classifyDirectory(dirName: string): DirectoryEntry['type'] {
  for (const { type, patterns } of DIR_TYPE_PATTERNS) {
    if (patterns.some((p) => p.test(dirName))) return type
  }
  return 'unknown'
}

export function detectPatterns(index: ProjectIndex): DetectedPattern[] {
  const patterns: DetectedPattern[] = []
  for (const detector of PATTERN_DETECTORS) {
    const confidence = detector.detect(index)
    if (confidence > 0.3) {
      patterns.push({
        name: detector.name,
        confidence,
        evidence: detector.evidence(index),
      })
    }
  }
  return patterns.sort((a, b) => b.confidence - a.confidence)
}

export async function detectStack(
  configFiles: ConfigFileEntry[],
  projectPath: string
): Promise<DetectedStack> {
  const stack: DetectedStack = {
    ecosystem: 'unknown',
    frameworks: [],
    hasTests: false,
    hasDocker: false,
    hasCi: false,
    buildTool: null,
  }

  const packageJson = configFiles.find((cf) => cf.type === 'package.json')
  if (packageJson?.parsed) {
    stack.ecosystem = 'JavaScript'

    const parsed = packageJson.parsed as Record<string, unknown>
    const deps: Record<string, string> = {
      ...((parsed.dependencies as Record<string, string>) || {}),
      ...((parsed.devDependencies as Record<string, string>) || {}),
    }

    if (deps.react) stack.frameworks.push('React')
    if (deps.next) stack.frameworks.push('Next.js')
    if (deps.vue) stack.frameworks.push('Vue')
    if (deps.nuxt) stack.frameworks.push('Nuxt')
    if (deps.svelte) stack.frameworks.push('Svelte')
    if (deps['@angular/core']) stack.frameworks.push('Angular')
    if (deps.express) stack.frameworks.push('Express')
    if (deps.fastify) stack.frameworks.push('Fastify')
    if (deps.hono) stack.frameworks.push('Hono')
    if (deps['@nestjs/core']) stack.frameworks.push('NestJS')

    if (deps.jest || deps.vitest || deps.mocha) stack.hasTests = true

    if (deps.vite) stack.buildTool = 'vite'
    else if (deps.webpack) stack.buildTool = 'webpack'
    else if (deps.esbuild) stack.buildTool = 'esbuild'
    else if (deps.rollup) stack.buildTool = 'rollup'
  }

  if (configFiles.some((cf) => cf.type === 'Cargo.toml')) stack.ecosystem = 'Rust'
  if (configFiles.some((cf) => cf.type === 'go.mod')) stack.ecosystem = 'Go'
  if (configFiles.some((cf) => cf.type === 'pyproject.toml' || cf.type === 'requirements.txt')) {
    stack.ecosystem = 'Python'
  }

  stack.hasDocker = configFiles.some(
    (cf) => cf.type === 'Dockerfile' || cf.type.includes('docker-compose')
  )

  if (await fileExists(path.join(projectPath, '.github', 'workflows'))) {
    stack.hasCi = true
  }

  return stack
}
