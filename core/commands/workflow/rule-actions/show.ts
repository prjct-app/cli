/**
 * Read-only handlers — show all/by-command rules and surface help text.
 */

import { workflowRuleStorage } from '../../../storage/workflow-rule-storage'
import type { MdOption } from '../../../types/cli'
import type { CommandResult } from '../../../types/commands'
import type { WorkflowRule } from '../../../types/storage.js'
import { notifyFail } from '../../../utils/md-aware'
import { mdCodeBlock, mdList, mdNextSteps, mdOutput, mdSection } from '../../../utils/md-formatter'
import { buildFlowDiagram } from '../md-helpers'
import { VALID_RULE_COMMANDS } from './_shared'

export async function workflowHelp(options: MdOption): Promise<CommandResult> {
  if (options.md) {
    console.log(
      mdOutput(
        mdSection('Workflow Help', 'Manage hooks, gates, and steps for your workflow'),
        mdSection(
          'Commands',
          mdList([
            '`prjct workflow` — View all rules',
            '`prjct workflow ship` — View rules for a command',
            '`prjct workflow add "npm test" before ship` — Add a hook',
            '`prjct workflow gate ship "npm test"` — Add a blocking gate',
            '`prjct workflow instruction ship after "Post review in Linear"` — Add an agent instruction',
            '`prjct workflow disable 3` — Disable rule #3',
            '`prjct workflow rm 3` — Remove rule #3',
            '`prjct workflow reset` — Remove all rules',
            '`prjct workflow init` — Seed defaults from project',
          ])
        ),
        mdSection(
          'Natural Language (EN/ES)',
          mdList([
            '`prjct workflow "show ship rules"` — muestra / show / list / ver',
            '`prjct workflow "add npm test before ship"` — añade / add / agrega / pon',
            '`prjct workflow "remove 3"` — quita / remove / elimina / borra',
            '`prjct workflow "disable lint"` — deshabilita / disable / apaga',
            '`prjct workflow "gate ship npm test"` — gate / bloquea',
          ])
        )
      )
    )
  } else {
    console.log('')
    console.log('WORKFLOW HELP')
    console.log('──────────────────────────────────')
    console.log('')
    console.log('  Commands:')
    console.log('    prjct workflow                           View all rules')
    console.log('    prjct workflow <command>                 View rules for command')
    console.log('    prjct workflow add "cmd" before ship     Add a hook')
    console.log('    prjct workflow gate ship "cmd"           Add a blocking gate')
    console.log('    prjct workflow instruction ship after "text"  Add an agent instruction')
    console.log('    prjct workflow disable <id|query>        Disable a rule')
    console.log('    prjct workflow rm <id>                   Remove a rule')
    console.log('    prjct workflow reset                     Remove all rules')
    console.log('    prjct workflow init                      Seed defaults')
    console.log('')
    console.log('  Natural language (EN/ES):')
    console.log('    show/muestra  add/añade  remove/quita  disable/deshabilita  gate/bloquea')
    console.log('')
  }

  return { success: true }
}

export async function workflowShow(
  command: string | null,
  projectId: string,
  options: MdOption
): Promise<CommandResult> {
  const filterByCommand =
    command !== null && (VALID_RULE_COMMANDS as readonly string[]).includes(command)

  const rules: WorkflowRule[] = filterByCommand
    ? workflowRuleStorage.getRulesForCommand(projectId, command)
    : workflowRuleStorage.getAllRules(projectId)

  if (rules.length === 0) {
    if (options.md) {
      console.log(
        mdOutput(
          mdSection('Workflow Rules', 'No rules configured'),
          mdNextSteps([
            { label: 'Add a hook', command: 'prjct workflow add "npm test" before ship --md' },
            { label: 'Add a gate', command: 'prjct workflow gate ship "npm test" --md' },
          ])
        )
      )
    } else {
      notifyFail('no workflow rules configured')
      console.log('')
      console.log('  Add a hook:  prjct workflow add "npm test" before ship')
      console.log('  Add a gate:  prjct workflow gate ship "npm test"')
      console.log('  Reset all:   prjct workflow reset')
    }
    return { success: true, rules: [] }
  }

  if (options.md) {
    const commandsToShow = filterByCommand ? [command] : (VALID_RULE_COMMANDS as readonly string[])
    const diagrams: string[] = []
    for (const cmd of commandsToShow) {
      const cmdRules = rules.filter((r) => r.command === cmd)
      if (cmdRules.length === 0) continue
      diagrams.push(buildFlowDiagram(cmd, cmdRules))
    }

    const title = filterByCommand ? `Workflow: ${command}` : 'Workflow Rules'
    const count = `${rules.length} rule${rules.length !== 1 ? 's' : ''}`
    console.log(
      mdOutput(
        mdSection(title, count),
        diagrams.length > 0 ? mdCodeBlock(diagrams.join('\n\n'), '') : null,
        mdNextSteps([
          { label: 'Add a hook', command: 'prjct workflow add "cmd" before ship --md' },
          { label: 'Add a gate', command: 'prjct workflow gate ship "cmd" --md' },
          { label: 'Remove a rule', command: 'prjct workflow rm <id> --md' },
        ])
      )
    )
  } else {
    const title = filterByCommand ? `WORKFLOW RULES: ${command.toUpperCase()}` : 'WORKFLOW RULES'
    console.log('')
    console.log(title)
    console.log('──────────────────────────────────')
    for (const r of rules) {
      const enabled = r.enabled ? '' : ' (disabled)'
      console.log(
        `  #${r.id} [${r.type}]   ${r.position.padEnd(6)} ${r.command.padEnd(5)}  → ${r.action}${enabled}`
      )
    }
    console.log('')
    console.log('Commands: add | gate | rm | reset')
  }

  return { success: true, rules }
}
