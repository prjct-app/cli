/**
 * `prjct eval` — deterministic product evals for version-to-version proof.
 *
 * This command is intentionally local-first. `run` stores structured results
 * under PRJCT_CLI_HOME; `publish` can push sanitized run artifacts to GitHub.
 */

import {
  compareEvalRuns,
  type EvalCompareOptions,
  type EvalPublishOptions,
  type EvalRunOptions,
  formatEvalComparisonMarkdown,
  formatEvalRunMarkdown,
  loadLatestEvalRun,
  publishEvalComparison,
  publishEvalRun,
  runEval,
} from '../services/eval-service'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { mdOutput, mdSection } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

interface EvalOptions extends EvalRunOptions, EvalCompareOptions, EvalPublishOptions {
  md?: boolean
  json?: boolean
  publish?: boolean
}

export class EvalCommands extends PrjctCommandsBase {
  async eval(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: EvalOptions = {}
  ): Promise<CommandResult> {
    const [sub = 'run'] = (input ?? '').trim().split(/\s+/).filter(Boolean)
    try {
      switch (sub) {
        case 'run':
          return this.run(projectPath, options)
        case 'compare':
          return this.compare(projectPath, options)
        case 'report':
          return this.report(projectPath, options)
        case 'publish':
          return this.publish(projectPath, options)
        default:
          return this.unknown(sub, options)
      }
    } catch (error) {
      const message = getErrorMessage(error)
      if (options.md) console.log(mdOutput(mdSection('Eval failed', message)))
      else out.fail(message)
      return { success: false, error: message }
    }
  }

  private async run(projectPath: string, options: EvalOptions): Promise<CommandResult> {
    const run = await runEval(projectPath, options)
    if (options.publish) {
      const publish = await publishEvalRun(projectPath, {
        target: options.target,
        dryRun: options.dryRun,
        file: run.artifacts?.jsonPath,
      })
      if (options.json) console.log(JSON.stringify({ run, publish }, null, 2))
      else if (options.md) {
        console.log(
          mdOutput(
            formatEvalRunMarkdown(run),
            mdSection('Published', `Target: \`${publish.target}\`\nURL: ${publish.url ?? '-'}`)
          )
        )
      } else {
        out.done(`eval run ${run.runId} saved and published to ${publish.target}`)
      }
      return { success: true, runId: run.runId, score: run.summary.score, publish }
    }

    if (options.json) console.log(JSON.stringify(run, null, 2))
    else if (options.md) console.log(mdOutput(formatEvalRunMarkdown(run)))
    else out.done(`eval run ${run.runId} saved — score ${run.summary.score}/100`)
    return { success: true, runId: run.runId, score: run.summary.score }
  }

  private async compare(projectPath: string, options: EvalOptions): Promise<CommandResult> {
    const comparison = await compareEvalRuns(projectPath, options)
    if (options.publish) {
      const publish = await publishEvalComparison(projectPath, comparison, {
        target: options.target,
        dryRun: options.dryRun,
      })
      if (options.json) console.log(JSON.stringify({ comparison, publish }, null, 2))
      else if (options.md) {
        console.log(
          mdOutput(
            formatEvalComparisonMarkdown(comparison),
            mdSection(
              'Published',
              `Target: \`${publish.target}\`
URL: ${publish.url ?? '-'}`
            )
          )
        )
      } else {
        const delta = comparison.summary.delta ?? 'n/a'
        out.done(`eval comparison ${comparison.comparisonId} saved and published — delta ${delta}`)
      }
      return {
        success: true,
        comparisonId: comparison.comparisonId,
        publish,
        ...comparison.summary,
      }
    }

    if (options.json) console.log(JSON.stringify(comparison, null, 2))
    else if (options.md) console.log(mdOutput(formatEvalComparisonMarkdown(comparison)))
    else {
      const delta = comparison.summary.delta ?? 'n/a'
      out.done(`eval comparison complete — delta ${delta}`)
    }
    return { success: true, comparisonId: comparison.comparisonId, ...comparison.summary }
  }

  private async report(projectPath: string, options: EvalOptions): Promise<CommandResult> {
    const run = await loadLatestEvalRun(projectPath)
    if (!run) {
      const message = 'No eval run found. Run `prjct eval run` first.'
      if (options.md) console.log(mdOutput(mdSection('No eval report', message)))
      else out.fail(message)
      return { success: false, error: message }
    }
    if (options.json) console.log(JSON.stringify(run, null, 2))
    else if (options.md) console.log(mdOutput(formatEvalRunMarkdown(run)))
    else out.done(`latest eval ${run.runId} — score ${run.summary.score}/100`)
    return { success: true, runId: run.runId, score: run.summary.score }
  }

  private async publish(projectPath: string, options: EvalOptions): Promise<CommandResult> {
    const result = await publishEvalRun(projectPath, options)
    if (options.json) console.log(JSON.stringify(result, null, 2))
    else if (options.md) {
      const files = result.files.map((file) => `- ${file.action}: \`${file.path}\``).join('\n')
      console.log(
        mdOutput(
          mdSection(
            result.dryRun ? 'Eval publish dry run' : 'Eval published',
            `Target: \`${result.target}\`\nRepo: \`${result.repo}\`\nBranch: \`${result.branch}\`\nURL: ${result.url ?? '-'}`
          ),
          mdSection('Files', files)
        )
      )
    } else {
      out.done(
        result.dryRun
          ? `eval publish dry run prepared ${result.files.length} files`
          : `eval published ${result.runId} to ${result.repo}`
      )
    }
    return { success: true, ...result }
  }

  private unknown(sub: string, options: EvalOptions): CommandResult {
    const message = `Unknown eval subcommand: ${sub}. Use run, compare, report, publish.`
    if (options.md) console.log(mdOutput(mdSection('Unknown eval subcommand', message)))
    else out.fail(message)
    return { success: false, error: message }
  }
}
