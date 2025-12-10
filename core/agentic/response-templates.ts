/**
 * Response Templates
 * Consistent response formatting for commands
 *
 * @module agentic/response-templates
 * @version 1.0.0
 */

interface ResponseData {
  task?: string
  duration?: string
  feature?: string
  filesChanged?: number
  keyFile?: string
  nextAction?: string
  message?: string
  ideas?: number
  roadmapFeatures?: number
  pendingTasks?: number
  completedTasks?: number
  error?: string
  [key: string]: unknown
}

interface ResponseTemplate {
  success: (data: ResponseData) => string
  error: (data: ResponseData) => string
}

/**
 * Response templates by command
 */
const templates: Record<string, ResponseTemplate> = {
  done: {
    success: (data) => `✅ ${data.task || 'Task'} (${data.duration || '?'})

Files: ${data.filesChanged || 0} | Modified: ${data.keyFile || 'n/a'}
Next: ${data.nextAction || '/p:next for queue'}`,

    error: (data) => `❌ Could not complete task

${data.error || 'Unknown error'}
Try: /p:now to check current task`,
  },

  ship: {
    success: (data) => `🚀 ${data.feature || 'Feature'} shipped!

${data.message || 'Successfully deployed'}
Next: ${data.nextAction || '/p:recap for progress'}`,

    error: (data) => `❌ Ship failed

${data.error || 'Unknown error'}
Check git status and try again`,
  },

  now: {
    success: (data) => `🎯 Now working on: ${data.task || 'Task'}

${data.message || 'Focus set'}
When done: /p:done`,

    error: (data) => `❌ Could not set task

${data.error || 'Unknown error'}
Try: /p:init if project not initialized`,
  },

  feature: {
    success: (data) => `✨ Feature added: ${data.feature || 'New feature'}

${data.message || 'Added to roadmap'}
Start: /p:now to begin first task`,

    error: (data) => `❌ Could not add feature

${data.error || 'Unknown error'}`,
  },

  idea: {
    success: (data) => `💡 Idea captured!

${data.message || 'Saved to ideas.md'}
Total ideas: ${data.ideas || '?'}`,

    error: (data) => `❌ Could not save idea

${data.error || 'Unknown error'}`,
  },

  recap: {
    success: (data) => `📊 Project Recap

Features: ${data.roadmapFeatures || 0}
Pending: ${data.pendingTasks || 0}
Completed: ${data.completedTasks || 0}

${data.message || ''}`,

    error: (data) => `❌ Could not generate recap

${data.error || 'Unknown error'}
Try: /p:sync to refresh state`,
  },

  sync: {
    success: (data) => `🔄 Sync complete

${data.message || 'Project state updated'}
Next: ${data.nextAction || '/p:recap for overview'}`,

    error: (data) => `❌ Sync failed

${data.error || 'Unknown error'}
Try: /p:init to reinitialize`,
  },

  init: {
    success: (data) => `🎉 Project initialized!

${data.message || 'Ready to use prjct'}
Next: /p:sync to analyze codebase`,

    error: (data) => `❌ Initialization failed

${data.error || 'Unknown error'}
Check permissions and try again`,
  },

  default: {
    success: (data) => `✅ Done

${data.message || 'Operation completed'}`,

    error: (data) => `❌ Failed

${data.error || 'Unknown error'}`,
  },
}

/**
 * Format response for a command
 */
function format(commandName: string, data: ResponseData): string {
  const template = templates[commandName] || templates.default
  const success = data.error ? false : true

  if (success) {
    return template.success(data)
  } else {
    return template.error(data)
  }
}

/**
 * Get template for command
 */
function getTemplate(commandName: string): ResponseTemplate {
  return templates[commandName] || templates.default
}

export { format, getTemplate, templates }
export default { format, getTemplate, templates }
