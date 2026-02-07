#!/usr/bin/env bun

/**
 * Linear CLI - Bridge between templates and SDK
 *
 * Usage: bun core/cli/linear.ts --project <projectId> <command> [args...]
 *
 * Flags:
 *   --project <id>   - Project ID (required)
 *   --json           - Output raw JSON (default: human-readable)
 *   --verbose        - Show all details (no truncation)
 *
 * Commands:
 *   setup <apiKey> [teamId]    - Store API key in project credentials
 *   list                       - List my assigned issues
 *   list-team <teamId>         - List issues from a team
 *   get <id>                   - Get issue by ID or identifier (PRJ-123)
 *   get-local <id>             - Get issue from local cache (no API call)
 *   sync                       - Pull all assigned issues to local storage
 *   sync-status                - Check local cache status
 *   create <json>              - Create issue from JSON input
 *   update <id> <json>         - Update issue
 *   start <id>                 - Mark issue as in progress
 *   done <id>                  - Mark issue as done
 *   comment <id> <text>        - Add comment to issue
 *   teams                      - List available teams
 *   projects                   - List available projects
 *   status                     - Check connection status
 *
 * Default output is human-readable. Use --json for machine parsing.
 */

import type { CreateIssueInput, Issue } from '../integrations/issue-tracker/types'
import { linearService, linearSync } from '../integrations/linear'
import { getErrorMessage } from '../types/fs'
import { formatForHuman, setOutputTier } from '../utils/output'
import {
  getCredentialSource,
  getLinearApiKey,
  getProjectCredentials,
  setLinearCredentials,
} from '../utils/project-credentials'

// Parse arguments
const args = process.argv.slice(2)

// Extract --project flag
const projectIdx = args.indexOf('--project')
let projectId: string | null = null
if (projectIdx !== -1 && args[projectIdx + 1]) {
  projectId = args[projectIdx + 1]
  args.splice(projectIdx, 2)
}

// Extract --json flag (raw JSON output)
const jsonIdx = args.indexOf('--json')
const jsonMode = jsonIdx !== -1
if (jsonMode) args.splice(jsonIdx, 1)

// Extract --verbose flag
const verboseIdx = args.indexOf('--verbose')
const verboseMode = verboseIdx !== -1
if (verboseMode) {
  args.splice(verboseIdx, 1)
  setOutputTier('verbose')
}

const [command, ...commandArgs] = args

/**
 * Output result - human-readable by default, JSON with --json flag
 */
function output(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2))
  } else {
    console.log(formatForHuman(data))
  }
}

/**
 * Output error and exit
 */
function error(message: string, code = 1): never {
  if (jsonMode) {
    console.error(JSON.stringify({ error: message }))
  } else {
    console.error(`Error: ${message}`)
  }
  process.exit(code)
}

/**
 * Initialize Linear service from project credentials
 */
async function initFromProject(): Promise<void> {
  if (!projectId) {
    error('No --project specified. Usage: linear.ts --project <projectId> <command>')
  }

  const apiKey = await getLinearApiKey(projectId)
  if (!apiKey) {
    error('Linear not configured. Run: p. linear setup')
  }

  const creds = await getProjectCredentials(projectId)
  await linearService.initializeFromApiKey(apiKey, creds.linear?.teamId)
}

/**
 * Main CLI handler
 */
async function main(): Promise<void> {
  try {
    switch (command) {
      case 'setup': {
        if (!projectId) {
          error('--project required for setup')
        }

        const apiKey = commandArgs[0]
        const teamId = commandArgs[1] // optional

        if (!apiKey) {
          error('API key required. Usage: setup <apiKey> [teamId]')
        }

        // Test connection first
        await linearService.initializeFromApiKey(apiKey, teamId)
        const teams = await linearService.getTeams()

        if (teams.length === 0) {
          error('No teams found. Check your API key permissions.')
        }

        // Determine default team
        let selectedTeamId = teamId
        let selectedTeamKey: string | undefined

        if (!selectedTeamId && teams.length === 1) {
          selectedTeamId = teams[0].id
          selectedTeamKey = teams[0].key
        } else if (selectedTeamId) {
          const team = teams.find((t) => t.id === selectedTeamId || t.key === selectedTeamId)
          if (team) {
            selectedTeamId = team.id
            selectedTeamKey = team.key
          }
        }

        // Store in project credentials
        await setLinearCredentials(projectId, {
          apiKey,
          teamId: selectedTeamId,
          teamKey: selectedTeamKey,
          setupAt: new Date().toISOString(),
        })

        output({
          success: true,
          teams,
          defaultTeam: selectedTeamId ? { id: selectedTeamId, key: selectedTeamKey } : null,
        })
        break
      }

      case 'list': {
        await initFromProject()
        const limit = commandArgs[0] ? parseInt(commandArgs[0], 10) : 20

        // Use team issues if teamId is configured, otherwise assigned issues
        const creds = await getProjectCredentials(projectId!)
        let issues: Issue[]
        if (creds.linear?.teamId) {
          issues = await linearService.fetchTeamIssues(creds.linear.teamId, { limit })
        } else {
          issues = await linearService.fetchAssignedIssues({ limit })
        }

        const issueList = issues.map((issue) => ({
          id: issue.id,
          identifier: issue.externalId,
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          url: issue.url,
        }))

        if (jsonMode) {
          output({ count: issues.length, issues: issueList })
        } else {
          // Human-friendly table output
          console.log(`Your issues (${issues.length}):`)
          for (const issue of issueList.slice(0, 10)) {
            const p = issue.priority && issue.priority !== 'none' ? ` [${issue.priority}]` : ''
            console.log(`  ${issue.identifier}  ${issue.title.slice(0, 50)}${p}`)
          }
          if (issues.length > 10) {
            console.log(`  ...${issues.length - 10} more`)
          }
        }
        break
      }

      case 'list-team': {
        await initFromProject()
        const teamId = commandArgs[0]
        const limit = commandArgs[1] ? parseInt(commandArgs[1], 10) : 20

        if (!teamId) {
          error('Team ID required. Usage: list-team <teamId> [limit]')
        }

        const issues = await linearService.fetchTeamIssues(teamId, { limit })
        output({
          count: issues.length,
          issues: issues.map((issue) => ({
            id: issue.id,
            identifier: issue.externalId,
            title: issue.title,
            status: issue.status,
            priority: issue.priority,
            url: issue.url,
          })),
        })
        break
      }

      case 'get': {
        await initFromProject()
        const id = commandArgs[0]

        if (!id) {
          error('Issue ID required. Usage: get <id>')
        }

        const issue = await linearService.fetchIssue(id)
        if (!issue) {
          error(`Issue not found: ${id}`)
        }

        if (jsonMode) {
          output(issue)
        } else {
          // Human-friendly issue display
          console.log(`${issue.externalId}: ${issue.title}`)
          console.log(`Status: ${issue.status} | Priority: ${issue.priority || 'none'}`)
          if (issue.description) {
            const desc = issue.description.slice(0, 200)
            console.log(`\n${desc}${issue.description.length > 200 ? '...' : ''}`)
          }
          console.log(`\n${issue.url}`)
        }
        break
      }

      case 'get-local': {
        if (!projectId) {
          error('--project required for get-local')
        }

        const id = commandArgs[0]
        if (!id) {
          error('Issue ID required. Usage: get-local <id>')
        }

        const cachedIssue = await linearSync.getIssueLocal(projectId, id)
        if (!cachedIssue) {
          error(`Issue not in local cache: ${id}. Run 'sync' first.`)
        }

        output(cachedIssue)
        break
      }

      case 'sync': {
        if (!projectId) {
          error('--project required for sync')
        }

        await initFromProject()
        const result = await linearSync.pullAll(projectId)

        output({
          success: result.errors.length === 0,
          ...result,
        })
        break
      }

      case 'sync-status': {
        if (!projectId) {
          error('--project required for sync-status')
        }

        const status = await linearSync.getSyncStatus(projectId)
        output(status)
        break
      }

      case 'create': {
        await initFromProject()
        const inputJson = commandArgs[0]

        if (!inputJson) {
          error('JSON input required. Usage: create \'{"title":"...", "teamId":"..."}\'')
        }

        let input: Record<string, unknown>
        try {
          input = JSON.parse(inputJson)
        } catch {
          error(`Invalid JSON: ${inputJson}`)
        }

        if (!input.title) {
          error('title is required')
        }
        if (!input.teamId) {
          // Try to use default team from credentials
          const creds = await getProjectCredentials(projectId!)
          if (creds.linear?.teamId) {
            input.teamId = creds.linear.teamId
          } else {
            error('teamId is required (no default team configured)')
          }
        }

        const issue = await linearService.createIssue(input as unknown as CreateIssueInput)
        output(issue)
        break
      }

      case 'update': {
        await initFromProject()
        const id = commandArgs[0]
        const inputJson = commandArgs[1]

        if (!id) {
          error('Issue ID required. Usage: update <id> \'{"description":"..."}\'')
        }
        if (!inputJson) {
          error('JSON input required. Usage: update <id> \'{"description":"..."}\'')
        }

        let input: Record<string, unknown>
        try {
          input = JSON.parse(inputJson)
        } catch {
          error(`Invalid JSON: ${inputJson}`)
        }

        const issue = await linearService.updateIssue(id, input)
        output(issue)
        break
      }

      case 'start': {
        await initFromProject()
        const id = commandArgs[0]

        if (!id) {
          error('Issue ID required. Usage: start <id>')
        }

        await linearService.markInProgress(id)
        output({ success: true, id, status: 'in_progress' })
        break
      }

      case 'done': {
        await initFromProject()
        const id = commandArgs[0]

        if (!id) {
          error('Issue ID required. Usage: done <id>')
        }

        await linearService.markDone(id)
        output({ success: true, id, status: 'done' })
        break
      }

      case 'comment': {
        await initFromProject()
        const id = commandArgs[0]
        const body = commandArgs.slice(1).join(' ')

        if (!id) {
          error('Issue ID required. Usage: comment <id> <text>')
        }
        if (!body) {
          error('Comment text required. Usage: comment <id> <text>')
        }

        await linearService.addComment(id, body)
        output({ success: true, id })
        break
      }

      case 'teams': {
        await initFromProject()
        const teams = await linearService.getTeams()
        output({ count: teams.length, teams })
        break
      }

      case 'projects': {
        await initFromProject()
        const projects = await linearService.getProjects()
        output({ count: projects.length, projects })
        break
      }

      case 'status': {
        if (!projectId) {
          error('--project required for status')
        }

        const source = await getCredentialSource(projectId)
        const apiKey = await getLinearApiKey(projectId)
        const creds = await getProjectCredentials(projectId)

        if (!apiKey) {
          if (jsonMode) {
            output({ configured: false, source: 'none', message: 'Linear not configured' })
          } else {
            console.log('Linear: Not configured')
            console.log('Run: p. linear setup')
          }
          break
        }

        // Test connection
        try {
          await linearService.initializeFromApiKey(apiKey, creds.linear?.teamId)
          const teams = await linearService.getTeams()

          if (jsonMode) {
            output({
              configured: true,
              source,
              teamId: creds.linear?.teamId,
              teamKey: creds.linear?.teamKey,
              teamsAvailable: teams.length,
            })
          } else {
            console.log(`Linear: Connected`)
            if (creds.linear?.teamKey) {
              console.log(`Team: ${creds.linear.teamKey}`)
            }
            console.log(`Teams: ${teams.length} available`)
          }
        } catch (err) {
          if (jsonMode) {
            output({ configured: true, source, connectionError: getErrorMessage(err) })
          } else {
            console.log(`Linear: Connection error`)
            console.log(`Error: ${getErrorMessage(err)}`)
          }
        }
        break
      }

      case 'help':
      case '--help':
      case '-h':
      case undefined: {
        output({
          usage: 'linear.ts --project <projectId> <command> [args...]',
          commands: {
            setup: 'setup <apiKey> [teamId] - Store API key',
            list: 'list [limit] - List my assigned issues',
            'list-team': 'list-team <teamId> [limit] - List team issues',
            get: 'get <id> - Get issue by ID or identifier',
            'get-local': 'get-local <id> - Get from local cache (no API)',
            sync: 'sync - Pull all assigned issues to local storage',
            'sync-status': 'sync-status - Check local cache status',
            create: 'create <json> - Create issue',
            update: 'update <id> <json> - Update issue',
            start: 'start <id> - Mark as in progress',
            done: 'done <id> - Mark as done',
            comment: 'comment <id> <text> - Add comment',
            teams: 'teams - List available teams',
            projects: 'projects - List available projects',
            status: 'status - Check connection',
          },
        })
        break
      }

      default:
        error(`Unknown command: ${command}. Use --help to see available commands.`)
    }
  } catch (err) {
    error(getErrorMessage(err))
  }
}

main()
