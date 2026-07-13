/**
 * Types for the portable multi-host skill installer.
 *
 * L0 skill is project-agnostic — no SkillContext / rich project payload.
 */

export interface SkillDefinition {
  name: string
  description: string
  allowedTools: string[]
  /** Whether users can invoke this skill directly (default true) */
  userInvocable?: boolean
  /** Generate the skill body (always portable L0) */
  body: () => string
  /**
   * Deep methodology written next to SKILL.md and pulled on demand
   * (progressive disclosure). Requires `referenceFile`.
   */
  reference?: () => string
  /** Filename for `reference` within the skill dir (e.g. `workflows.md`). */
  referenceFile?: string
}
