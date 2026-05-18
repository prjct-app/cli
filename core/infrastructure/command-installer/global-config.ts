/**
 * Install / update the global AI agent configuration (CLAUDE.md / GEMINI.md)
 * and the bundled documentation files in ~/.prjct-cli/docs/.
 *
 * Extracted from command-installer.ts to keep that facade focused on
 * commands. The CLAUDE.md content is inlined here (post-template
 * deprecation) so the facade no longer carries a 50-line string literal.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { getTemplateContent, listTemplates } from '../../agentic/template-loader'
import { getErrorMessage, isNotFoundError } from '../../types/fs'
import type { GlobalConfigResult } from '../../types/infrastructure'
import { mergeWithMarkers } from '../ide-project-installer'
import pathManager from '../path-manager'

const GLOBAL_CLAUDE_MD_CONTENT = `<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# p/ — Project knowledge layer

prjct stores project memory (decisions, learnings, gotchas, patterns, ships, analyses) per project and regenerates a readable Markdown vault. **Use it — don't re-read source from scratch.**

You are in a prjct project when any of these signs are present: \`~/Documents/prjct/<slug>/_generated/\` exists, OR \`.prjct/\` is in cwd, OR \`~/.prjct-cli/projects/\` has an entry for the current path.

## Lookup FIRST, source LAST

Before reading source code or running broad searches for ANY question about the project (architecture, conventions, decisions, recent ships, bugs, patterns, tech debt, past analyses), READ these vault files first using Read/Glob — no CLI round-trip:

- \`~/Documents/prjct/<slug>/_generated/index.md\` — overview, ships, memory counts, patterns count
- \`~/Documents/prjct/<slug>/_generated/architecture.md\` — domains, conventions, key insights
- \`~/Documents/prjct/<slug>/_generated/{patterns,insights,tech-debt}.md\` — inferred state of the project
- \`~/Documents/prjct/<slug>/_generated/memory/{decision,gotcha,learning,fact,inbox}.md\` — captured knowledge
- \`~/Documents/prjct/<slug>/_generated/analysis/{anti-patterns,insights,patterns,refactors,risk-areas,tech-debt}/\` — past analyses by category
- \`~/Documents/prjct/<slug>/_generated/{ships,releases,tags}/\` — history & taxonomy

Only fall through to source/repo reading when the vault does not contain the answer.

## Capture analyses BACK to prjct

When you complete substantive work — analysis, decision, learning, gotcha discovered — persist it so the next session benefits:

- \`prjct remember decision "<choice + why>"\` — choices made, with rationale
- \`prjct remember learning "<insight>"\` — non-obvious insights gained
- \`prjct remember gotcha "<trap + how to avoid>"\` — bugs/traps found
- \`prjct remember fact "<verifiable claim>"\` — project facts (paths, conventions, IDs)
- \`prjct capture "<text>" --tags type:analysis,topic:<x>\` — analytical dumps & inbox items

Tag with \`--tags k:v,k:v\` for searchability. Memory persists to SQLite; vault auto-regenerates. **Default to capturing — under-capture is the failure mode that makes prjct useless.**

## Workflow

\`prjct task "<desc>"\` → work → \`prjct status done\` → \`prjct ship\`
Pause/resume: \`prjct status paused\` | \`prjct status active\` (also reopens completed tasks)

## Where things live

- Source of truth: SQLite at \`~/.prjct-cli/projects/<id>/\` (don't read directly — use \`prjct\` CLI)
- Read snapshot: vault at \`~/Documents/prjct/<slug>/_generated/\` (Read/Glob freely; never hand-edit — fix the pipeline)
- Project config: \`.prjct/prjct.config.json\` in repo root

The vault regenerates automatically on \`remember\`, \`capture\`, \`ship\`, \`sync\`, and the SessionStart/Stop hooks.

**Auto-managed by prjct-cli** | https://prjct.app
<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
`

export async function installDocs(): Promise<{ success: boolean; error?: string }> {
  try {
    const docsDir = pathManager.getDocsPath()
    await fs.mkdir(docsDir, { recursive: true })

    // Try bundled templates first
    const docKeys = listTemplates('global/docs/')
    if (docKeys.length > 0) {
      for (const key of docKeys) {
        if (key.endsWith('.md')) {
          const content = getTemplateContent(key)
          if (content) {
            await fs.writeFile(path.join(docsDir, path.basename(key)), content, 'utf-8')
          }
        }
      }
      return { success: true }
    }

    // Fall back to filesystem
    const { PACKAGE_ROOT } = require('../../utils/version')
    const templateDocsDir = path.join(PACKAGE_ROOT, 'templates/global/docs')
    try {
      const docFiles = await fs.readdir(templateDocsDir)
      for (const file of docFiles) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(templateDocsDir, file), 'utf-8')
          await fs.writeFile(path.join(docsDir, file), content, 'utf-8')
        }
      }
    } catch {
      // No docs directory — that's fine
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function installGlobalConfig(): Promise<GlobalConfigResult> {
  const aiProvider = require('../ai-provider')
  const activeProvider = await aiProvider.getActiveProvider()
  const providerName = activeProvider.name

  const detection = await aiProvider.detectProvider(providerName)
  if (!detection.installed && !activeProvider.configDir) {
    return {
      success: false,
      error: `${activeProvider.displayName} not detected`,
      action: 'skipped',
    }
  }

  try {
    await fs.mkdir(activeProvider.configDir, { recursive: true })

    const globalConfigPath = path.join(activeProvider.configDir, activeProvider.contextFile)

    // Use inline content for Claude, or provider-specific template for others
    let templateContent = GLOBAL_CLAUDE_MD_CONTENT

    if (providerName !== 'claude') {
      // Try provider-specific template (bundle then filesystem)
      const bundled = getTemplateContent(`global/${activeProvider.contextFile}`)
      if (bundled) {
        templateContent = bundled
      } else {
        const { PACKAGE_ROOT } = require('../../utils/version')
        const templatePath = path.join(
          PACKAGE_ROOT,
          'templates',
          'global',
          activeProvider.contextFile
        )
        try {
          templateContent = await fs.readFile(templatePath, 'utf-8')
        } catch {
          if (providerName === 'gemini') {
            templateContent = GLOBAL_CLAUDE_MD_CONTENT.replace(/Claude/g, 'Gemini')
          }
        }
      }
    }

    let existingContent = ''
    let fileExists = false

    try {
      existingContent = await fs.readFile(globalConfigPath, 'utf-8')
      fileExists = true
    } catch (error) {
      if (isNotFoundError(error)) fileExists = false
      else throw error
    }

    // Strip legacy prjct-project sections (static context generation removed)
    const projectStartMarker = '<!-- prjct-project:start - DO NOT REMOVE THIS MARKER -->'
    const projectEndMarker = '<!-- prjct-project:end - DO NOT REMOVE THIS MARKER -->'
    if (
      existingContent.includes(projectStartMarker) &&
      existingContent.includes(projectEndMarker)
    ) {
      const beforeProject = existingContent.substring(
        0,
        existingContent.indexOf(projectStartMarker)
      )
      const afterProject = existingContent.substring(
        existingContent.indexOf(projectEndMarker) + projectEndMarker.length
      )
      existingContent = `${(beforeProject + afterProject).replace(/\n{3,}/g, '\n\n').trim()}\n`
    }

    const startMarker = '<!-- prjct:start - DO NOT REMOVE THIS MARKER -->'
    const endMarker = '<!-- prjct:end - DO NOT REMOVE THIS MARKER -->'

    const merged = mergeWithMarkers(
      fileExists ? existingContent : '',
      templateContent,
      startMarker,
      endMarker
    )

    await fs.writeFile(globalConfigPath, merged.content, 'utf-8')
    return { success: true, action: merged.action, path: globalConfigPath }
  } catch (error) {
    return { success: false, error: getErrorMessage(error), action: 'failed' }
  }
}
