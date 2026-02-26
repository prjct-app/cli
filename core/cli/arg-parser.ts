/**
 * CLI Argument Parser
 *
 * Shared argument parsing for CLI entry points.
 * Extracts --json and --md flags, then returns command and remaining args.
 */

export function parseCliArgs(argv: string[] = process.argv) {
  const args = argv.slice(2)

  const jsonIdx = args.indexOf('--json')
  const jsonMode = jsonIdx !== -1
  if (jsonMode) args.splice(jsonIdx, 1)

  const mdIdx = args.indexOf('--md')
  const mdMode = mdIdx !== -1
  if (mdMode) args.splice(mdIdx, 1)

  const [command, ...commandArgs] = args

  return { command, commandArgs, jsonMode, mdMode }
}
