/**
 * Command Context Schema
 *
 * Zod schemas for command-context.config.json.
 * Controls which context sections (agents, patterns, checklists, modules)
 * get injected into prompts for each command.
 *
 * @see PRJ-298
 */

import { z } from 'zod'

export const CommandContextEntrySchema = z.object({
  agents: z.boolean(),
  patterns: z.boolean(),
  checklist: z.boolean(),
  modules: z.array(z.string()),
})

export const CommandContextConfigSchema = z.object({
  version: z.string(),
  description: z.string().optional(),
  commands: z.record(z.string(), CommandContextEntrySchema).refine((commands) => '*' in commands, {
    message: 'Config must include a "*" wildcard entry for unknown commands',
  }),
})

export type CommandContextEntry = z.infer<typeof CommandContextEntrySchema>
export type CommandContextConfig = z.infer<typeof CommandContextConfigSchema>
