/**
 * Standalone handlers for the `prjct workflow <intent>` subcommands.
 *
 * Each export is one of the 12 intent targets dispatched from
 * `WorkflowCommands.workflow()` in the parent module. They were
 * formerly private methods on the class, but every one is pure
 * over its arguments + the storage modules — no `this` access
 * beyond `parseAction`/`searchRules` (now imported as plain functions).
 */

import { templateGenerator } from '../../infrastructure/template-generator'
import { customWorkflowStorage } from '../../storage/custom-workflow-storage'
import { workflowRuleStorage } from '../../storage/workflow-rule-storage'
import type { CommandResult } from '../../types/commands'
import { getErrorMessage } from '../../types/fs'
import type { WorkflowRule } from '../../types/storage.js'
import {
  mdCodeBlock,
  mdDone,
  mdList,
  mdNextSteps,
  mdOutput,
  mdSection,
} from '../../utils/md-formatter'
import out from '../../utils/output'
import { detectProjectCommands } from '../../utils/project-commands'
import { parseAction, searchRules } from './intent'
import { buildFlowDiagram } from './md-helpers'

type Options = { md?: boolean }

export async function workflowAdd(
  input: string,
  projectId: string,
  options: Options
): Promise<CommandResult> {
  const [action, rest] = parseAction(input)
  if (!action || !rest) {
    const msg = 'Usage: prjct workflow add "command" before|after <task|done|ship|sync>'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const parts = rest.split(/\s+/)
  const position = parts[0]?.toLowerCase()
  const command = parts[1]?.toLowerCase()

  if (!position || !['before', 'after'].includes(position)) {
    const msg = 'Position must be "before" or "after"'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const workflow = customWorkflowStorage.getWorkflow(projectId, command || '')
  if (!command || !workflow || !workflow.enabled) {
    const workflows = customWorkflowStorage.getAllWorkflows(projectId)
    const workflowNames = workflows.map((w) => w.name).join(', ')
    const msg = `Workflow '${command}' not found. Available: ${workflowNames}`
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const ruleId = workflowRuleStorage.addRule(projectId, {
    type: 'hook',
    command,
    position,
    action,
    description: null,
    enabled: true,
    timeoutMs: 60000,
    createdAt: new Date().toISOString(),
    sortOrder: 0,
  })

  if (options.md) {
    console.log(
      mdOutput(
        mdDone('Rule Added', `#${ruleId} [hook] ${position} ${command} → \`${action}\``),
        mdNextSteps([
          { label: 'View all rules', command: 'prjct workflow --md' },
          { label: 'Remove this rule', command: `prjct workflow rm ${ruleId} --md` },
        ])
      )
    )
  } else {
    out.done(`rule #${ruleId} added: [hook] ${position} ${command} → ${action}`)
  }

  return { success: true, ruleId }
}

export async function workflowGate(
  input: string,
  projectId: string,
  options: Options
): Promise<CommandResult> {
  const parts = input.trim().split(/\s+/)
  const command = parts[0]?.toLowerCase()

  const workflow = customWorkflowStorage.getWorkflow(projectId, command || '')
  if (!command || !workflow || !workflow.enabled) {
    const workflows = customWorkflowStorage.getAllWorkflows(projectId)
    const workflowNames = workflows.map((w) => w.name).join(', ')
    const msg = `Workflow '${command}' not found. Available: ${workflowNames}`
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const actionInput = input.slice(input.indexOf(command) + command.length).trim()
  const [action] = parseAction(actionInput)

  if (!action) {
    const msg = 'Usage: prjct workflow gate <command> "shell command"'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const ruleId = workflowRuleStorage.addRule(projectId, {
    type: 'gate',
    command,
    position: 'before',
    action,
    description: null,
    enabled: true,
    timeoutMs: 60000,
    createdAt: new Date().toISOString(),
    sortOrder: 0,
  })

  if (options.md) {
    console.log(
      mdOutput(
        mdDone('Gate Added', `#${ruleId} [gate] before ${command} → \`${action}\``),
        mdNextSteps([
          { label: 'View all rules', command: 'prjct workflow --md' },
          { label: 'Remove this gate', command: `prjct workflow rm ${ruleId} --md` },
        ])
      )
    )
  } else {
    out.done(`gate #${ruleId} added: before ${command} → ${action}`)
  }

  return { success: true, ruleId }
}

export async function workflowInstruction(
  input: string,
  projectId: string,
  options: Options
): Promise<CommandResult> {
  const parts = input.trim().split(/\s+/)
  const command = parts[0]?.toLowerCase()

  const workflow = customWorkflowStorage.getWorkflow(projectId, command || '')
  if (!command || !workflow || !workflow.enabled) {
    const workflows = customWorkflowStorage.getAllWorkflows(projectId)
    const workflowNames = workflows.map((w) => w.name).join(', ')
    const msg = `Workflow '${command}' not found. Available: ${workflowNames}`
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const afterCommand = input.slice(input.indexOf(command) + command.length).trim()
  const positionMatch = afterCommand.match(/^(before|after)\s+/i)
  if (!positionMatch) {
    const msg = 'Usage: prjct workflow instruction <command> before|after "instruction text"'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const position = positionMatch[1].toLowerCase()
  const actionInput = afterCommand.slice(positionMatch[0].length).trim()
  const [action] = parseAction(actionInput)

  if (!action) {
    const msg = 'Usage: prjct workflow instruction <command> before|after "instruction text"'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const ruleId = workflowRuleStorage.addRule(projectId, {
    type: 'instruction',
    command,
    position,
    action,
    description: null,
    enabled: true,
    timeoutMs: 0,
    createdAt: new Date().toISOString(),
    sortOrder: 0,
  })

  if (options.md) {
    console.log(
      mdOutput(
        mdDone(
          'Instruction Added',
          `#${ruleId} [instruction] ${position} ${command} → \`${action}\``
        ),
        mdNextSteps([
          { label: 'View all rules', command: 'prjct workflow --md' },
          { label: 'Remove this rule', command: `prjct workflow rm ${ruleId} --md` },
        ])
      )
    )
  } else {
    out.done(`instruction #${ruleId} added: ${position} ${command} → ${action}`)
  }

  return { success: true, ruleId }
}

export async function workflowRm(
  input: string,
  projectId: string,
  options: Options
): Promise<CommandResult> {
  const ruleId = parseInt(input.trim(), 10)
  if (Number.isNaN(ruleId)) {
    const msg = 'Usage: prjct workflow rm <rule-id>'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const removed = workflowRuleStorage.removeRule(projectId, ruleId)
  if (!removed) {
    const msg = `Rule #${ruleId} not found`
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  if (options.md) {
    console.log(mdOutput(mdDone('Rule Removed', `Removed rule #${ruleId}`)))
  } else {
    out.done(`removed rule #${ruleId}`)
  }

  return { success: true }
}

export async function workflowReset(projectId: string, options: Options): Promise<CommandResult> {
  const count = workflowRuleStorage.resetRules(projectId)

  if (options.md) {
    console.log(mdOutput(mdDone('Rules Reset', `Removed ${count} rule${count !== 1 ? 's' : ''}`)))
  } else {
    out.done(`reset: removed ${count} rule${count !== 1 ? 's' : ''}`)
  }

  return { success: true, count }
}

export async function workflowDisable(
  input: string,
  projectId: string,
  options: Options
): Promise<CommandResult> {
  const trimmed = input.trim()

  const ruleId = parseInt(trimmed, 10)
  if (!Number.isNaN(ruleId)) {
    const rule = workflowRuleStorage.getRuleById(projectId, ruleId)
    if (!rule) {
      const msg = `Rule #${ruleId} not found`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    if (!rule.enabled) {
      const msg = `Rule #${ruleId} is already disabled`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
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
      out.done(`disabled rule #${ruleId}: ${rule.action}`)
    }

    return { success: true, ruleId }
  }

  const allRules = workflowRuleStorage.getAllRules(projectId)
  const matches = searchRules(allRules, trimmed)

  if (matches.length === 0) {
    const msg = `No rules matching "${trimmed}"`
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  if (matches.length === 1) {
    const rule = matches[0]
    workflowRuleStorage.updateRule(projectId, rule.id, { enabled: false })

    if (options.md) {
      console.log(mdOutput(mdDone('Rule Disabled', `#${rule.id} [${rule.type}] ${rule.action}`)))
    } else {
      out.done(`disabled rule #${rule.id}: ${rule.action}`)
    }
    return { success: true, ruleId: rule.id }
  }

  const capped = matches.slice(0, 5)
  if (options.md) {
    const items = capped.map(
      (r) => `#${r.id} [${r.type}] ${r.position} ${r.command} -> \`${r.action}\``
    )
    if (matches.length > 5) items.push(`...and ${matches.length - 5} more`)
    console.log(
      mdOutput(
        mdSection('Multiple matches', `${matches.length} rules match "${trimmed}"`),
        mdList(items),
        mdNextSteps(
          capped.map((r) => ({
            label: `Disable #${r.id}`,
            command: `prjct workflow disable ${r.id} --md`,
          }))
        )
      )
    )
  } else {
    out.warn(`${matches.length} rules match "${trimmed}" — specify an ID:`)
    for (const r of capped) {
      console.log(`  #${r.id} [${r.type}] ${r.position} ${r.command} -> ${r.action}`)
    }
    if (matches.length > 5) console.log(`  ...and ${matches.length - 5} more`)
  }

  return { success: true, matches: matches.map((r) => r.id) }
}

export async function workflowHelp(options: Options): Promise<CommandResult> {
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
  options: Options
): Promise<CommandResult> {
  const validCommands = ['task', 'done', 'ship', 'sync']

  let rules: WorkflowRule[]
  if (command && validCommands.includes(command)) {
    rules = workflowRuleStorage.getRulesForCommand(projectId, command)
  } else {
    rules = workflowRuleStorage.getAllRules(projectId)
  }

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
      out.warn('no workflow rules configured')
      console.log('')
      console.log('  Add a hook:  prjct workflow add "npm test" before ship')
      console.log('  Add a gate:  prjct workflow gate ship "npm test"')
      console.log('  Reset all:   prjct workflow reset')
    }
    return { success: true, rules: [] }
  }

  if (options.md) {
    const commandsToShow = command ? [command] : validCommands
    const diagrams: string[] = []

    for (const cmd of commandsToShow) {
      const cmdRules = rules.filter((r) => r.command === cmd)
      if (cmdRules.length === 0) continue
      diagrams.push(buildFlowDiagram(cmd, cmdRules))
    }

    const title = command ? `Workflow: ${command}` : 'Workflow Rules'
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
    const title = command ? `WORKFLOW RULES: ${command.toUpperCase()}` : 'WORKFLOW RULES'
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
  options: Options
): Promise<CommandResult> {
  const existingRules = workflowRuleStorage
    .getRulesForCommand(projectId, 'ship')
    .filter((r) => r.position === 'before')

  if (existingRules.length > 0) {
    const msg = `Ship workflow already has ${existingRules.length} rule${existingRules.length !== 1 ? 's' : ''}. Use 'prjct workflow reset' first if you want to reinitialize.`
    if (options.md) {
      console.log(`> ${msg}`)
    } else {
      out.warn(msg)
    }
    return { success: false, error: msg }
  }

  const detected = await detectProjectCommands(projectPath)
  let sortOrder = 0
  const rulesAdded: string[] = []

  const gateId = workflowRuleStorage.addRule(projectId, {
    type: 'gate',
    command: 'ship',
    position: 'before',
    action: 'git branch --show-current | grep -vE "^(main|master)$"',
    description: 'Prevent shipping from main branch',
    enabled: true,
    timeoutMs: 5000,
    sortOrder: sortOrder++,
    createdAt: new Date().toISOString(),
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
      timeoutMs: 120000,
      sortOrder: sortOrder++,
      createdAt: new Date().toISOString(),
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
      timeoutMs: 300000,
      sortOrder: sortOrder++,
      createdAt: new Date().toISOString(),
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
    out.done(`initialized ${rulesAdded.length} workflow rules for ship`)
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
  options: Options
): Promise<CommandResult> {
  const match = input.match(/^(\S+)\s+"([^"]+)"/)
  if (!match) {
    const msg = 'Usage: prjct workflow create <name> "description"'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const [, name, description] = match

  if (!customWorkflowStorage.isValidName(name)) {
    const msg = 'Workflow name must be lowercase alphanumeric + hyphens (e.g., "qa", "deploy-prod")'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  if (customWorkflowStorage.isReservedName(name)) {
    const msg = `Workflow name '${name}' is reserved`
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  const existing = customWorkflowStorage.getWorkflow(projectId, name)
  if (existing) {
    const msg = `Workflow '${name}' already exists`
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  try {
    const workflowId = customWorkflowStorage.createWorkflow(projectId, { name, description })

    const templateResult = await templateGenerator.generateWorkflowTemplate(name, description)
    if (!templateResult.success) {
      // Rollback workflow creation if template generation fails
      customWorkflowStorage.deleteWorkflow(projectId, name)
      const msg = `Failed to generate template: ${templateResult.error}`
      if (options.md) console.log(`> Error: ${msg}`)
      else out.fail(msg)
      return { success: false, error: msg }
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
      out.done(`created workflow: ${name}`)
      console.log(`  ${description}`)
      console.log(`  Template: ${templateResult.path}`)
      console.log(`\nRun with: p. ${name}`)
    }

    return { success: true, workflowId, name, templatePath: templateResult.path }
  } catch (error) {
    const msg = getErrorMessage(error)
    if (options.md) console.log(`> Error: ${msg}`)
    else out.fail(msg)
    return { success: false, error: msg }
  }
}

export async function workflowList(projectId: string, options: Options): Promise<CommandResult> {
  const workflows = customWorkflowStorage.getAllWorkflows(projectId)

  if (workflows.length === 0) {
    const msg = 'No workflows found'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: true, workflows: [] }
  }

  const builtin = workflows.filter((w) => w.isBuiltin)
  const custom = workflows.filter((w) => !w.isBuiltin)

  if (options.md) {
    const sections: string[] = []

    if (builtin.length > 0) {
      const items = builtin.map((w) => `- **${w.name}** — ${w.description}`)
      sections.push(mdSection('Built-in Workflows', items.join('\n')))
    }

    if (custom.length > 0) {
      const items = custom.map((w) => `- **${w.name}** — ${w.description}`)
      sections.push(mdSection('Custom Workflows', items.join('\n')))
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
    out.done(`${workflows.length} workflow${workflows.length !== 1 ? 's' : ''}`)
    if (builtin.length > 0) {
      console.log('\nBuilt-in:')
      for (const w of builtin) {
        console.log(`  ${w.name} — ${w.description}`)
      }
    }
    if (custom.length > 0) {
      console.log('\nCustom:')
      for (const w of custom) {
        console.log(`  ${w.name} — ${w.description}`)
      }
    }
  }

  return { success: true, workflows }
}

export async function workflowDelete(
  input: string,
  projectId: string,
  options: Options
): Promise<CommandResult> {
  const name = input.trim()

  if (!name) {
    const msg = 'Usage: prjct workflow delete <name>'
    if (options.md) console.log(`> ${msg}`)
    else out.warn(msg)
    return { success: false, error: msg }
  }

  try {
    const deleted = customWorkflowStorage.deleteWorkflow(projectId, name)

    if (!deleted) {
      const msg = `Workflow '${name}' not found`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    await templateGenerator.deleteWorkflowTemplate(name)

    if (options.md) {
      console.log(mdOutput(mdDone('Workflow Deleted', `Deleted workflow: ${name}`)))
    } else {
      out.done(`deleted workflow: ${name}`)
    }

    return { success: true }
  } catch (error) {
    const msg = getErrorMessage(error)
    if (options.md) console.log(`> Error: ${msg}`)
    else out.fail(msg)
    return { success: false, error: msg }
  }
}
