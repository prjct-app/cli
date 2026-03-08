/**
 * MCP Review Tool (1 tool)
 *
 * Builds AI code review context from staged files + AGENTS.md + project analysis.
 * The agent reviews in-context (better than GGA's cold LLM call).
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import llmAnalysisStorage from '../../storage/llm-analysis-storage'
import { resolveProjectId } from '../resolve'

// MCP SDK TS2589 workaround
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

/** Get staged file paths from git */
function getStagedFiles(cwd: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd,
      encoding: 'utf-8',
      timeout: 10_000,
    })
    return output
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
  } catch {
    return []
  }
}

/** Get changed (unstaged) file paths */
function getChangedFiles(cwd: string): string[] {
  try {
    const output = execSync('git diff --name-only --diff-filter=ACMR', {
      cwd,
      encoding: 'utf-8',
      timeout: 10_000,
    })
    return output
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
  } catch {
    return []
  }
}

/** Read file content safely */
function readFileSafe(filePath: string, maxChars = 10_000): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    if (content.length > maxChars) {
      return `${content.slice(0, maxChars)}\n... [truncated at ${maxChars} chars]`
    }
    return content
  } catch {
    return null
  }
}

/** Filter files by include/exclude globs (simple matching) */
function filterFiles(files: string[], include?: string[], exclude?: string[]): string[] {
  let filtered = files

  if (include && include.length > 0) {
    filtered = filtered.filter((f) => include.some((pattern) => matchGlob(f, pattern)))
  }

  if (exclude && exclude.length > 0) {
    filtered = filtered.filter((f) => !exclude.some((pattern) => matchGlob(f, pattern)))
  }

  return filtered
}

/** Simple glob matching (supports *.ext patterns) */
function matchGlob(file: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    return file.endsWith(pattern.slice(1))
  }
  if (pattern.startsWith('**/*.')) {
    return file.endsWith(pattern.slice(3))
  }
  return file.includes(pattern)
}

export function registerReviewTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_review_context',
    'Build AI code review context: staged files + rules (AGENTS.md) + project patterns/anti-patterns. The agent reviews in-context.',
    {
      projectPath: z.string().describe('Project directory path'),
      include: z
        .array(z.string())
        .optional()
        .describe('File patterns to include (e.g. ["*.ts", "*.tsx"])'),
      exclude: z
        .array(z.string())
        .optional()
        .describe('File patterns to exclude (e.g. ["*.test.ts"])'),
      rulesFile: z
        .string()
        .optional()
        .default('AGENTS.md')
        .describe('Rules file path (default: AGENTS.md)'),
    },
    async (args: {
      projectPath: string
      include?: string[]
      exclude?: string[]
      rulesFile: string
    }) => {
      const projectId = await resolveProjectId(args.projectPath)
      const parts: string[] = []

      // 1. Collect files to review
      let files = getStagedFiles(args.projectPath)
      const source = files.length > 0 ? 'staged' : 'changed'
      if (files.length === 0) {
        files = getChangedFiles(args.projectPath)
      }
      if (files.length === 0) {
        return { content: [{ type: 'text', text: 'No staged or changed files to review.' }] }
      }

      files = filterFiles(files, args.include, args.exclude)
      if (files.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No files match include/exclude filters.',
            },
          ],
        }
      }

      parts.push(`## Code Review Context (${files.length} ${source} files)\n`)

      // 2. Load rules (AGENTS.md, CLAUDE.md, or custom)
      const rulesPath = path.join(args.projectPath, args.rulesFile)
      const rules = readFileSafe(rulesPath)
      if (rules) {
        parts.push(`### Rules (${args.rulesFile})\n`)
        parts.push('```markdown')
        parts.push(rules)
        parts.push('```\n')
      }

      // 3. Load project analysis (patterns + anti-patterns + conventions)
      const analysis = llmAnalysisStorage.getActive(projectId)
      if (analysis) {
        if (analysis.patterns?.length) {
          parts.push('### Project Patterns (follow these)\n')
          for (const p of analysis.patterns) {
            parts.push(`- **${p.name}**: ${p.description}`)
          }
          parts.push('')
        }

        if (analysis.antiPatterns?.length) {
          parts.push('### Anti-Patterns (flag these)\n')
          for (const a of analysis.antiPatterns) {
            parts.push(`- **${a.issue}**: ${a.suggestion}`)
          }
          parts.push('')
        }

        if (analysis.conventions?.length) {
          parts.push('### Conventions\n')
          for (const c of analysis.conventions) {
            parts.push(`- [${c.category}] ${c.rule}`)
          }
          parts.push('')
        }
      }

      // 4. File contents
      parts.push('### Files to Review\n')
      for (const file of files.slice(0, 20)) {
        const fullPath = path.join(args.projectPath, file)
        const content = readFileSafe(fullPath)
        if (content) {
          parts.push(`#### \`${file}\`\n`)
          const ext = path.extname(file).slice(1) || 'text'
          parts.push(`\`\`\`${ext}`)
          parts.push(content)
          parts.push('```\n')
        }
      }
      if (files.length > 20) {
        parts.push(`\n... and ${files.length - 20} more files (review the rest manually)\n`)
      }

      // 5. Review instructions
      parts.push('### Review Instructions\n')
      parts.push('Review the files above against the rules, patterns, and conventions.')
      parts.push('For each file, check:')
      parts.push('1. Compliance with rules (AGENTS.md)')
      parts.push('2. Known anti-patterns (flag any matches)')
      parts.push('3. Convention violations')
      parts.push('4. General code quality\n')
      parts.push('End your review with: **STATUS: PASSED** or **STATUS: FAILED**')
      parts.push('If FAILED, list specific violations with file:line references.')

      return { content: [{ type: 'text', text: parts.join('\n') }] }
    }
  )
}
