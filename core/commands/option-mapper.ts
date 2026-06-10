/**
 * Generic wire-options → handler-options mapping, driven by a command's
 * `optionSchema` (command-data.ts). Both the daemon dispatch and the cold
 * path in core/index.ts route schema-covered commands through this one
 * function, so a command can never lose its flags by missing a
 * hand-written case — the daemon "flag-strip" bug class is gone by
 * construction.
 *
 * Schema keys are the handler's camelCase option names; wire flags arrive
 * kebab-cased (`--no-spec-gate`), so each key is looked up in both forms.
 */

import type { CommandOptionSchema } from '../types/commands'

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function mapOptions(
  opts: Record<string, unknown>,
  schema: CommandOptionSchema
): Record<string, unknown> {
  const pick = (key: string): unknown => (opts[key] !== undefined ? opts[key] : opts[kebab(key)])
  const result: Record<string, unknown> = { md: opts.md === true }
  for (const key of schema.booleans ?? []) {
    result[key] = pick(key) === true
  }
  for (const key of schema.strings ?? []) {
    const v = pick(key)
    result[key] = v != null && v !== false && v !== '' ? String(v) : undefined
  }
  for (const key of schema.numbers ?? []) {
    const v = pick(key)
    result[key] = v != null && v !== false && v !== '' ? Number(v) : undefined
  }
  return result
}
