/**
 * `prjct embeddings` — configure the GLOBAL semantic-embeddings provider
 * (BYOT). One key, stored securely (macOS Keychain, else a 0600 file), used by
 * every project. Without it, recall uses the always-on local subword embedder.
 *
 * Subcommands:
 *   set --key <K> [--model <M>] [--base-url <U>]   Store key + global settings
 *   status                                          Show provider + key location
 *   test                                            Embed a probe to validate
 *   clear                                           Forget key + settings
 */

import {
  clearGlobalEmbeddings,
  DEFAULT_EMBEDDINGS_MODEL,
  resolveActiveProvider,
  resolveGlobalEmbeddings,
  setGlobalEmbeddings,
} from '../services/embeddings'
import {
  clearEmbeddingsKey,
  getKeyLocation,
  setEmbeddingsKey,
} from '../services/embeddings/secure-key'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard } from '../utils/md-aware'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

interface EmbeddingsOptions {
  md?: boolean
  /** Flags parsed by the CLI arg parser (not left in the positional string). */
  key?: string
  model?: string
  baseUrl?: string
}

function flag(parts: string[], name: string): string | undefined {
  const i = parts.indexOf(`--${name}`)
  if (i >= 0 && parts[i + 1]) return parts[i + 1]
  const eq = parts.find((p) => p.startsWith(`--${name}=`))
  return eq ? eq.slice(name.length + 3) : undefined
}

export class EmbeddingsCommands extends PrjctCommandsBase {
  async embeddings(
    input: string | null = null,
    _projectPath: string = process.cwd(),
    options: EmbeddingsOptions = {}
  ): Promise<CommandResult> {
    const parts = (input ?? '').trim().split(/\s+/).filter(Boolean)
    const sub = parts[0] ?? 'status'
    switch (sub) {
      case 'set':
        return this.set(parts.slice(1), options)
      case 'status':
        return this.status(options)
      case 'test':
        return this.test(options)
      case 'clear':
        return this.clear(options)
      default:
        return failHard(
          `Unknown subcommand '${sub}'. Use: set --key <K> [--model <M>] [--base-url <U>] | status | test | clear`
        )
    }
  }

  private async set(parts: string[], options: EmbeddingsOptions): Promise<CommandResult> {
    // CLI flags arrive in `options`; fall back to parsing the raw string so a
    // direct programmatic call (or a test) works the same way.
    const key = options.key ?? flag(parts, 'key')
    const model = options.model ?? flag(parts, 'model')
    const baseUrl = options.baseUrl ?? flag(parts, 'base-url') ?? flag(parts, 'baseUrl')
    if (!key && !model && !baseUrl) {
      return failHard(
        'Nothing to set. Usage: prjct embeddings set --key <api-key> [--model <id>] [--base-url <url>]'
      )
    }

    let location: 'keychain' | 'file' | undefined
    if (key) {
      try {
        location = await setEmbeddingsKey(key)
      } catch (error) {
        return failHard(`Could not store the key securely: ${getErrorMessage(error)}`)
      }
    }
    const settings = setGlobalEmbeddings({ model, baseUrl })

    out.done('Global embeddings configured (applies to all projects)')
    out.info(`provider: ${settings.provider}`)
    out.info(`model:    ${settings.model}`)
    out.info(`base URL: ${settings.baseUrl}`)
    if (location)
      out.info(
        `api key:  stored in ${location === 'keychain' ? 'macOS Keychain' : '~/.prjct-cli/config/embeddings.key (0600)'}`
      )
    out.info(
      'Each project re-vectorizes on its next session (Stop hook). Run `prjct embeddings test` to validate now.'
    )
    return { success: true }
  }

  private async status(_options: EmbeddingsOptions): Promise<CommandResult> {
    const g = resolveGlobalEmbeddings()
    const loc = await getKeyLocation()
    if (!g) {
      out.info('Global embeddings: not configured — using the built-in local subword embedder.')
      out.info(`api key: ${loc === 'none' ? 'none' : `present (${loc})`}`)
      out.info('Set one with: prjct embeddings set --key <api-key>')
      return { success: true, configured: false }
    }
    out.done('Global embeddings: configured')
    out.info(`provider: ${g.provider}`)
    out.info(`model:    ${g.model}`)
    out.info(`base URL: ${g.baseUrl}`)
    out.info(
      `api key:  ${loc === 'none' ? 'MISSING — set with `prjct embeddings set --key <api-key>`' : `present (${loc})`}`
    )
    return { success: true, configured: true }
  }

  private async test(_options: EmbeddingsOptions): Promise<CommandResult> {
    const provider = resolveActiveProvider(null)
    try {
      const [vector] = await provider.embed(['prjct embeddings connectivity probe'])
      if (!vector || vector.length === 0) {
        return failHard(`Provider '${provider.model}' returned an empty vector.`)
      }
      out.done(`OK — '${provider.model}' returned a ${vector.length}-dim vector.`)
      if (provider.isLocal) {
        out.info(
          'This is the local embedder. Set a key to upgrade: prjct embeddings set --key <api-key>'
        )
      }
      return { success: true, model: provider.model, dims: vector.length }
    } catch (error) {
      return failHard(
        `Embedding failed for '${provider.model}': ${getErrorMessage(error)}. Check the key and base URL.`
      )
    }
  }

  private async clear(_options: EmbeddingsOptions): Promise<CommandResult> {
    await clearEmbeddingsKey()
    clearGlobalEmbeddings()
    out.done('Cleared global embeddings — semantic recall falls back to the local embedder.')
    out.info(`(Default model when you reconfigure: ${DEFAULT_EMBEDDINGS_MODEL}.)`)
    return { success: true }
  }
}
