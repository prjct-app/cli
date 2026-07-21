/**
 * `prjct agent` — owned print-mode agent (one-shot).
 *
 * Requires: prjct llm enable + brain profile (set/use/test).
 * Guest mode (Claude/Grok/Codex) is unchanged.
 */

import path from 'node:path'
import { type AgentStepEvent, runAgent } from '../agent'
import {
  getActiveLlmProfile,
  isOwnedLlmEnabled,
  ownedLlmEnableHint,
  resolveLlmProvider,
} from '../llm'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard } from '../utils/md-aware'
import { mdOutput, mdSection, mdStats } from '../utils/md-formatter'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

interface AgentOptions {
  md?: boolean
  maxSteps?: number
  quiet?: boolean
}

export class AgentCommands extends PrjctCommandsBase {
  async agent(
    intent: string | null = null,
    projectPath: string = process.cwd(),
    options: AgentOptions = {}
  ): Promise<CommandResult> {
    if (!isOwnedLlmEnabled()) {
      return failHard(
        `${ownedLlmEnableHint()}\n\nThen: prjct llm set … && prjct agent "<intent>"`,
        options
      )
    }

    const text = (intent ?? '').trim()
    if (!text) {
      return failHard(
        'Usage: prjct agent "<intent>"\nExample: prjct agent "add a hello() function to src/hi.ts"',
        options
      )
    }

    const profile = getActiveLlmProfile()
    if (!profile) {
      return failHard(
        'No LLM brain configured. Run: prjct llm set --name <n> --key <K>  (or Ollama base-url)\nThen: prjct llm test',
        options
      )
    }

    const provider = await resolveLlmProvider()
    if (!provider) {
      return failHard('Could not resolve LLM provider for the active profile.', options)
    }

    const root = path.resolve(projectPath)
    const maxSteps =
      typeof options.maxSteps === 'number' && options.maxSteps > 0
        ? Math.min(options.maxSteps, 40)
        : 12

    if (!options.md && !options.quiet) {
      out.info(`Owned agent · ${profile.name} · ${profile.model} · maxSteps=${maxSteps} · ${root}`)
    }

    const onStep = options.quiet
      ? undefined
      : (ev: AgentStepEvent) => {
          if (options.md) return
          if (ev.type === 'tool') {
            out.info(`  tool ${ev.name} ${ev.ok ? 'ok' : 'fail'}: ${ev.preview.slice(0, 80)}`)
          } else if (ev.type === 'assistant' && ev.tool_calls.length === 0 && ev.content) {
            // final text printed after run
          }
        }

    try {
      const result = await runAgent({
        intent: text,
        root,
        provider,
        maxSteps,
        onStep,
      })

      if (!result.success) {
        return failHard(result.error ?? 'Agent failed', options)
      }

      const summary = (result.content ?? '').trim() || '(no summary)'

      if (options.md) {
        console.log(
          mdOutput(
            mdSection('Agent done', summary),
            mdStats({
              profile: result.profile,
              model: result.model,
              steps: result.steps,
              'tool calls': result.toolCalls,
              root,
            })
          )
        )
        return {
          success: true,
          content: summary,
          steps: result.steps,
          toolCalls: result.toolCalls,
        }
      }

      out.done(`Agent finished · ${result.steps} step(s) · ${result.toolCalls} tool call(s)`)
      console.log(summary)
      return {
        success: true,
        content: summary,
        steps: result.steps,
        toolCalls: result.toolCalls,
      }
    } catch (e) {
      return failHard(getErrorMessage(e), options)
    }
  }
}
