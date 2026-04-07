/**
 * Workflow Commands: work (now), done, next, pause, resume
 * Core task management - Write-Through Architecture
 *
 * Uses storage layer: JSON (source) → MD (context) → Event (sync)
 *
 * AGENTIC: Uses template-executor for Claude-driven decisions.
 * TypeScript provides infrastructure; Claude decides via templates.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import commandExecutor from '../agentic/command-executor'
import { isValidPoint, pointsToMinutes, pointsToTimeRange } from '../domain/fibonacci'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { templateGenerator } from '../infrastructure/template-generator'
import { generateUUID } from '../schemas/schemas'
import type { TaskFeedback } from '../schemas/state'
import context7Service from '../services/context7-service'
import estimateTaskForStart from '../services/task-estimation'
import { getGitBranch } from '../session/git-helpers'
import { sessionSnapshotManager } from '../session/session-snapshot'
import { analysisStorage } from '../storage/analysis-storage'
import { contextFeedbackStorage } from '../storage/context-feedback-storage'
import { customWorkflowStorage } from '../storage/custom-workflow-storage'
import { queueStorage } from '../storage/queue-storage'
import { stateStorage } from '../storage/state-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import { extractKeywords, findRelevantFiles } from '../tools/context/files-tool'
import type { RpiContext } from '../types/agentic'
import type { CommandResult } from '../types/commands'
import type { FibonacciPoint } from '../types/domain.js'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type { WorkflowRule } from '../types/storage.js'
import * as dateHelper from '../utils/date-helper'
import { getClaudeMcpConfigPath, hasMcpServer } from '../utils/mcp-config'
import {
  mdActionRequired,
  mdCallout,
  mdCodeBlock,
  mdDone,
  mdList,
  mdNextSteps,
  mdOutput,
  mdRelevantFiles,
  mdSection,
  mdStats,
  mdSubtasks,
  mdTaskHeader,
} from '../utils/md-formatter'
import { showNextSteps, showStateInfo } from '../utils/next-steps'
import out from '../utils/output'
import { detectProjectCommands } from '../utils/project-commands'
import { executeWorkflowRules } from '../workflow/workflow-engine'
import outcomeRecorder from '../workflows/outcome-recorder'
import { PrjctCommandsBase } from './base'
import {
  buildContextContract,
  buildPatternBriefing,
  detectDomainsFromTask,
} from './context-contract'

// =============================================================================
// Intent Detection Types
// =============================================================================

type IntentType =
  | 'view'
  | 'add'
  | 'remove'
  | 'disable'
  | 'gate'
  | 'instruction'
  | 'help'
  | 'reset'
  | 'init'
  | 'create'
  | 'list'
  | 'delete'
  | 'run'

interface WorkflowIntent {
  type: IntentType
  /** The remaining args after the intent keyword was consumed */
  args: string
  /** Confidence: 'exact' for keyword matches, 'fuzzy' for NL patterns */
  confidence: 'exact' | 'fuzzy'
}

/** Bilingual intent patterns (English + Spanish) */
const INTENT_PATTERNS: Array<{ type: IntentType; patterns: RegExp }> = [
  // Help must come before view to avoid "how"/"como" being consumed as view
  { type: 'help', patterns: /^(?:help|ayuda|c[oó]mo|how)\b/i },
  // Exact CLI subcommands (highest priority)
  { type: 'add', patterns: /^add\b/i },
  { type: 'gate', patterns: /^gate\b/i },
  { type: 'instruction', patterns: /^instruction\b/i },
  { type: 'remove', patterns: /^rm\b/i },
  { type: 'reset', patterns: /^reset\b/i },
  { type: 'init', patterns: /^init\b/i },
  { type: 'create', patterns: /^(?:create|crear|new|nuevo)\b/i },
  { type: 'list', patterns: /^(?:list|listar|show all|mostrar todos)\b/i },
  { type: 'delete', patterns: /^(?:delete|borrar|remove workflow)\b/i },
  { type: 'run', patterns: /^run\b/i },
  // Natural language patterns (bilingual)
  { type: 'view', patterns: /^(?:muestra|show|ver|display|mostrar)\b/i },
  { type: 'add', patterns: /^(?:a[nñ]ade|agrega|pon|nueva?)\b/i },
  { type: 'remove', patterns: /^(?:quita|remove|elimina|borra|borrar)\b/i },
  {
    type: 'disable',
    patterns: /^(?:deshabilita|disable|no\s+corras|apaga|turn\s+off|desactiva)\b/i,
  },
  { type: 'gate', patterns: /^(?:bloquea|block|protect|protege)\b/i },
]

export class WorkflowCommands extends PrjctCommandsBase {
  /**
   * /p:now - Set or show current task
   */
  async now(
    task: string | null = null,
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean; md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (options.md) {
          console.log('> No project ID found. Run `prjct init` first.')
        } else {
          out.failWithHint('NO_PROJECT_ID')
        }
        return { success: false, error: 'No project ID found' }
      }

      if (task) {
        // Run before_task rules (gates + hooks)
        const beforeResult = await executeWorkflowRules(projectId, 'task', 'before', {
          projectPath,
          skipRules: options.skipHooks,
        })
        if (!beforeResult.success) {
          const msg =
            beforeResult.gatesFailed.length > 0
              ? `Blocked: ${beforeResult.gatesFailed.join(', ')}`
              : `Hook failed: ${beforeResult.hooksFailed.join(', ')}`
          return { success: false, error: msg }
        }

        // Check if task is a Linear issue ID (e.g., PRJ-139)
        let linearId: string | undefined
        const taskDescription = task
        const linearPattern = /^[A-Z]+-\d+$/
        if (linearPattern.test(task)) {
          // Keep local issue linking. Status transitions are MCP-only.
          linearId = task
        }

        if (options.md) {
          // Context7 is mandatory before coding tasks
          try {
            await context7Service.ensureReady()
          } catch (error) {
            mdActionRequired(
              'blocked',
              'context7_not_ready',
              [
                { label: 'Fix Context7 now', command: 'prjct start' },
                { label: 'Retry task after fix', command: `prjct task "${taskDescription}" --md` },
                { label: 'Cancel' },
              ],
              { error: getErrorMessage(error) }
            )
            return { success: false, error: getErrorMessage(error) }
          }

          const estimate = await estimateTaskForStart(projectId, taskDescription)

          // Parallel-by-default: if a task is already active, auto-create a worktree
          // for the new task instead of blocking. Each task runs in isolation.
          const existingTask = await stateStorage.getCurrentTask(projectId)
          const activeWorkspaceTasks = await stateStorage.getActiveTasks(projectId)
          const { worktreeService } = await import('../services/worktree-service')
          const currentWorktree = await worktreeService.detect(projectPath)

          // Block ONLY if THIS specific worktree already has a task
          if (currentWorktree) {
            const conflictInThisWorktree = activeWorkspaceTasks.find(
              (t) => t.worktreePath === currentWorktree.path
            )
            if (conflictInThisWorktree) {
              mdActionRequired(
                'blocked',
                'task_already_active',
                [
                  { label: 'Complete current task first', command: 'prjct done --md' },
                  { label: 'Pause current and start this one', command: 'prjct pause --md' },
                ],
                {
                  current_task: conflictInThisWorktree.description,
                  requested_task: taskDescription,
                }
              )
              return {
                success: true,
                message: 'Task already active in this worktree',
                currentTask: conflictInThisWorktree,
              }
            }
          }

          // Auto-worktree: if main tree has an active task, create a new worktree
          let taskWorktreePath: string | undefined
          const needsWorktree = existingTask && !currentWorktree
          if (needsWorktree) {
            const slug = taskDescription
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 40)
            try {
              const wt = await worktreeService.create(projectPath, slug)
              await worktreeService.setup(wt.path, projectPath)
              taskWorktreePath = wt.path
              mdCallout('info', `Parallel session created: \`${wt.branch}\` at \`${wt.path}\``)
            } catch {
              // Worktree creation failed — fall back to pause-and-start
              mdActionRequired(
                'blocked',
                'task_already_active',
                [
                  { label: 'Complete current task first', command: 'prjct done --md' },
                  { label: 'Pause current and start this one', command: 'prjct pause --md' },
                ],
                { current_task: existingTask.description, requested_task: taskDescription }
              )
              return { success: true, message: 'Task already active', currentTask: existingTask }
            }
          }

          // Start task — as workspace task if in worktree, or as main task
          if (taskWorktreePath || currentWorktree) {
            const workspaceId = generateUUID()
            await stateStorage.startTaskInWorkspace(
              projectId,
              {
                id: generateUUID(),
                description: taskDescription,
                sessionId: generateUUID(),
                workspaceId,
                worktreePath: taskWorktreePath || currentWorktree!.path,
                linearId,
                type: estimate.taskType,
                estimatedPoints: estimate.estimatedPoints,
                estimatedMinutes: estimate.estimatedMinutes,
              },
              workspaceId
            )
          } else {
            await stateStorage.startTask(projectId, {
              id: generateUUID(),
              description: taskDescription,
              sessionId: generateUUID(),
              linearId,
              type: estimate.taskType,
              estimatedPoints: estimate.estimatedPoints,
              estimatedMinutes: estimate.estimatedMinutes,
            } as Parameters<typeof stateStorage.startTask>[1])
          }

          // Load project context in parallel (non-blocking, graceful)
          const globalPath = pathManager.getGlobalProjectPath(projectId)
          const taskKeywords = extractKeywords(taskDescription)
          let historicalBoosts: Map<string, number> | undefined
          try {
            historicalBoosts = contextFeedbackStorage.getHistoricalBoosts(projectId, taskKeywords)
            if (historicalBoosts.size === 0) historicalBoosts = undefined
          } catch {
            // Cold start or DB not ready — no boosts
          }

          // Dynamic token budget based on task type
          const tokenBudgetByType: Record<string, number> = {
            bug: 30,
            chore: 40,
            improvement: 80,
            feature: 100,
          }
          const maxFilesForTask = (tokenBudgetByType[estimate.taskType] ?? 80) >= 80 ? 15 : 10

          const [branch, analysis, , relevantFilesResult] = await Promise.all([
            getGitBranch(projectPath),
            analysisStorage.getActive(projectId).catch(() => null),
            loadRepoAnalysis(globalPath),
            findRelevantFiles(taskDescription, projectPath, {
              maxFiles: maxFilesForTask,
              minScore: 0.15,
              historicalBoosts,
            }).catch(() => ({
              files: [],
              metrics: { filesScanned: 0, filesReturned: 0, scanDuration: 0 },
            })),
          ])

          // Check for session snapshot (PRJ-285) — inject continuity context
          let continuityContext: string | null = null
          try {
            const snapshot = sessionSnapshotManager.getSnapshot(projectId)
            if (snapshot) {
              continuityContext = sessionSnapshotManager.formatContinuityContext(snapshot)
              sessionSnapshotManager.clearSnapshot(projectId)
            }
          } catch {
            // Non-critical
          }

          // Analysis staleness check — warn if >7 days old
          let stalenessWarning: string | null = null
          if (analysis?.analyzedAt) {
            const analyzedDate = new Date(analysis.analyzedAt)
            const daysSinceAnalysis = Math.floor(
              (Date.now() - analyzedDate.getTime()) / (1000 * 60 * 60 * 24)
            )
            if (daysSinceAnalysis > 7) {
              stalenessWarning = mdCallout(
                'warn',
                `Analysis is ${daysSinceAnalysis} days old. Run \`p. sync\` to refresh patterns and file index.`
              )
            }
          } else if (!analysis) {
            stalenessWarning = mdCallout(
              'info',
              'No project analysis found. Run `p. sync` for better context targeting.'
            )
          }

          // Surface historically useful files from feedback loop
          let historicalFilesSection: string | null = null
          if (historicalBoosts && historicalBoosts.size > 0) {
            const topBoosted = [...historicalBoosts.entries()]
              .filter(([, score]) => score > 0.3)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
            if (topBoosted.length > 0) {
              const items = topBoosted.map(([file]) => `\`${file}\``)
              historicalFilesSection = `### Previously Useful Files\n${items.join(', ')}`
            }
          }

          // Detect domains from task keywords + project-specific domains
          const detectedDomains = detectDomainsFromTask(taskDescription, projectId)

          // Build sections
          const header = mdTaskHeader({
            description: taskDescription,
            branch,
            linearId,
            type: estimate.taskType,
            estimatedPoints: estimate.estimatedPoints,
            estimatedMinutes: estimate.estimatedMinutes,
            estimateSource: estimate.source,
            domains: detectedDomains,
          })
          const files = mdRelevantFiles(
            relevantFilesResult.files.map((f) => ({
              path: f.path,
              description: f.reasons.join(', '),
            }))
          )
          const relevantFilePaths = relevantFilesResult.files.map((f) => f.path)
          const patterns = buildPatternBriefing(analysis, relevantFilePaths)
          const contextContract = buildContextContract(relevantFilesResult.files, analysis)
          const next = mdNextSteps([
            { label: 'Find relevant files', command: 'prjct context files "..."' },
            { label: 'Complete subtask', command: 'prjct done --md' },
            { label: 'Pause task', command: 'prjct pause --md' },
          ])

          // Build efficiency + RPI sections
          const efficiencySection = buildEfficiencySection()
          const rpiSection = buildRpiSection(projectId)

          // projectContext (ecosystem, commands) omitted — lives in CLAUDE.md global context
          console.log(
            mdOutput(
              continuityContext,
              stalenessWarning,
              header,
              contextContract,
              files,
              historicalFilesSection,
              patterns,
              rpiSection,
              efficiencySection,
              next
            )
          )

          // Record file suggestions for feedback loop
          try {
            const currentTask = await stateStorage.getCurrentTask(projectId)
            if (currentTask) {
              contextFeedbackStorage.recordSuggestions(
                projectId,
                currentTask.id,
                taskKeywords,
                relevantFilesResult.files.map((f) => f.path)
              )
            }
          } catch {
            // Non-blocking
          }

          await this.logToMemory(projectPath, 'task_started', {
            task,
            timestamp: dateHelper.getTimestamp(),
          })

          await executeWorkflowRules(projectId, 'task', 'after', {
            projectPath,
            skipRules: options.skipHooks,
          })

          return { success: true, task, taskDescription }
        }

        // AGENTIC: Use CommandExecutor for full orchestration support (non-md path)
        const result = await commandExecutor.execute('task', { task }, projectPath)

        if (!result.success) {
          out.fail(result.error || 'Failed to execute task')
          return { success: false, error: result.error }
        }

        // Write-through: JSON → MD → Event (only after executor succeeds)
        const estimate = await estimateTaskForStart(projectId, taskDescription)

        await stateStorage.startTask(projectId, {
          id: generateUUID(),
          description: taskDescription,
          sessionId: generateUUID(),
          linearId,
          type: estimate.taskType,
          estimatedPoints: estimate.estimatedPoints,
          estimatedMinutes: estimate.estimatedMinutes,
        } as Parameters<typeof stateStorage.startTask>[1])

        out.done(`${task}`)
        showStateInfo('working')
        showNextSteps('task')

        await this.logToMemory(projectPath, 'task_started', {
          task,
          orchestratorContext: result.orchestratorContext,
          timestamp: dateHelper.getTimestamp(),
        })

        // Run after_task rules
        await executeWorkflowRules(projectId, 'task', 'after', {
          projectPath,
          skipRules: options.skipHooks,
        })

        return {
          ...result,
          success: true,
          task,
          fibonacci: {
            isValidPoint,
            pointsToMinutes,
            pointsToTimeRange,
            storeEstimate: async (points: FibonacciPoint) => {
              const minutes = pointsToMinutes(points)
              await stateStorage.updateCurrentTask(projectId, {
                estimatedPoints: points,
                estimatedMinutes: minutes.typical,
              })
              return minutes
            },
          },
        }
      } else {
        // Read from storage (JSON is source of truth)
        const currentTask = await stateStorage.getCurrentTask(projectId)

        if (!currentTask) {
          if (options.md) {
            mdActionRequired('idle', 'no_active_task', [
              { label: 'Start a task', command: 'prjct task "description" --md' },
              { label: 'Check queue', command: 'prjct next --md' },
            ])
          } else {
            out.warn('no active task')
          }
          return { success: true, message: 'No active task' }
        }

        if (options.md) {
          // Markdown output for current task status
          const duration = currentTask.startedAt
            ? dateHelper.calculateDuration(new Date(currentTask.startedAt))
            : undefined
          const header = mdTaskHeader({
            description: currentTask.description,
            status: 'active',
            branch: (currentTask as { branch?: string }).branch,
            linearId: (currentTask as { linearId?: string }).linearId,
            type: (currentTask as { type?: string }).type,
            duration,
          })
          const subtasks =
            (currentTask as { subtasks?: Array<{ description: string; status: string }> })
              .subtasks || []
          const currentIndex = (currentTask as { currentSubtaskIndex?: number }).currentSubtaskIndex
          const subtasksMd = subtasks.length > 0 ? mdSubtasks(subtasks, currentIndex) : ''
          const next = mdNextSteps([
            { label: 'Complete subtask', command: 'prjct done --md' },
            { label: 'Pause task', command: 'prjct pause --md' },
          ])
          console.log(mdOutput(header, subtasksMd, next))
        } else {
          out.done(`working on: ${currentTask.description}`)
        }
        return { success: true, task: currentTask.description, currentTask }
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      if (options.md) {
        if (msg.includes('Cannot run') || msg.includes('working state')) {
          mdActionRequired(
            'blocked',
            'state_conflict',
            [
              { label: 'Complete current task', command: 'prjct done --md' },
              { label: 'Pause current task', command: 'prjct pause --md' },
            ],
            { error: msg.split('.')[0] }
          )
        } else {
          console.log(JSON.stringify({ status: 'error', error: msg }))
        }
      } else {
        out.fail(msg)
      }
      return { success: false, error: msg }
    }
  }

  /**
   * /p:done - Complete current task
   * Optionally accepts structured feedback for the task-to-analysis feedback loop (PRJ-272)
   */
  async done(
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean; feedback?: TaskFeedback; md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      // Workspace-aware: check for task in current worktree first, then fallback to main
      const { worktreeService } = await import('../services/worktree-service')
      const currentWorktree = await worktreeService.detect(projectPath)
      let currentTask = await stateStorage.getCurrentTask(projectId)
      let completingWorkspaceId: string | undefined

      if (currentWorktree) {
        // In a worktree — find the workspace task for this path
        const activeTasks = await stateStorage.getActiveTasks(projectId)
        const workspaceTask = activeTasks.find((t) => t.worktreePath === currentWorktree.path)
        if (workspaceTask) {
          currentTask = workspaceTask
          completingWorkspaceId = workspaceTask.workspaceId
        }
      }

      if (!currentTask) {
        if (options.md) {
          mdActionRequired('idle', 'no_active_task', [
            { label: 'Start a task', command: 'prjct task "description" --md' },
            { label: 'Check queue', command: 'prjct next --md' },
          ])
        } else {
          out.warn('no active task')
        }
        return { success: true, message: 'No active task to complete' }
      }

      // Run before_done rules (gates + hooks)
      const beforeResult = await executeWorkflowRules(projectId, 'done', 'before', {
        projectPath,
        skipRules: options.skipHooks,
      })
      if (!beforeResult.success) {
        const msg =
          beforeResult.gatesFailed.length > 0
            ? `Blocked: ${beforeResult.gatesFailed.join(', ')}`
            : `Hook failed: ${beforeResult.hooksFailed.join(', ')}`
        return { success: false, error: msg }
      }

      const task = currentTask.description
      let duration = ''
      let actualMinutes = 0
      if (currentTask.startedAt) {
        const started = new Date(currentTask.startedAt)
        duration = dateHelper.calculateDuration(started)
        actualMinutes = Math.round((Date.now() - started.getTime()) / 60_000)
      }

      // Record outcome with estimation data if available
      const estimatedMinutes = (currentTask as { estimatedMinutes?: number }).estimatedMinutes
      const estimatedPoints = (currentTask as { estimatedPoints?: number }).estimatedPoints
      const taskType =
        (currentTask as { type?: 'feature' | 'bug' | 'improvement' | 'chore' }).type || 'feature'
      const linearIdTag = (currentTask as { linearId?: string }).linearId
      try {
        await outcomeRecorder.record(projectId, {
          sessionId: currentTask.sessionId,
          command: 'done',
          task,
          startedAt: currentTask.startedAt,
          completedAt: dateHelper.getTimestamp(),
          estimatedDuration: estimatedMinutes ? formatMinutesToDuration(estimatedMinutes) : '0m',
          actualDuration: duration || '0m',
          variance: estimatedMinutes ? formatVariance(actualMinutes - estimatedMinutes) : '+0m',
          completedAsPlanned: true,
          qualityScore: 3,
          tags: [taskType, linearIdTag].filter(Boolean) as string[],
        })
      } catch {
        // Outcome recording failure should not block workflow
      }

      // Build variance display
      let varianceDisplay = ''
      if (estimatedPoints && estimatedMinutes) {
        const diff = actualMinutes - estimatedMinutes
        const pct =
          estimatedMinutes > 0
            ? Math.round(((actualMinutes - estimatedMinutes) / estimatedMinutes) * 100)
            : 0
        const sign = diff >= 0 ? '+' : ''
        varianceDisplay = ` | est: ${estimatedPoints}pt (${formatMinutesToDuration(estimatedMinutes)}) → ${sign}${pct}%`
      }

      // Record context feedback: actual files modified during task
      let modifiedFiles: string[] = []
      let feedbackPrecision: number | null = null
      let feedbackRecall: number | null = null
      try {
        modifiedFiles = await getFilesModifiedSinceTaskStart(projectPath, currentTask.startedAt)
        if (modifiedFiles.length > 0) {
          contextFeedbackStorage.completeFeedback(projectId, currentTask.id, modifiedFiles)
          // Read back the precision/recall metrics
          const feedbackRow = contextFeedbackStorage.getFeedback(projectId, currentTask.id)
          if (feedbackRow) {
            feedbackPrecision = feedbackRow.precision
            feedbackRecall = feedbackRow.recall
          }
        }
      } catch {
        // Non-blocking — feedback is best-effort
      }

      // Write-through: Complete task (JSON → MD → Event)
      // Pass feedback for the task-to-analysis feedback loop (PRJ-272)
      if (completingWorkspaceId) {
        await stateStorage.completeTaskInWorkspace(
          projectId,
          completingWorkspaceId,
          options.feedback
        )
      } else {
        await stateStorage.completeTask(projectId, options.feedback)
      }

      // Clear session snapshot on completion (PRJ-285)
      try {
        sessionSnapshotManager.clearSnapshot(projectId)
      } catch {
        // Non-critical
      }

      // Linear status sync is MCP-only and handled by the AI client toolchain.
      const linearId = (currentTask as { linearId?: string }).linearId
      const linearMcpReady =
        linearId != null
          ? await hasMcpServer('linear', getClaudeMcpConfigPath()).catch(() => false)
          : false

      if (options.md) {
        const durationSuffix = duration ? ` (${duration})` : ''

        // Build modified files section
        let modifiedFilesSection: string | null = null
        if (modifiedFiles.length > 0) {
          const fileList = modifiedFiles.slice(0, 10).map((f) => `\`${f}\``)
          const more = modifiedFiles.length > 10 ? `, +${modifiedFiles.length - 10} more` : ''
          modifiedFilesSection = `### Files Modified (${modifiedFiles.length})\n${fileList.join(', ')}${more}`
        }

        // Build feedback accuracy section
        let feedbackSection: string | null = null
        if (feedbackPrecision !== null && feedbackRecall !== null) {
          const precPct = Math.round(feedbackPrecision * 100)
          const recPct = Math.round(feedbackRecall * 100)
          feedbackSection = `### Context Accuracy\n| Metric | Value |\n|--------|-------|\n| Precision | ${precPct}% of suggested files were used |\n| Recall | ${recPct}% of modified files were suggested |`
        }

        // RPI phase guidance
        let rpiSection: string | null = null
        try {
          const { prjctDb } = require('../storage/database')
          const hasResearch = prjctDb.getDoc(projectId, 'rpi:current:research')
          const hasPlan = prjctDb.getDoc(projectId, 'rpi:current:plan')
          if (!hasResearch) {
            rpiSection =
              '### RPI Phase: Research Complete\n' +
              'Save your research findings with `prjct compact --md` before planning.'
          } else if (!hasPlan) {
            rpiSection =
              '### RPI Phase: Plan Ready\n' +
              'Research is available. Create your implementation plan next.'
          }
        } catch {
          // RPI guidance is non-blocking
        }

        console.log(
          mdOutput(
            mdDone('Completed', `${task}${durationSuffix}`),
            mdStats({
              Duration: duration || 'unknown',
              ...(varianceDisplay ? { Variance: varianceDisplay.replace(' | ', '') } : {}),
            }),
            modifiedFilesSection,
            feedbackSection,
            rpiSection,
            mdNextSteps([
              { label: 'Complete next subtask', command: 'prjct done --md' },
              { label: 'Ship when ready', command: 'prjct ship --md' },
            ])
          )
        )
      } else {
        const displaySuffix = duration ? ` (${duration}${varianceDisplay})` : ''
        if (linearId && linearMcpReady) {
          out.done(`${task}${displaySuffix} → Linear linked (update via MCP)`)
        } else {
          out.done(`${task}${displaySuffix}`)
        }
        showStateInfo('completed')
        showNextSteps('done')
      }

      await this.logToMemory(projectPath, 'task_completed', {
        task,
        duration,
        estimatedPoints,
        estimatedMinutes,
        actualMinutes,
        timestamp: dateHelper.getTimestamp(),
      })

      // Run after_done rules
      await executeWorkflowRules(projectId, 'done', 'after', {
        projectPath,
        skipRules: options.skipHooks,
      })

      return { success: true, task, duration }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:next - Show priority queue
   */
  async next(
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      // Read queue from storage
      const tasks = await queueStorage.getActiveTasks(projectId)

      if (tasks.length === 0) {
        if (options.md) {
          mdActionRequired('empty', 'queue_empty', [
            { label: 'Add a task', command: 'prjct task "description" --md' },
            { label: 'Add a bug', command: 'prjct bug "description" --md' },
          ])
        } else {
          out.warn('queue empty')
        }
        return { success: true, message: 'Queue is empty' }
      }

      if (options.md) {
        const shown = tasks.slice(0, 10)
        const items = shown.map((t) => {
          const typeBadge = t.type ? ` [${t.type}]` : ''
          const priority = t.priority ? ` ${t.priority}` : ''
          const desc = t.description.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '')
          return `${desc}${typeBadge}${priority}`
        })
        if (tasks.length > 10) items.push(`...and ${tasks.length - 10} more`)
        console.log(
          mdOutput(
            mdSection('Queue', `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`),
            mdList(items, true),
            mdNextSteps([{ label: 'Start top task', command: 'prjct task "..." --md' }])
          )
        )
      } else {
        out.done(`${tasks.length} task${tasks.length !== 1 ? 's' : ''} queued`)
        showNextSteps('next')
      }

      return { success: true, tasks, count: tasks.length }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:pause - Pause active task to handle interruption
   */
  async pause(
    reason: string = '',
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      const currentTask = await stateStorage.getCurrentTask(projectId)

      if (!currentTask) {
        if (options.md) {
          mdActionRequired('idle', 'no_active_task', [
            { label: 'Start a task', command: 'prjct task "description" --md' },
          ])
        } else {
          out.warn('no active task to pause')
        }
        return { success: true, message: 'No active task to pause' }
      }

      // Calculate duration worked before pausing
      let durationWorked = ''
      if (currentTask.startedAt) {
        durationWorked = dateHelper.calculateDuration(new Date(currentTask.startedAt))
      }

      // Write-through: Pause task (JSON → MD → Event)
      await stateStorage.pauseTask(projectId, reason)

      // Capture session snapshot for continuity (PRJ-285)
      try {
        await sessionSnapshotManager.capture(projectId, projectPath, {
          taskDescription: currentTask.description,
          taskStatus: 'paused',
          sessionId: currentTask.sessionId,
          activeSubtaskIndex: currentTask.currentSubtaskIndex,
          subtaskCount: currentTask.subtasks?.length,
          linearId: (currentTask as { linearId?: string }).linearId,
          startedAt: currentTask.startedAt,
        })
      } catch {
        // Snapshot capture is non-critical
      }

      if (options.md) {
        console.log(
          mdOutput(
            mdDone('Task Paused', `**Paused:** ${currentTask.description}`),
            mdStats({
              Reason: reason || undefined,
              'Duration worked': durationWorked || undefined,
            }),
            mdNextSteps([
              { label: 'Resume this task', command: 'prjct resume --md' },
              { label: 'Start something new', command: 'prjct task "..." --md' },
            ])
          )
        )
      } else {
        const taskDesc = currentTask.description.slice(0, 40)
        out.done(`paused: ${taskDesc}${reason ? ` (${reason})` : ''}`)
        showStateInfo('paused')
        showNextSteps('pause')
      }

      await this.logToMemory(projectPath, 'task_paused', {
        task: currentTask.description,
        reason,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task: currentTask.description, reason }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:resume - Resume most recently paused task
   */
  async resume(
    _taskId: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      // Check if already working on a task
      const currentTask = await stateStorage.getCurrentTask(projectId)
      if (currentTask) {
        if (options.md) {
          mdActionRequired(
            'blocked',
            'task_already_active',
            [
              { label: 'Continue working', command: 'prjct done --md' },
              { label: 'Pause and switch', command: 'prjct pause --md' },
            ],
            { current_task: currentTask.description }
          )
        } else {
          out.warn('already working on a task')
        }
        return { success: true, message: `Already working on: ${currentTask.description}` }
      }

      // Write-through: Resume task (JSON → MD → Event)
      const resumed = await stateStorage.resumeTask(projectId)

      if (!resumed) {
        if (options.md) {
          mdActionRequired('idle', 'no_paused_task', [
            { label: 'Start a new task', command: 'prjct task "description" --md' },
          ])
        } else {
          out.warn('no paused task to resume')
        }
        return { success: true, message: 'No paused task found' }
      }

      if (options.md) {
        console.log(
          mdOutput(
            mdDone('Task Resumed', `**Resumed:** ${resumed.description}`),
            mdNextSteps([{ label: 'Continue working, then finish', command: 'prjct done --md' }])
          )
        )
      } else {
        out.done(`resumed: ${resumed.description.slice(0, 40)}`)
        showStateInfo('working')
        showNextSteps('resume')
      }

      await this.logToMemory(projectPath, 'task_resumed', {
        task: resumed.description,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task: resumed.description }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:workflow - View and manage workflow rules
   *
   * Supports both structured subcommands and natural language (bilingual EN/ES):
   *   (none)         Show all rules
   *   <command>      Show rules for a specific command (task, done, ship, sync)
   *   add "action" before|after <command>   Add a hook
   *   gate <command> "action"               Add a gate (blocking)
   *   rm <id>        Remove a rule by ID
   *   disable <id|query>  Disable a rule without removing
   *   reset          Remove all rules
   *   help           Show examples and usage
   */
  async workflow(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (options.md) {
          console.log('> No project ID found. Run `prjct init` first.')
        } else {
          out.failWithHint('NO_PROJECT_ID')
        }
        return { success: false, error: 'No project ID found' }
      }

      const trimmed = input?.trim() ?? ''

      // Empty input → show all rules
      if (!trimmed) {
        return this._workflowShow(null, projectId, options)
      }

      // Detect intent from natural language
      const intent = this._detectIntent(trimmed)

      switch (intent.type) {
        case 'add':
          return this._workflowAdd(intent.args, projectId, options)
        case 'gate':
          return this._workflowGate(intent.args, projectId, options)
        case 'instruction':
          return this._workflowInstruction(intent.args, projectId, options)
        case 'remove':
          return this._workflowRm(intent.args, projectId, options)
        case 'disable':
          return this._workflowDisable(intent.args, projectId, options)
        case 'reset':
          return this._workflowReset(projectId, options)
        case 'init':
          return this._workflowInit(projectId, projectPath, options)
        case 'help':
          return this._workflowHelp(options)
        case 'create':
          return this._workflowCreate(intent.args, projectId, projectPath, options)
        case 'list':
          return this._workflowList(projectId, options)
        case 'delete':
          return this._workflowDelete(intent.args, projectId, options)
        case 'run':
          return this.run(intent.args, projectPath, options)
        case 'view':
          return this._workflowShow(intent.args || null, projectId, options)
        default:
          // Fallback: treat as a command filter for show
          return this._workflowShow(
            trimmed.split(/\s+/)[0]?.toLowerCase() || null,
            projectId,
            options
          )
      }
    } catch (error) {
      if (options.md) {
        console.log(`> Error: ${getErrorMessage(error)}`)
      } else {
        out.fail(getErrorMessage(error))
      }
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Parse natural language input into a structured intent.
   * Supports bilingual patterns (English/Spanish).
   */
  _detectIntent(input: string): WorkflowIntent {
    const trimmed = input.trim()

    for (const { type, patterns } of INTENT_PATTERNS) {
      const match = trimmed.match(patterns)
      if (match) {
        const consumed = match[0]
        const args = trimmed.slice(consumed.length).trim()
        // 'exact' for CLI keyword matches, 'fuzzy' for NL patterns
        const isExact = /^(?:add|gate|rm|reset|init|help)\b/i.test(consumed)
        return { type, args, confidence: isExact ? 'exact' : 'fuzzy' }
      }
    }

    // No pattern matched — default to 'view' with the full input as args
    return { type: 'view', args: trimmed, confidence: 'fuzzy' }
  }

  /**
   * Search rules by action or description text.
   * Returns rules whose action or description contains the query (case-insensitive).
   */
  _searchRules(rules: WorkflowRule[], query: string): WorkflowRule[] {
    const lower = query.toLowerCase()
    return rules.filter((r) => {
      return (
        r.action.toLowerCase().includes(lower) ||
        (r.description?.toLowerCase().includes(lower) ?? false) ||
        r.command.toLowerCase().includes(lower) ||
        String(r.id) === lower
      )
    })
  }

  /**
   * Parse a quoted or unquoted action string from input.
   * Returns [action, rest] where rest is the remaining unparsed input.
   */
  private _parseAction(input: string): [string, string] {
    const trimmed = input.trim()
    if (trimmed.startsWith('"')) {
      const endQuote = trimmed.indexOf('"', 1)
      if (endQuote === -1) return [trimmed.slice(1), '']
      return [trimmed.slice(1, endQuote), trimmed.slice(endQuote + 1).trim()]
    }
    if (trimmed.startsWith("'")) {
      const endQuote = trimmed.indexOf("'", 1)
      if (endQuote === -1) return [trimmed.slice(1), '']
      return [trimmed.slice(1, endQuote), trimmed.slice(endQuote + 1).trim()]
    }
    // Unquoted: take everything up to 'before' or 'after' keyword
    const match = trimmed.match(/^(.+?)\s+(before|after)\s+/i)
    if (match) return [match[1].trim(), trimmed.slice(match[1].length).trim()]
    return [trimmed, '']
  }

  /**
   * Add a hook rule: "npm test" before ship
   */
  private async _workflowAdd(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: "action" before|after command
    const [action, rest] = this._parseAction(input)
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

    // Validate workflow exists and is enabled
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

  /**
   * Add a gate rule: ship "npm test"
   */
  private async _workflowGate(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: command "action"
    const parts = input.trim().split(/\s+/)
    const command = parts[0]?.toLowerCase()

    // Validate workflow exists and is enabled
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
    const [action] = this._parseAction(actionInput)

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

  /**
   * Add an instruction rule: ship before "Post review comment in Linear"
   */
  private async _workflowInstruction(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: command before|after "instruction text"
    const parts = input.trim().split(/\s+/)
    const command = parts[0]?.toLowerCase()

    // Validate workflow exists and is enabled
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
    const [action] = this._parseAction(actionInput)

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

  /**
   * Remove a rule by ID
   */
  private async _workflowRm(
    input: string,
    projectId: string,
    options: { md?: boolean }
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

  /**
   * Reset all workflow rules
   */
  private async _workflowReset(
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const count = workflowRuleStorage.resetRules(projectId)

    if (options.md) {
      console.log(mdOutput(mdDone('Rules Reset', `Removed ${count} rule${count !== 1 ? 's' : ''}`)))
    } else {
      out.done(`reset: removed ${count} rule${count !== 1 ? 's' : ''}`)
    }

    return { success: true, count }
  }

  /**
   * Disable a rule by ID or search query (without removing it).
   * Uses updateRule() from storage layer.
   */
  private async _workflowDisable(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const trimmed = input.trim()

    // Try numeric ID first
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

    // Not a numeric ID — search by query
    const allRules = workflowRuleStorage.getAllRules(projectId)
    const matches = this._searchRules(allRules, trimmed)

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

    // Multiple matches — ask user to be more specific
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

  /**
   * Show workflow help: examples and usage in both languages
   */
  private async _workflowHelp(options: { md?: boolean }): Promise<CommandResult> {
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

  /**
   * Show workflow rules (optionally filtered by command)
   */
  private async _workflowShow(
    command: string | null,
    projectId: string,
    options: { md?: boolean }
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
      // Group rules by command for flow diagrams
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

  /**
   * Initialize workflow rules for ship command.
   * Seeds sensible defaults based on detected project tools.
   * Useful for existing projects that were initialized before workflow rules were added.
   */
  private async _workflowInit(
    projectId: string,
    projectPath: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Check if ship rules already exist
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

    // Seed default workflow rules
    const detected = await detectProjectCommands(projectPath)
    let sortOrder = 0
    const rulesAdded: string[] = []

    // Gate: Prevent shipping from main/master
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

    // Step: Lint (if detected, non-blocking with || true)
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

    // Step: Test (if detected, non-blocking with || true)
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

  /**
   * Create a new custom workflow with agentic auto-configuration
   */
  private async _workflowCreate(
    input: string,
    projectId: string,
    _projectPath: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: name "description"
    const match = input.match(/^(\S+)\s+"([^"]+)"/)
    if (!match) {
      const msg = 'Usage: prjct workflow create <name> "description"'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const [, name, description] = match

    // Validate name format
    if (!customWorkflowStorage.isValidName(name)) {
      const msg =
        'Workflow name must be lowercase alphanumeric + hyphens (e.g., "qa", "deploy-prod")'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    // Check if name is reserved
    if (customWorkflowStorage.isReservedName(name)) {
      const msg = `Workflow name '${name}' is reserved`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    // Check if workflow already exists
    const existing = customWorkflowStorage.getWorkflow(projectId, name)
    if (existing) {
      const msg = `Workflow '${name}' already exists`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    try {
      // Create workflow in DB
      const workflowId = customWorkflowStorage.createWorkflow(projectId, { name, description })

      // Generate template at ~/.claude/commands/p/{name}.md
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

  /**
   * List all workflows (built-in + custom)
   */
  private async _workflowList(
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
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

  /**
   * Delete a custom workflow
   */
  private async _workflowDelete(
    input: string,
    projectId: string,
    options: { md?: boolean }
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

      // Delete template file
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

  /**
   * Execute a custom workflow (runs all before/after rules)
   */
  async run(
    workflowName: string,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (options.md) {
          console.log('> No project ID found. Run `prjct init` first.')
        } else {
          out.failWithHint('NO_PROJECT_ID')
        }
        return { success: false, error: 'No project ID found' }
      }

      const name = workflowName.trim()
      if (!name) {
        const msg = 'Usage: prjct workflow run <name>'
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: false, error: msg }
      }

      // Validate workflow exists and is enabled
      const workflow = customWorkflowStorage.getWorkflow(projectId, name)
      if (!workflow || !workflow.enabled) {
        const msg = `Workflow '${name}' not found`
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: false, error: msg }
      }

      // Execute before phase (gates + steps)
      const beforeResult = await executeWorkflowRules(projectId, name, 'before', { projectPath })

      if (!beforeResult.success) {
        if (options.md) {
          mdActionRequired('failed', 'workflow_gates_failed', [
            { label: 'View rules', command: `prjct workflow ${name} --md` },
          ])
        } else {
          out.fail('Workflow gates failed')
          if (beforeResult.gatesFailed) {
            for (const gate of beforeResult.gatesFailed) {
              console.log(`  ✗ ${gate}`)
            }
          }
        }
        return {
          success: false,
          error: 'Workflow gates failed',
          gatesFailed: beforeResult.gatesFailed,
        }
      }

      // Execute after phase (hooks)
      await executeWorkflowRules(projectId, name, 'after', { projectPath })

      // Format output
      if (options.md) {
        console.log(
          mdOutput(
            mdDone(`Workflow: ${name}`, workflow.description || ''),
            mdNextSteps([
              { label: 'View rules', command: `prjct workflow ${name} --md` },
              { label: 'Run again', command: `p. ${name}` },
            ])
          )
        )
      } else {
        out.done(`${name} completed successfully`)
      }

      return { success: true, workflow: name }
    } catch (error) {
      const msg = getErrorMessage(error)
      if (options.md) {
        console.log(`> Error: ${msg}`)
      } else {
        out.fail(msg)
      }
      return { success: false, error: msg }
    }
  }

  /**
   * /p:sessions - Show recent sessions across all projects (PRJ-285)
   */
  async sessions(
    _projectPath: string = process.cwd(),
    options: { md?: boolean; cleanup?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      // Auto-clean old snapshots
      if (options.cleanup) {
        const cleaned = await sessionSnapshotManager.cleanup()
        if (options.md) {
          console.log(
            mdDone('Cleanup', `Removed ${cleaned} stale snapshot${cleaned !== 1 ? 's' : ''}`)
          )
        } else {
          out.done(`cleaned ${cleaned} stale snapshot${cleaned !== 1 ? 's' : ''}`)
        }
        return { success: true, cleaned }
      }

      const snapshots = await sessionSnapshotManager.listAllSnapshots()

      if (snapshots.length === 0) {
        if (options.md) {
          mdActionRequired('empty', 'no_sessions', [
            { label: 'Start a task', command: 'prjct task "description" --md' },
          ])
        } else {
          out.warn('no recent sessions found')
        }
        return { success: true, message: 'No recent sessions' }
      }

      if (options.md) {
        const shown = snapshots.slice(0, 10)
        const items = shown.map((s) => {
          const ago = dateHelper.formatDuration(Date.now() - new Date(s.timestamp).getTime())
          const project = s.projectName || s.projectId.slice(0, 8)
          const subtaskInfo =
            s.subtaskCount && s.activeSubtaskIndex !== undefined
              ? ` (${s.activeSubtaskIndex + 1}/${s.subtaskCount})`
              : ''
          return `[${s.taskStatus}] **${project}** — ${s.taskDescription}${subtaskInfo} (${ago} ago)`
        })
        if (snapshots.length > 10) items.push(`...and ${snapshots.length - 10} more`)

        console.log(
          mdOutput(
            mdSection(
              'Recent Sessions',
              `${snapshots.length} session${snapshots.length !== 1 ? 's' : ''} across projects`
            ),
            mdList(items),
            mdNextSteps([
              { label: 'Resume a session', command: 'prjct resume --md' },
              { label: 'Clean old sessions', command: 'prjct sessions --cleanup --md' },
            ])
          )
        )
      } else {
        out.done(`${snapshots.length} recent session${snapshots.length !== 1 ? 's' : ''}`)
        for (const s of snapshots) {
          const ago = dateHelper.formatDuration(Date.now() - new Date(s.timestamp).getTime())
          const project = s.projectName || s.projectId.slice(0, 8)
          console.log(`  [${s.taskStatus}] ${project} — ${s.taskDescription} (${ago} ago)`)
        }
      }

      return { success: true, snapshots, count: snapshots.length }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:tokens - Record token usage on active task
   * Accumulates input/output tokens for cost tracking and efficiency comparison
   */
  async tokens(
    args: string = '',
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      const currentTask = await stateStorage.getCurrentTask(projectId)
      if (!currentTask) {
        if (options.md) {
          mdActionRequired('idle', 'no_active_task', [
            { label: 'Start a task first', command: 'prjct task "description" --md' },
          ])
        } else {
          out.warn('no active task — start one first to track tokens')
        }
        return { success: false, error: 'No active task' }
      }

      // Parse: "tokens <in> <out>"
      const parts = args.trim().split(/\s+/)
      const tokensIn = parseInt(parts[0], 10)
      const tokensOut = parseInt(parts[1], 10)

      if (Number.isNaN(tokensIn) || Number.isNaN(tokensOut)) {
        const msg = 'Usage: prjct tokens <input_tokens> <output_tokens>'
        if (options.md) {
          console.log(mdOutput(mdSection('Tokens', msg)))
        } else {
          out.fail(msg)
        }
        return { success: false, error: msg }
      }

      const totals = await stateStorage.addTokens(projectId, tokensIn, tokensOut)
      if (!totals) {
        return { success: false, error: 'Failed to record tokens' }
      }

      if (options.md) {
        console.log(
          mdOutput(
            mdSection(
              'Tokens Recorded',
              `+${tokensIn.toLocaleString()} in / +${tokensOut.toLocaleString()} out`
            ),
            mdStats({
              'Total In': totals.tokensIn.toLocaleString(),
              'Total Out': totals.tokensOut.toLocaleString(),
              Total: (totals.tokensIn + totals.tokensOut).toLocaleString(),
              Task: currentTask.description,
            })
          )
        )
      } else {
        out.done(
          `tokens recorded: ${totals.tokensIn.toLocaleString()} in / ${totals.tokensOut.toLocaleString()} out`
        )
      }

      return { success: true, tokensIn: totals.tokensIn, tokensOut: totals.tokensOut }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

/** Format minutes to a human-readable duration string */
// =============================================================================
// Context Health & RPI Helpers (for --md output)
// =============================================================================

/**
 * Build efficiency directive section for --md output.
 * This is what Claude Code actually reads — must include sub-agent guidance.
 */
function buildEfficiencySection(): string {
  const lines = [
    '### Efficiency',
    '- Be concise. No preamble, no filler.',
    '- **Use sub-agents (Agent tool) for exploration that produces >5 file reads.** Sub-agents isolate context and prevent the main conversation from bloating.',
    '- Prefer `file:line` references over dumping full file contents.',
    '- When context grows large, use `prjct compact --md` to create a truth snapshot.',
  ]
  return lines.join('\n')
}

/**
 * Resolve RPI phase and build advisory section for --md output.
 * Returns null if RPI data is unavailable.
 */
function buildRpiSection(projectId: string): string | null {
  try {
    const { prjctDb } = require('../storage/database')
    const researchDoc = prjctDb.getDoc(projectId, 'rpi:current:research')
    const planDoc = prjctDb.getDoc(projectId, 'rpi:current:plan')

    let rpi: RpiContext
    if (!researchDoc) {
      rpi = { phase: 'research' }
    } else if (!planDoc) {
      rpi = { phase: 'plan', researchDoc }
    } else {
      rpi = { phase: 'implement', researchDoc, planDoc }
    }

    const lines: string[] = ['### RPI Phase']

    switch (rpi.phase) {
      case 'research':
        lines.push(
          '**Phase: RESEARCH** — Explore the codebase first. Use the **Agent tool** (sub-agents) for broad exploration.',
          'Produce a truth snapshot: exact files + lines, function call chains, test locations.',
          'Save findings with `prjct compact --md` when done exploring.'
        )
        break
      case 'plan':
        lines.push(
          '**Phase: PLAN** — Create an implementation plan with real code snippets.',
          'Reference exact files and line numbers from research.',
          'Use sub-agents to verify assumptions if needed.'
        )
        if (rpi.researchDoc) {
          lines.push('', '<research-context>', rpi.researchDoc, '</research-context>')
        }
        break
      case 'implement':
        lines.push(
          '**Phase: IMPLEMENT** — Execute the plan. Minimal exploration.',
          'Work only with the scoped files. Avoid reading new files unless absolutely necessary.'
        )
        if (rpi.planDoc) {
          // Extract scoped files from plan
          const filePattern = /`([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,6})`/g
          const scopedFiles = new Set<string>()
          for (const match of rpi.planDoc.matchAll(filePattern)) {
            scopedFiles.add(match[1])
          }
          if (scopedFiles.size > 0) {
            lines.push(
              `**Scoped Files**: ${[...scopedFiles]
                .slice(0, 20)
                .map((f) => `\`${f}\``)
                .join(', ')}`
            )
          }
        }
        break
    }

    return lines.join('\n')
  } catch {
    return null
  }
}

function formatMinutesToDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/** Load repo-analysis.json from global project path */
async function loadRepoAnalysis(globalPath: string): Promise<Record<string, unknown> | null> {
  try {
    const analysisPath = path.join(globalPath, 'analysis', 'repo-analysis.json')
    const content = await fs.readFile(analysisPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (isNotFoundError(error)) return null
    return null
  }
}

// Context contract, pattern ranking, and pattern briefing are in ./context-contract.ts
// Re-export for backward compatibility
export {
  buildContextContract,
  buildPatternBriefing,
  deduplicateDecisions,
  rankPatterns,
} from './context-contract'

/**
 * Build an ASCII flow diagram for a single command's workflow rules.
 * Shows: gates (before) → hooks (before) → COMMAND → steps → hooks (after)
 */
function buildFlowDiagram(command: string, rules: WorkflowRule[]): string {
  const gates = rules.filter((r) => r.type === 'gate' && r.position === 'before')
  const instructionsBefore = rules.filter(
    (r) => r.type === 'instruction' && r.position === 'before'
  )
  const hooksBefore = rules.filter((r) => r.type === 'hook' && r.position === 'before')
  const stepsBefore = rules.filter((r) => r.type === 'step' && r.position === 'before')
  const instructionsAfter = rules.filter((r) => r.type === 'instruction' && r.position === 'after')
  const hooksAfter = rules.filter((r) => r.type === 'hook' && r.position === 'after')
  const stepsAfter = rules.filter((r) => r.type === 'step' && r.position === 'after')

  const lines: string[] = []

  // Helper to draw a box with a label and rule items
  const drawBox = (label: string, items: WorkflowRule[], icon: string) => {
    const content = items.map((r) => {
      const status = r.enabled ? icon : 'o'
      return `  ${status} #${r.id} ${r.action}`
    })
    const allLines = [label, ...content]
    const maxLen = Math.max(...allLines.map((l) => l.length))
    const width = maxLen + 2

    lines.push(`+${'-'.repeat(width)}+`)
    for (const line of allLines) {
      lines.push(`| ${line.padEnd(width - 1)}|`)
    }
    lines.push(`+${'-'.repeat(width)}+`)
  }

  const arrow = (lines: string[]) => {
    lines.push('        |')
    lines.push('        v')
  }

  if (gates.length > 0) {
    drawBox('GATES (must pass)', gates, '#')
    arrow(lines)
  }

  if (instructionsBefore.length > 0) {
    drawBox('INSTRUCTIONS (before)', instructionsBefore, '📋')
    arrow(lines)
  }

  if (hooksBefore.length > 0) {
    drawBox('HOOKS (before)', hooksBefore, '>')
    arrow(lines)
  }

  if (stepsBefore.length > 0) {
    drawBox('STEPS (before)', stepsBefore, '>')
    arrow(lines)
  }

  // Command node
  lines.push(`   [ ${command.toUpperCase()} ]`)

  if (instructionsAfter.length > 0) {
    arrow(lines)
    drawBox('INSTRUCTIONS (after)', instructionsAfter, '📋')
  }

  if (hooksAfter.length > 0) {
    arrow(lines)
    drawBox('HOOKS (after)', hooksAfter, '>')
  }

  if (stepsAfter.length > 0) {
    arrow(lines)
    drawBox('STEPS (after)', stepsAfter, '>')
  }

  return lines.join('\n')
}

/** Get files modified since task start using git */
async function getFilesModifiedSinceTaskStart(
  projectPath: string,
  startedAt: string
): Promise<string[]> {
  const { execSync } = await import('node:child_process')
  const files = new Set<string>()
  const opts = { cwd: projectPath, encoding: 'utf-8' as const }

  try {
    const committed = execSync(
      `git log --since="${startedAt}" --name-only --pretty=format:""`,
      opts
    )
    for (const line of committed.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) files.add(trimmed)
    }
  } catch {
    // git log may fail if no commits since start
  }

  try {
    const staged = execSync('git diff --cached --name-only', opts)
    for (const line of staged.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) files.add(trimmed)
    }
  } catch {
    // ignore
  }

  try {
    const unstaged = execSync('git diff --name-only', opts)
    for (const line of unstaged.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) files.add(trimmed)
    }
  } catch {
    // ignore
  }

  return [...files]
}

/** Format a variance in minutes to a string like "+30m" or "-15m" */
function formatVariance(diffMinutes: number): string {
  const sign = diffMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(diffMinutes)
  if (abs >= 60) {
    const hours = Math.floor(abs / 60)
    const mins = abs % 60
    return mins > 0 ? `${sign}${hours}h ${mins}m` : `${sign}${hours}h`
  }
  return `${sign}${abs}m`
}
