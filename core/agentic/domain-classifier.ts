/**
 * Domain Classifier
 *
 * LLM-based task domain classification with caching and fallback chain.
 * Replaces hardcoded keyword substring matching that caused false positives
 * (e.g., "author" matching "auth" → backend).
 *
 * Fallback chain:
 * 1. Cache lookup (file-based, 1hr TTL)
 * 2. Confirmed patterns (from successful task completions)
 * 3. LLM call (Claude haiku, ~200 tokens)
 * 4. Improved heuristic (word-boundary matching, no substring traps)
 *
 * @see PRJ-299
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  type ClassificationCache,
  type ClassificationDomain,
  DEFAULT_CLASSIFICATION_CACHE,
  GENERAL_CLASSIFICATION,
  type TaskClassification,
} from '../schemas/classification'
import { getErrorMessage, isNotFoundError } from '../types/fs'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// =============================================================================
// Project Context (passed to classifier)
// =============================================================================

export interface ProjectContext {
  /** Domains detected during sync */
  domains: {
    hasFrontend: boolean
    hasBackend: boolean
    hasDatabase: boolean
    hasTesting: boolean
    hasDocker: boolean
  }
  /** Available agent names (without .md extension) */
  agents: string[]
  /** Project stack info */
  stack?: { language?: string; framework?: string }
}

// =============================================================================
// Hashing
// =============================================================================

function hashDescription(description: string): string {
  return createHash('sha256').update(description.toLowerCase().trim()).digest('hex').slice(0, 16)
}

// =============================================================================
// Cache Layer
// =============================================================================

async function loadCache(globalPath: string): Promise<ClassificationCache> {
  try {
    const cachePath = path.join(globalPath, 'storage', 'classification-cache.json')
    const content = await fs.readFile(cachePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (isNotFoundError(error)) return DEFAULT_CLASSIFICATION_CACHE
    console.warn('[classifier] Failed to load cache:', getErrorMessage(error))
    return DEFAULT_CLASSIFICATION_CACHE
  }
}

async function saveCache(globalPath: string, cache: ClassificationCache): Promise<void> {
  try {
    const cachePath = path.join(globalPath, 'storage', 'classification-cache.json')
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2))
  } catch (error) {
    console.warn('[classifier] Failed to save cache:', getErrorMessage(error))
  }
}

function lookupCache(
  cache: ClassificationCache,
  hash: string,
  projectId: string
): TaskClassification | null {
  const entry = cache.entries[hash]
  if (!entry) return null
  if (entry.projectId !== projectId) return null

  // Check TTL
  const age = Date.now() - new Date(entry.classifiedAt).getTime()
  if (age > CACHE_TTL_MS) return null

  return entry.classification
}

// =============================================================================
// Confirmed Patterns (from successful task completions)
// =============================================================================

function lookupPatterns(cache: ClassificationCache, hash: string): TaskClassification | null {
  const pattern = cache.confirmedPatterns.find((p) => p.descriptionHash === hash)
  return pattern?.classification ?? null
}

// =============================================================================
// LLM Classification (Claude Haiku via raw API)
// =============================================================================

async function classifyWithLLM(
  description: string,
  context: ProjectContext
): Promise<TaskClassification | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const availableDomains = buildAvailableDomains(context)

  const prompt = `Classify this software engineering task into a domain.

Task: "${description}"

Available domains in this project: ${availableDomains.join(', ')}
Available agents: ${context.agents.join(', ') || 'none'}
Stack: ${context.stack?.language || 'unknown'} / ${context.stack?.framework || 'unknown'}

Return ONLY valid JSON (no markdown, no explanation):
{"primaryDomain":"<domain>","secondaryDomains":[],"confidence":0.9,"filePatterns":["src/**"],"relevantAgents":[]}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) return null

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>
    }
    const text = data.content?.[0]?.text
    if (!text) return null

    const parsed = JSON.parse(text)

    // Validate domain is one of our known domains
    const validDomains: ClassificationDomain[] = [
      'frontend',
      'backend',
      'database',
      'devops',
      'testing',
      'docs',
      'uxui',
      'general',
    ]
    if (!validDomains.includes(parsed.primaryDomain)) {
      parsed.primaryDomain = 'general'
    }
    parsed.secondaryDomains = (parsed.secondaryDomains || []).filter((d: string) =>
      validDomains.includes(d as ClassificationDomain)
    )

    return {
      primaryDomain: parsed.primaryDomain,
      secondaryDomains: parsed.secondaryDomains || [],
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.8)),
      filePatterns: parsed.filePatterns || [],
      relevantAgents: parsed.relevantAgents || [],
    }
  } catch {
    return null
  }
}

// =============================================================================
// Improved Heuristic (word-boundary matching, no substring traps)
// =============================================================================

/** Word-boundary keyword map — avoids substring false positives */
const DOMAIN_PATTERNS: Record<ClassificationDomain, RegExp[]> = {
  frontend: [
    /\bui\b/i,
    /\bcomponents?\b/i,
    /\breact\b/i,
    /\bvue\b/i,
    /\bangular\b/i,
    /\bsvelte\b/i,
    /\bnext\.?js\b/i,
    /\bnuxt\b/i,
    /\bcss\b/i,
    /\bscss\b/i,
    /\bstyles?\b/i,
    /\bbuttons?\b/i,
    /\bforms?\b/i,
    /\bmodals?\b/i,
    /\blayout\b/i,
    /\bresponsive\b/i,
    /\banimation\b/i,
    /\bdom\b/i,
    /\bhtml\b/i,
    /\bfrontend\b/i,
    /\bclient[- ]side\b/i,
    /\bbrowser\b/i,
    /\bjsx\b/i,
    /\btsx\b/i,
    /\bhooks?\b/i,
    /\bredux\b/i,
    /\bzustand\b/i,
    /\btailwind\b/i,
    /\bdashboard\b/i,
    /\bpage\b/i,
    /\bnavigation\b/i,
    /\bsidebar\b/i,
    /\bheader\b/i,
    /\bfooter\b/i,
    /\bwidget\b/i,
    /\btooltip\b/i,
    /\bdropdown\b/i,
    /\bcarousel\b/i,
    /\bprofile\s+page\b/i,
    /\bdisplay\b/i,
  ],
  backend: [
    /\bapi\b/i,
    /\bendpoints?\b/i,
    /\bserver\b/i,
    /\broutes?\b/i,
    /\bhandlers?\b/i,
    /\bcontrollers?\b/i,
    /\bservices?\b/i,
    /\bmiddleware\b/i,
    /\bauth\b/i,
    /\bauthentication\b/i,
    /\bauthorization\b/i,
    /\bjwt\b/i,
    /\boauth\b/i,
    /\brest\b/i,
    /\bgraphql\b/i,
    /\btrpc\b/i,
    /\bexpress\b/i,
    /\bfastify\b/i,
    /\bhono\b/i,
    /\bnest\.?js\b/i,
    /\bvalidation\b/i,
    /\bbusiness\s+logic\b/i,
    /\bcron\b/i,
    /\bwebhook\b/i,
    /\bworker\b/i,
    /\bqueue\b/i,
    /\bcache\b/i,
  ],
  database: [
    /\bdatabase\b/i,
    /\bdb\b/i,
    /\bsql\b/i,
    /\bquery\b/i,
    /\btables?\b/i,
    /\bschema\b/i,
    /\bmigrations?\b/i,
    /\bpostgres\b/i,
    /\bmysql\b/i,
    /\bsqlite\b/i,
    /\bmongo\b/i,
    /\bredis\b/i,
    /\bprisma\b/i,
    /\bdrizzle\b/i,
    /\borm\b/i,
    /\bentity\b/i,
    /\brepository\b/i,
    /\bdata\s+layer\b/i,
    /\bpersist\b/i,
    /\bindex(?:es|ing)?\b/i,
    /\bconnection\s+pool\b/i,
  ],
  devops: [
    /\bdocker\b/i,
    /\bkubernetes\b/i,
    /\bk8s\b/i,
    /\bci\b/i,
    /\bcd\b/i,
    /\bpipeline\b/i,
    /\bdeploy\b/i,
    /\bgithub\s+actions\b/i,
    /\bvercel\b/i,
    /\baws\b/i,
    /\bgcp\b/i,
    /\bazure\b/i,
    /\bterraform\b/i,
    /\bnginx\b/i,
    /\bcaddy\b/i,
    /\binfrastructure\b/i,
    /\bmonitoring\b/i,
    /\blogging\b/i,
    /\bcontainer\b/i,
    /\bhelm\b/i,
  ],
  testing: [
    /\btests?\b/i,
    /\bspec\b/i,
    /\bunit\s+tests?\b/i,
    /\bintegration\s+tests?\b/i,
    /\be2e\b/i,
    /\bjest\b/i,
    /\bvitest\b/i,
    /\bplaywright\b/i,
    /\bcypress\b/i,
    /\bmocha\b/i,
    /\bmocks?\b/i,
    /\bstubs?\b/i,
    /\bfixtures?\b/i,
    /\bcoverage\b/i,
    /\bassertions?\b/i,
  ],
  docs: [
    /\bdocument(?:ation)?\b/i,
    /\bdocs\b/i,
    /\breadme\b/i,
    /\bchangelog\b/i,
    /\bjsdoc\b/i,
    /\btutorial\b/i,
    /\bguide\b/i,
    /\bmarkdown\b/i,
  ],
  uxui: [
    /\bdesign\b/i,
    /\bux\b/i,
    /\buser\s+experience\b/i,
    /\baccessibility\b/i,
    /\ba11y\b/i,
    /\bwcag\b/i,
    /\bfigma\b/i,
    /\bprototype\b/i,
    /\bwireframe\b/i,
    /\busability\b/i,
  ],
  general: [],
}

/**
 * Improved heuristic classifier using word-boundary regex.
 * Avoids substring traps like "author" matching "auth".
 */
function classifyWithHeuristic(description: string, context: ProjectContext): TaskClassification {
  const availableDomains = buildAvailableDomains(context)
  const scores = new Map<ClassificationDomain, number>()

  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    if (domain === 'general') continue
    // Only score domains that exist in this project
    if (!availableDomains.includes(domain as ClassificationDomain)) continue

    let score = 0
    for (const pattern of patterns) {
      const matches = description.match(new RegExp(pattern, 'gi'))
      if (matches) {
        // Multi-word patterns score higher
        score += pattern.source.includes('\\s') ? 3 : 1
      }
    }
    if (score > 0) {
      scores.set(domain as ClassificationDomain, score)
    }
  }

  if (scores.size === 0) {
    return GENERAL_CLASSIFICATION
  }

  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
  const primary = sorted[0][0]
  const primaryScore = sorted[0][1]
  const secondary = sorted.slice(1, 3).map(([d]) => d)

  const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0)
  const confidence = Math.min(0.85, primaryScore / totalScore + 0.2)

  // Map domain to file patterns
  const filePatterns = getFilePatterns(primary)

  // Map domain to agent names
  const relevantAgents = context.agents.filter(
    (a) => a === primary || a.includes(primary) || primary.includes(a.replace('.md', ''))
  )

  return {
    primaryDomain: primary,
    secondaryDomains: secondary,
    confidence,
    filePatterns,
    relevantAgents,
  }
}

// =============================================================================
// Helpers
// =============================================================================

function buildAvailableDomains(context: ProjectContext): ClassificationDomain[] {
  const domains: ClassificationDomain[] = []
  if (context.domains.hasFrontend) domains.push('frontend')
  if (context.domains.hasBackend) domains.push('backend')
  if (context.domains.hasDatabase) domains.push('database')
  if (context.domains.hasTesting) domains.push('testing')
  if (context.domains.hasDocker) domains.push('devops')
  // Always include these as possibilities
  domains.push('docs', 'uxui', 'general')
  return domains
}

function getFilePatterns(domain: ClassificationDomain): string[] {
  const patterns: Record<ClassificationDomain, string[]> = {
    frontend: ['src/components/**', 'src/pages/**', 'src/hooks/**', '**/*.tsx', '**/*.jsx'],
    backend: ['src/api/**', 'src/routes/**', 'src/services/**', 'src/handlers/**'],
    database: ['src/models/**', 'src/schemas/**', '**/*.sql', 'prisma/**'],
    devops: ['.github/**', 'docker/**', 'deploy/**', 'infra/**', '**/*.yml', '**/*.yaml'],
    testing: ['**/*.test.*', '**/*.spec.*', 'tests/**', '__tests__/**', 'e2e/**'],
    docs: ['docs/**', '**/*.md', '**/*.mdx'],
    uxui: ['src/components/**', 'src/styles/**', '**/*.css'],
    general: ['**/*.ts', '**/*.js'],
  }
  return patterns[domain] || patterns.general
}

// =============================================================================
// Main Classifier
// =============================================================================

export class DomainClassifier {
  /**
   * Classify a task description into a domain.
   *
   * Fallback chain:
   * 1. Cache lookup (1hr TTL)
   * 2. Confirmed patterns (from completed tasks)
   * 3. LLM call (Claude haiku)
   * 4. Improved heuristic (word-boundary matching)
   */
  async classify(
    description: string,
    projectId: string,
    globalPath: string,
    context: ProjectContext
  ): Promise<{
    classification: TaskClassification
    source: 'cache' | 'history' | 'llm' | 'heuristic'
  }> {
    const hash = hashDescription(description)
    const cache = await loadCache(globalPath)

    // 1. Cache lookup
    const cached = lookupCache(cache, hash, projectId)
    if (cached) {
      return { classification: cached, source: 'cache' }
    }

    // 2. Confirmed patterns
    const pattern = lookupPatterns(cache, hash)
    if (pattern) {
      return { classification: pattern, source: 'history' }
    }

    // 3. LLM call
    const llmResult = await classifyWithLLM(description, context)
    if (llmResult) {
      // Cache the LLM result
      cache.entries[hash] = {
        classification: llmResult,
        classifiedAt: new Date().toISOString(),
        source: 'llm',
        descriptionHash: hash,
        projectId,
      }
      await saveCache(globalPath, cache)
      return { classification: llmResult, source: 'llm' }
    }

    // 4. Heuristic fallback
    const heuristicResult = classifyWithHeuristic(description, context)
    // Cache heuristic results too
    cache.entries[hash] = {
      classification: heuristicResult,
      classifiedAt: new Date().toISOString(),
      source: 'heuristic',
      descriptionHash: hash,
      projectId,
    }
    await saveCache(globalPath, cache)
    return { classification: heuristicResult, source: 'heuristic' }
  }

  /**
   * Persist a classification as a confirmed pattern after successful task completion.
   */
  async confirmClassification(
    description: string,
    classification: TaskClassification,
    globalPath: string
  ): Promise<void> {
    const hash = hashDescription(description)
    const cache = await loadCache(globalPath)

    // Check if already confirmed
    if (cache.confirmedPatterns.some((p) => p.descriptionHash === hash)) return

    cache.confirmedPatterns.push({
      descriptionHash: hash,
      classification,
      confirmedAt: new Date().toISOString(),
      taskDescription: description,
    })
    await saveCache(globalPath, cache)
  }
}

// Singleton
const domainClassifier = new DomainClassifier()
export default domainClassifier
export { hashDescription, classifyWithHeuristic, DOMAIN_PATTERNS }
