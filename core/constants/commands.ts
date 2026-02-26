/** Commands that require orchestration (task routing, fragmentation) */
export const ORCHESTRATED_COMMANDS = ['task', 'done', 'ship', 'resume', 'bug', 'enrich']

/** Commands that do NOT need orchestration */
export const SIMPLE_COMMANDS = ['init', 'sync', 'pause', 'next', 'dash', 'history', 'undo', 'redo']

/** Commands that require chain of thought reasoning */
export const REASONING_REQUIRED_COMMANDS = ['ship', 'feature', 'spec', 'cleanup', 'migrate']
