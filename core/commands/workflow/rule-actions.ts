/**
 * Standalone handlers for the `prjct workflow <intent>` subcommands.
 *
 * Each export is one of the 12 intent targets dispatched from
 * `WorkflowCommands.workflow()` in the parent module. The shared
 * boilerplate that previously dominated this file (the "warn-and-fail"
 * pair, the "workflow not found" guard, the magic-number timeouts) now
 * lives in:
 *
 *   - `core/utils/md-aware.ts`    — `notify*` + `failWith`
 *   - `core/commands/guards.ts`   — `requireWorkflow`
 *   - `core/workflow/timeouts.ts` — `WORKFLOW_TIMEOUTS`
 */

import { templateGenerator } from '../../infrastructure/template-generator'
import { customWorkflowStorage } from '../../storage/custom-workflow-storage'
import { workflowRuleStorage } from '../../storage/workflow-rule-storage'
import type { MdOption } from '../../types/cli'
import type { CommandResult } from '../../types/commands'
import { getErrorMessage } from '../../types/fs'
import type { WorkflowRule } from '../../types/storage.js'
import { failWith, notifyDone, notifyFail } from '../../utils/md-aware'
import {
  mdCodeBlock,
  mdDone,
  mdList,
  mdNextSteps,
  mdOutput,
  mdSection,
} from '../../utils/md-formatter'
import { detectProjectCommands } from '../../utils/project-commands'
import { WORKFLOW_TIMEOUTS } from '../../workflow/timeouts'
import { requireWorkflow } from '../guards'
import { parseAction, searchRules } from './intent'
import { buildFlowDiagram } from './md-helpers'

const VALID_RULE_COMMANDS = ['task', 'done', 'ship', 'sync'] as const
const RULE_POSITIONS = ['before', 'after'] as const
const MAX_LISTED_MATCHES = 5

type RulePosition = (typeof RULE_POSITIONS)[number]

/**
 * Common shape for `addRule` calls — every handler passed the same
 * `description: null, enabled: true, sortOrder: 0` defaults plus a
 * fresh ISO timestamp. Centralised so a future schema change touches
 * one site.
 */
function newRuleDefaults(): {
  description: null
  enabled: true
  sortOrder: 0
  createdAt: string
} {
  return {
    description: null,
    enabled: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
  }
}

export async function workflowAdd(
  input: string,
  projectId: string,
  options: MdOption
): Promise<CommandResult> {
  const [action, rest] = parseAction(input)
  if (!action || !rest) {
    return failWith(
      'Usage: prjct workflow add "command" before|after <task|done|ship|sync>',
      options
    )
  }

  const parts = rest.split(/\s+/)
  const position = parts[0]?.toLowerCase() as RulePosition | undefined
  const command = parts[1]?.toLowerCase()

  if (!position || !RULE_POSITIONS.includes(position)) {
    return failWith('Position must be "before" or "after"', options)
  }

  const guard = requireWorkflow(projectId, command, options)
  if (!guard.ok) return guard.result

  const ruleId = workflowRuleStorage.addRule(projectId, {
    type: 'hook',
    command: guard.value.name,
    position,
    action,
    timeoutMs: WORKFLOW_TIMEOUTS.HOOK_DEFAULT_MS,
    ...newRuleDefaults(),
  })

  if (options.md) {
    console.log(
      mdOutput(
        mdDone('Rule Added', `#${ruleId} [hook] ${position} ${guard.value.name} → \`${action}\``),
        mdNextSteps([
          { label: 'View all rules', command: 'prjct workflow --md' },
          { label: 'Remove this rule', command: `prjct workflow rm ${ruleId} --md` },
        ])
      )
    )
  } else {
    notifyDone(`rule #${ruleId} added: [hook] ${position} ${guard.value.name} → ${action}`)
  }

  return { success: true, ruleId }
}

export async function workflowGate(
  input: string,
  projectId: string,
  options: MdOption
): Promise<CommandResult> {
  const command = input.trim().split(/\s+/)[0]?.toLowerCase()
  const guard = requireWorkflow(projectId, command, options)
  if (!guard.ok) return guard.result

  const actionInput = input.slice(input.indexOf(guard.value.name) + guard.value.name.length).trim()
  const [action] = parseAction(actionInput)

  if (!action) {
    return failWith('Usage: prjct workflow gate <command> "shell command"', options)
  }

  const ruleId = workflowRuleStorage.addRule(projectId, {
    type: 'gate',
    command: guard.value.name,
    position: 'before',
    action,
    timeoutMs: WORKFLOW_TIMEOUTS.GATE_DEFAULT_MS,
    ...newRuleDefaults(),
  })

  if (options.md) {
    console.log(
      mdOutput(
        mdDone('Gate Added', `#${ruleId} [gate] before ${guard.value.name} → \`${action}\``),
        mdNextSteps([
          { label: 'View all rules', command: 'prjct workflow --md' },
          { label: 'Remove this gate', command: `prjct workflow rm ${ruleId} --md` },
        ])
      )
    )
  } else {
    notifyDone(`gate #${ruleId} added: before ${guard.value.name} → ${action}`)
  }

  return { success: true, ruleId }
}

export async function workflowInstruction(
  input: string,
  projectId: string,
  options: MdOption
): Promise<CommandResult> {
  const command = input.trim().split(/\s+/)[0]?.toLowerCase()
  const guard = requireWorkflow(projectId, command, options)
  if (!guard.ok) return guard.result

  const afterCommand = input.slice(input.indexOf(guard.value.name) + guard.value.name.length).trim()
  const positionMatch = afterCommand.match(/^(before|after)\s+/i)
  if (!positionMatch) {
    return failWith(
      'Usage: prjct workflow instruction <command> before|after "instruction text"',
      options
    )
  }

  const position = positionMatch[1].toLowerCase() as RulePosition
  const actionInput = afterCommand.slice(positionMatch[0].length).trim()
  const [action] = parseAction(actionInput)

  if (!action) {
    return failWith(
      'Usage: prjct workflow instruction <command> before|after "instruction text"',
      options
    )
  }

  const ruleId = workflowRuleStorage.addRule(projectId, {
    type: 'instruction',
    command: guard.value.name,
    position,
    action,
    timeoutMs: WORKFLOW_TIMEOUTS.INSTRUCTION_MS,
    ...newRuleDefaults(),
  })

  if (options.md) {
    console.log(
      mdOutput(
        mdDone(
          'Instruction Added',
          `#${ruleId} [instruction] ${position} ${guard.value.name} → \`${action}\``
        ),
        mdNextSteps([
          { label: 'View all rules', command: 'prjct workflow --md' },
          { label: 'Remove this rule', command: `prjct workflow rm ${ruleId} --md` },
        ])
      )
    )
  } else {
    notifyDone(`instruction #${ruleId} added: ${position} ${guard.value.name} → ${action}`)
  }

  return { success: true, ruleId }
}

export async function workflowRm(
  input: string,
  projectId: string,
  options: MdOption
): Promise<CommandResult> {
  const ruleId = parseInt(input.trim(), 10)
  if (Number.isNaN(ruleId)) {
    return failWith('Usage: prjct workflow rm <rule-id>', options)
  }

  const removed = workflowRuleStorage.removeRule(projectId, ruleId)
  if (!removed) return failWith(`Rule #${ruleId} not found`, options)

  if (options.md) {
    console.log(mdOutput(mdDone('Rule Removed', `Removed rule #${ruleId}`)))
  } else {
    notifyDone(`removed rule #${ruleId}`)
  }

  return { success: true }
}

export async function workflowReset(projectId: string, options: MdOption): Promise<CommandResult> {
  const count = workflowRuleStorage.resetRules(projectId)
  const summary = `Removed ${count} rule${count !== 1 ? 's' : ''}`
  if (options.md) {
    console.log(mdOutput(mdDone('Rules Reset', summary)))
  } else {
    notifyDone(`reset: ${summary.toLowerCase()}`)
  }
  return { success: true, count }
}

export async function workflowDisable(
  input: string,
  projectId: string,
  options: MdOption
): Promise<CommandResult> {
  const trimmed = input.trim()
  const ruleId = parseInt(trimmed, 10)

  if (!Number.isNaN(ruleId)) {
    const rule = workflowRuleStorage.getRuleById(projectId, ruleId)
    if (!rule) return failWith(`Rule #${ruleId} not found`, options)

    if (!rule.enabled) {
      const msg = `Rule #${ruleId} is already disabled`
      if (options.md) console.log(`> ${msg}`)
      else notifyFail(msg)
      return { success: true, message: msg }
    }

    workflowRuleStorage.updateRule(projectId, ruleId, { enabled: false })

    if (options.md) {
      console.log(
        mdOutput(
          mdDone('Rule Disabled', `#${ruleId} [${rule.type}] ${rule.action}`),
          mdNextSteps([
            { label: 'Re-enable this rule', command: `prjct workflow enable ${ruleId} --md` },
            { label: 'View all rules', command: 'prjct workflow --md' },
          ])
        )
      )
    } else {
      notifyDone(`disabled rule #${ruleId}: ${rule.action}`)
    }

    return { success: true, ruleId }
  }

  const allRules = workflowRuleStorage.getAllRules(projectId)
  const matches = searchRules(allRules, trimmed)

  if (matches.length === 0) return failWith(`No rules matching "${trimmed}"`, options)

  if (matches.length === 1) {
    const rule = matches[0]
    workflowRuleStorage.updateRule(projectId, rule.id, { enabled: false })
    if (options.md) {
      console.log(mdOutput(mdDone('Rule Disabled', `#${rule.id} [${rule.type}] ${rule.action}`)))
    } else {
      notifyDone(`disabled rule #${rule.id}: ${rule.action}`)
    }
    return { success: true, ruleId: rule.id }
  }

  // Multiple matches → ask user to be more specific.
  const capped = matches.slice(0, MAX_LISTED_MATCHES)
  const overflow = matches.length - MAX_LISTED_MATCHES
  const overflowMsg = overflow > 0 ? `...and ${overflow} more` : null

  if (options.md) {
    const items: string[] = capped.map(
      (r: WorkflowRule) => `#${r.id} [${r.type}] ${r.position} ${r.command} -> \`${r.action}\``
    )
    if (overflowMsg) items.push(overflowMsg)
    console.log(
      mdOutput(
        mdSection('Multiple matches', `${matches.length} rules match "${trimmed}"`),
        mdList(items),
        mdNextSteps(
          capped.map((r: WorkflowRule) => ({
            label: `Disable #${r.id}`,
            command: `prjct workflow disable ${r.id} --md`,
          }))
        )
      )
    )
  } else {
    notifyFail(`${matches.length} rules match "${trimmed}" — specify an ID:`)
    for (const r of capped) {
      console.log(`  #${r.id} [${r.type}] ${r.position} ${r.command} -> ${r.action}`)
    }
    if (overflowMsg) console.log(`  ${overflowMsg}`)
  }

  return { success: true, matches: matches.map((r: WorkflowRule) => r.id) }
}

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

export async function workflowInit(
  projectId: string,
  projectPath: string,
  options: MdOption
): Promise<CommandResult> {
  const existingRules = workflowRuleStorage
    .getRulesForCommand(projectId, 'ship')
    .filter((r) => r.position === 'before')

  if (existingRules.length > 0) {
    return failWith(
      `Ship workflow already has ${existingRules.length} rule${existingRules.length !== 1 ? 's' : ''}. Use 'prjct workflow reset' first if you want to reinitialize.`,
      options
    )
  }

  const detected = await detectProjectCommands(projectPath)
  let sortOrder = 0
  const rulesAdded: string[] = []
  const ts = () => new Date().toISOString()

  const gateId = workflowRuleStorage.addRule(projectId, {
    type: 'gate',
    command: 'ship',
    position: 'before',
    action: 'git branch --show-current | grep -vE "^(main|master)$"',
    description: 'Prevent shipping from main branch',
    enabled: true,
    timeoutMs: WORKFLOW_TIMEOUTS.GATE_QUICK_MS,
    sortOrder: sortOrder++,
    createdAt: ts(),
  })
  rulesAdded.push(`#${gateId} [gate] prevent main branch`)

  if (detected.lint) {
    const lintId = workflowRuleStorage.addRule(projectId, {
      type: 'step',
      command: 'ship',
      position: 'before',
      action: `${detected.lint.command} || true`,
      description: 'Lint code',
      enabled: true,
      timeoutMs: WORKFLOW_TIMEOUTS.STEP_LINT_MS,
      sortOrder: sortOrder++,
      createdAt: ts(),
    })
    rulesAdded.push(`#${lintId} [step] lint → ${detected.lint.command}`)
  }

  if (detected.test) {
    const testId = workflowRuleStorage.addRule(projectId, {
      type: 'step',
      command: 'ship',
      position: 'before',
      action: `${detected.test.command} || true`,
      description: 'Run tests',
      enabled: true,
      timeoutMs: WORKFLOW_TIMEOUTS.STEP_TEST_MS,
      sortOrder: sortOrder++,
      createdAt: ts(),
    })
    rulesAdded.push(`#${testId} [step] test → ${detected.test.command}`)
  }

  if (options.md) {
    console.log(
      mdOutput(
        mdDone('Workflow Initialized', `Added ${rulesAdded.length} default ship rules`),
        mdList(rulesAdded),
        mdNextSteps([
          { label: 'View all rules', command: 'prjct workflow --md' },
          { label: 'Ship your work', command: 'prjct ship --md' },
        ])
      )
    )
  } else {
    notifyDone(`initialized ${rulesAdded.length} workflow rules for ship`)
    for (const rule of rulesAdded) {
      console.log(`  ${rule}`)
    }
  }

  return { success: true, rulesAdded: rulesAdded.length }
}

export async function workflowCreate(
  input: string,
  projectId: string,
  _projectPath: string,
  options: MdOption
): Promise<CommandResult> {
  const match = input.match(/^(\S+)\s+"([^"]+)"/)
  if (!match) {
    return failWith('Usage: prjct workflow create <name> "description"', options)
  }

  const [, name, description] = match

  if (!customWorkflowStorage.isValidName(name)) {
    return failWith(
      'Workflow name must be lowercase alphanumeric + hyphens (e.g., "qa", "deploy-prod")',
      options
    )
  }

  if (customWorkflowStorage.isReservedName(name)) {
    return failWith(`Workflow name '${name}' is reserved`, options)
  }

  if (customWorkflowStorage.getWorkflow(projectId, name)) {
    return failWith(`Workflow '${name}' already exists`, options)
  }

  try {
    const workflowId = customWorkflowStorage.createWorkflow(projectId, { name, description })

    const templateResult = await templateGenerator.generateWorkflowTemplate(name, description)
    if (!templateResult.success) {
      // Rollback workflow creation if template generation fails.
      customWorkflowStorage.deleteWorkflow(projectId, name)
      return failWith(`Failed to generate template: ${templateResult.error}`, options)
    }

    if (options.md) {
      console.log(
        mdOutput(
          mdDone('Workflow Created', `Created workflow: ${name}`),
          mdSection('Description', description),
          mdSection('Template', `Installed at ${templateResult.path}`),
          mdNextSteps([
            { label: 'Add rules', command: `prjct workflow add "action" before ${name} --md` },
            { label: 'View workflow', command: `prjct workflow ${name} --md` },
            { label: 'Run workflow', command: `p. ${name}` },
          ])
        )
      )
    } else {
      notifyDone(`created workflow: ${name}`)
      console.log(`  ${description}`)
      console.log(`  Template: ${templateResult.path}`)
      console.log(`\nRun with: p. ${name}`)
    }

    return { success: true, workflowId, name, templatePath: templateResult.path }
  } catch (error) {
    return failWith(getErrorMessage(error), options)
  }
}

export async function workflowList(projectId: string, options: MdOption): Promise<CommandResult> {
  const workflows = customWorkflowStorage.getAllWorkflows(projectId)

  if (workflows.length === 0) {
    if (options.md) console.log('> No workflows found')
    else notifyFail('No workflows found')
    return { success: true, workflows: [] }
  }

  const builtin = workflows.filter((w) => w.isBuiltin)
  const custom = workflows.filter((w) => !w.isBuiltin)
  const renderRow = (w: { name: string; description: string | null }) =>
    `- **${w.name}** — ${w.description ?? ''}`

  if (options.md) {
    const sections: string[] = []
    if (builtin.length > 0) {
      sections.push(mdSection('Built-in Workflows', builtin.map(renderRow).join('\n')))
    }
    if (custom.length > 0) {
      sections.push(mdSection('Custom Workflows', custom.map(renderRow).join('\n')))
    }
    console.log(
      mdOutput(
        ...sections,
        mdNextSteps([
          {
            label: 'Create workflow',
            command: 'prjct workflow create <name> "description" --md',
          },
          { label: 'View workflow', command: 'prjct workflow <name> --md' },
        ])
      )
    )
  } else {
    notifyDone(`${workflows.length} workflow${workflows.length !== 1 ? 's' : ''}`)
    if (builtin.length > 0) {
      console.log('\nBuilt-in:')
      for (const w of builtin) console.log(`  ${w.name} — ${w.description}`)
    }
    if (custom.length > 0) {
      console.log('\nCustom:')
      for (const w of custom) console.log(`  ${w.name} — ${w.description}`)
    }
  }

  return { success: true, workflows }
}

export async function workflowDelete(
  input: string,
  projectId: string,
  options: MdOption
): Promise<CommandResult> {
  const name = input.trim()
  if (!name) return failWith('Usage: prjct workflow delete <name>', options)

  try {
    const deleted = customWorkflowStorage.deleteWorkflow(projectId, name)
    if (!deleted) return failWith(`Workflow '${name}' not found`, options)

    await templateGenerator.deleteWorkflowTemplate(name)

    if (options.md) {
      console.log(mdOutput(mdDone('Workflow Deleted', `Deleted workflow: ${name}`)))
    } else {
      notifyDone(`deleted workflow: ${name}`)
    }
    return { success: true }
  } catch (error) {
    return failWith(getErrorMessage(error), options)
  }
}
