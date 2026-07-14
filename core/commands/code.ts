/**
 * `prjct code` — structural code intelligence surface (symbol graph).
 *
 * One registered verb, subcommand-parsed (same shape as lean/tdd):
 *   prjct code                     → index stats + optional CBM status
 *   prjct code symbols [pattern]   → search symbols
 *   prjct code trace <name>        → inbound/outbound call path
 *   prjct code impact              → detect_changes (git diff blast + risk)
 *   prjct code architecture        → structural overview (one-shot)
 *   prjct code export              → write .prjct/code-graph.json.gz
 *   prjct code import              → bootstrap index from team artifact
 *   prjct code reindex             → rebuild symbol graph now
 *   prjct code cbm                 → optional CBM bridge status
 */

import {
  hasSymbolIndex,
  indexSymbols,
  listAllSymbols,
  loadMeta,
  searchSymbols,
  tracePath,
} from '../domain/symbol-graph'
import {
  buildArchitectureSnapshot,
  formatArchitectureMd,
  formatArchitectureText,
} from '../services/architecture-snapshot'
import { detectCbm, formatCbmStatus } from '../services/cbm-bridge'
import {
  exportCodeGraphArtifact,
  importCodeGraphArtifact,
  maybeExportAfterIndex,
} from '../services/code-graph-artifact'
import {
  detectChanges,
  formatDetectChangesMd,
  formatDetectChangesText,
} from '../services/detect-changes'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard, failWith } from '../utils/md-aware'
import { mdOutput } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'

export class CodeCommands extends PrjctCommandsBase {
  async code(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const parts = (input ?? '').trim().split(/\s+/).filter(Boolean)
      const sub = (parts[0] ?? '').toLowerCase()
      const rest = parts.slice(1).join(' ')

      if (!sub || sub === 'status' || sub === 'stats') {
        return this.showStats(projectPath, options)
      }
      if (sub === 'symbols' || sub === 'search') {
        return this.symbols(rest, projectPath, options)
      }
      if (sub === 'trace') {
        return this.trace(rest, projectPath, options)
      }
      if (sub === 'impact' || sub === 'detect' || sub === 'changes') {
        return this.impact(projectPath, options)
      }
      if (sub === 'architecture' || sub === 'arch') {
        return this.architecture(projectPath, options)
      }
      if (sub === 'export') {
        return this.exportArtifact(projectPath, options)
      }
      if (sub === 'import' || sub === 'bootstrap') {
        return this.importArtifact(projectPath, options)
      }
      if (sub === 'reindex' || sub === 'index') {
        return this.reindex(projectPath, options)
      }
      if (sub === 'cbm') {
        return this.cbmStatus(options)
      }
      return failWith(
        `Unknown code subcommand "${sub}". Use: symbols | trace | impact | architecture | export | import | reindex | cbm`,
        options
      )
    } catch (error) {
      return failHard(getErrorMessage(error), options)
    }
  }

  private async showStats(projectPath: string, options: MdOption): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const meta = loadMeta(proj.value)
    const ready = hasSymbolIndex(proj.value)
    const cbm = await detectCbm().catch(() => null)
    const cbmLine = cbm ? formatCbmStatus(cbm) : null
    if (options.md) {
      console.log(
        mdOutput(
          '## Code symbol graph',
          ready
            ? [
                `- **Symbols**: ${meta?.symbolCount ?? '?'}`,
                `- **Edges**: ${meta?.edgeCount ?? '?'}`,
                `- **Files**: ${meta?.fileCount ?? '?'}`,
                `- **Built**: ${meta?.builtAt ?? 'unknown'}`,
                cbmLine ? `- **${cbmLine}**` : '',
                '',
                'Commands: `symbols` · `trace` · `impact` · `architecture` · `export` · `import` · `reindex` · `cbm`',
              ]
                .filter(Boolean)
                .join('\n')
            : [
                '> No symbol index yet. Run `prjct sync` or `prjct code reindex`.',
                cbmLine ? `> ${cbmLine}` : '',
              ]
                .filter(Boolean)
                .join('\n')
        )
      )
    } else {
      if (!ready) {
        out.info('Code graph: empty — run `prjct sync` or `prjct code reindex`')
      } else {
        out.info(
          `Code graph: ${meta?.symbolCount ?? 0} symbols · ${meta?.edgeCount ?? 0} edges · ${meta?.fileCount ?? 0} files (built ${meta?.builtAt ?? '?'})`
        )
        out.info('  symbols | trace | impact | architecture | export | import | reindex | cbm')
      }
      if (cbmLine) out.info(`  ${cbmLine}`)
    }
    return { success: true, ready, meta, cbm }
  }

  private async symbols(
    pattern: string,
    projectPath: string,
    options: MdOption
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    if (!hasSymbolIndex(proj.value)) {
      return failWith('No symbol index — run `prjct sync` or `prjct code reindex` first.', options)
    }
    const q = pattern.trim()
    const effective = q
      ? searchSymbols(proj.value, q, { limit: 40 })
      : listAllSymbols(proj.value)
          .filter((s) => s.exported)
          .slice(0, 40)

    if (options.md) {
      const lines = [
        `## Symbols${q ? `: \`${q}\`` : ' (exported sample)'}`,
        '',
        `| Kind | Name | File | Line |`,
        `|---|---|---|---:|`,
      ]
      for (const s of effective) {
        lines.push(`| ${s.kind} | \`${s.name}\` | \`${s.file}\` | ${s.startLine} |`)
      }
      if (effective.length === 0) lines.push('| — | _no matches_ | | |')
      console.log(lines.join('\n'))
    } else {
      if (effective.length === 0) out.info('No symbols matched.')
      else {
        out.info(`${effective.length} symbol(s)${q ? ` matching "${q}"` : ''}:`)
        for (const s of effective) {
          out.info(`  ${s.kind.padEnd(9)} ${s.name}  ${s.file}:${s.startLine}`)
        }
      }
    }
    return { success: true, count: effective.length, symbols: effective }
  }

  private async trace(
    name: string,
    projectPath: string,
    options: MdOption
  ): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const fn = name.trim()
    if (!fn) {
      return failWith('Usage: prjct code trace <functionOrClassName>', options)
    }
    if (!hasSymbolIndex(proj.value)) {
      return failWith('No symbol index — run `prjct sync` or `prjct code reindex` first.', options)
    }
    const result = tracePath(proj.value, fn, { direction: 'both', depth: 3 })
    if (!result) {
      return failWith(`No symbol named "${fn}". Try \`prjct code symbols ${fn}\`.`, options)
    }
    if (options.md) {
      const lines = [
        `## Trace: \`${fn}\``,
        '',
        '### Roots',
        ...result.root.map((r) => `- \`${r.kind}\` **${r.name}** — \`${r.file}:${r.startLine}\``),
        '',
        `### Inbound callers (${result.inbound.length})`,
        ...(result.inbound.length === 0
          ? ['_none_']
          : result.inbound.map(
              (h) =>
                `- d${h.depth} \`${h.symbol.name}\` (${h.symbol.kind}) — \`${h.symbol.file}:${h.symbol.startLine}\``
            )),
        '',
        `### Outbound callees (${result.outbound.length})`,
        ...(result.outbound.length === 0
          ? ['_none_']
          : result.outbound.map(
              (h) =>
                `- d${h.depth} \`${h.symbol.name}\` (${h.symbol.kind}) — \`${h.symbol.file}:${h.symbol.startLine}\``
            )),
      ]
      console.log(lines.join('\n'))
    } else {
      out.info(`Trace ${fn}:`)
      for (const r of result.root) {
        out.info(`  root: ${r.kind} ${r.name} @ ${r.file}:${r.startLine}`)
      }
      out.info(`  inbound (${result.inbound.length}):`)
      for (const h of result.inbound.slice(0, 20)) {
        out.info(`    d${h.depth} ${h.symbol.name} ← ${h.symbol.file}`)
      }
      out.info(`  outbound (${result.outbound.length}):`)
      for (const h of result.outbound.slice(0, 20)) {
        out.info(`    d${h.depth} ${h.symbol.name} → ${h.symbol.file}`)
      }
    }
    return {
      success: true,
      root: result.root,
      inbound: result.inbound.length,
      outbound: result.outbound.length,
    }
  }

  private async impact(projectPath: string, options: MdOption): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const result = await detectChanges(projectPath, proj.value, { source: 'auto' })
    console.log(options.md ? formatDetectChangesMd(result) : formatDetectChangesText(result))
    return { success: true, ...result }
  }

  private async architecture(projectPath: string, options: MdOption): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const snap = buildArchitectureSnapshot(proj.value)
    console.log(options.md ? formatArchitectureMd(snap) : formatArchitectureText(snap))
    return { success: true, ...snap }
  }

  private async exportArtifact(projectPath: string, options: MdOption): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    if (!hasSymbolIndex(proj.value)) {
      return failWith('No symbol index — run `prjct code reindex` first.', options)
    }
    const exp = await exportCodeGraphArtifact(projectPath, proj.value)
    if (!exp) return failWith('Export failed.', options)
    const msg = `Exported ${exp.symbols} symbols · ${exp.edges} edges → ${exp.path} (${exp.bytes} bytes gzip)`
    if (options.md) console.log(mdOutput('## Code graph export', `> ${msg}`))
    else out.success(msg)
    return { success: true, ...exp }
  }

  private async importArtifact(projectPath: string, options: MdOption): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const imp = await importCodeGraphArtifact(projectPath, proj.value)
    if (!imp.imported) {
      return failWith(imp.reason ?? 'Import failed', options)
    }
    const msg = `Imported ${imp.symbols} symbols · ${imp.edges} edges from team artifact`
    if (options.md) console.log(mdOutput('## Code graph import', `> ${msg}`))
    else out.success(msg)
    return { success: true, ...imp }
  }

  private async reindex(projectPath: string, options: MdOption): Promise<CommandResult> {
    const proj = await requireProject(projectPath, options)
    if (!proj.ok) return proj.result
    const meta = await indexSymbols(projectPath, proj.value)
    await maybeExportAfterIndex(projectPath, proj.value)
    const msg = `Indexed ${meta.symbolCount} symbols · ${meta.edgeCount} edges · ${meta.fileCount} files`
    if (options.md) console.log(mdOutput('## Code reindex', `> ${msg}`))
    else out.success(msg)
    return { success: true, meta }
  }

  private async cbmStatus(options: MdOption): Promise<CommandResult> {
    const s = await detectCbm()
    const line = formatCbmStatus(s)
    if (options.md) console.log(mdOutput('## CBM bridge', `> ${line}`))
    else out.info(line)
    return { success: true, ...s }
  }
}
