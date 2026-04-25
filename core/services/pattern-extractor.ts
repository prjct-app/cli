import path from 'node:path'
import { prjctDb } from '../storage/database'
import type {
  ExtractedAntiPattern,
  ExtractedPattern,
  ExtractPatternInput,
  ExtractPatternResult,
} from '../types/services.js'
import { uniqueBy } from '../utils/collection-filters'
import { sha256Short } from '../utils/hash'

function repoHash(projectPath: string): string {
  return sha256Short(path.resolve(projectPath))
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function dedupePatterns(input: ExtractedPattern[]): ExtractedPattern[] {
  return uniqueBy(input, (p) => `${normalizeKey(p.name)}::${normalizeKey(p.source)}`)
}

function dedupeAntiPatterns(input: ExtractedAntiPattern[]): ExtractedAntiPattern[] {
  return uniqueBy(
    input,
    (p) => `${normalizeKey(p.issue)}::${normalizeKey(p.file)}::${normalizeKey(p.source)}`
  )
}

class PatternExtractor {
  async extract(input: ExtractPatternInput): Promise<ExtractPatternResult> {
    const hash = repoHash(input.projectPath)

    // Context7 patterns — real-time API validation, not hardcoded heuristics
    const context7Patterns: ExtractedPattern[] = []
    if (input.context7Verified) {
      for (const framework of input.frameworks) {
        context7Patterns.push({
          name: `${framework} API validation via Context7`,
          description: `Validate ${framework} APIs against current documentation through Context7 before implementation.`,
          framework,
          source: 'context7',
          confidence: 0.7,
        })
      }
    }

    // Feedback patterns — confirmed by completed tasks (real data, not heuristic)
    const feedbackPatterns: ExtractedPattern[] = (input.feedback?.patternsDiscovered || []).map(
      (p) => ({
        name: p,
        description: `Confirmed during completed tasks: ${p}`,
        source: 'feedback',
        confidence: 0.75,
      })
    )
    const feedbackAntiPatterns: ExtractedAntiPattern[] = (input.feedback?.knownGotchas || []).map(
      (g) => ({
        issue: g,
        file: 'multiple',
        suggestion: `Recurring gotcha. Prevent this pattern during implementation: ${g}`,
        source: 'feedback',
        severity: 'medium',
        confidence: 0.7,
      })
    )

    const patterns = dedupePatterns([...context7Patterns, ...feedbackPatterns])
    const antiPatterns = dedupeAntiPatterns([...feedbackAntiPatterns])

    const key = `analysis:derived-rules:${hash}`
    prjctDb.setDoc(input.projectId, key, {
      projectId: input.projectId,
      repoPathHash: hash,
      patterns,
      antiPatterns,
      updatedAt: new Date().toISOString(),
      version: 1,
    })

    return { patterns, antiPatterns, repoPathHash: hash }
  }
}

const patternExtractor = new PatternExtractor()
export default patternExtractor
