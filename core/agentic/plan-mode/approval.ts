/**
 * Plan Mode Approval Prompts
 */

import type { ApprovalPrompt, ApprovalContext } from './types'

/**
 * Generate approval prompt for destructive commands
 */
export function generateApprovalPrompt(commandName: string, context: ApprovalContext): ApprovalPrompt {
  const prompts: Record<string, ApprovalPrompt> = {
    ship: {
      title: 'Ship Confirmation',
      message: 'Ready to commit and push changes?',
      details: [
        `Branch: ${context.branch || 'current'}`,
        `Files: ${context.changedFiles?.length || 0} changed`,
        `Commit: "${context.commitMessage || 'No message'}"`,
      ],
      options: [
        { key: 'y', label: 'Yes, ship it', action: 'approve' },
        { key: 'n', label: 'No, cancel', action: 'reject' },
        { key: 'e', label: 'Edit message', action: 'edit' },
      ],
    },
    cleanup: {
      title: 'Cleanup Confirmation',
      message: 'This will delete files/code. Continue?',
      details: [`Files to delete: ${context.filesToDelete?.length || 0}`, `Code to remove: ${context.linesOfCode || 0} lines`],
      options: [
        { key: 'y', label: 'Yes, cleanup', action: 'approve' },
        { key: 'n', label: 'No, cancel', action: 'reject' },
        { key: 'l', label: 'List files first', action: 'list' },
      ],
    },
    git: {
      title: 'Git Operation Confirmation',
      message: `Execute: ${context.operation || 'git operation'}?`,
      details: context.warnings || [],
      options: [
        { key: 'y', label: 'Yes, execute', action: 'approve' },
        { key: 'n', label: 'No, cancel', action: 'reject' },
      ],
    },
  }

  return (
    prompts[commandName] || {
      title: 'Confirmation Required',
      message: `Execute ${commandName}?`,
      options: [
        { key: 'y', label: 'Yes', action: 'approve' },
        { key: 'n', label: 'No', action: 'reject' },
      ],
    }
  )
}
