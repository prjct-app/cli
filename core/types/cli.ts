/**
 * Cross-command CLI option types.
 *
 * Pre-2.15 we had `{ md?: boolean }` as an inline type literal in 50+
 * places (every command method's `options` param). That repetition
 * was a magnet for drift — anyone adding a new flag had to update
 * every call site, and several files defined a private `type Options`
 * that meant the same thing. This module is the single shape every
 * command imports.
 */

/**
 * Options shared by every CLI command — the only universal flag is
 * `--md`, which switches output from interactive (chalk + spinners) to
 * deterministic markdown agent-readable strings.
 */
export interface MdOption {
  md?: boolean
}
