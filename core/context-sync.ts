/**
 * Context Sync
 *
 * Wrapper that generates context MD files from JSON data.
 * Uses the context generator to create CLAUDE.md, now.md, queue.md, summary.md
 */

import { generateContext } from './context/generator'

/**
 * Generate local context files for Claude
 */
async function generateLocalContext(projectPath: string, projectId: string): Promise<void> {
  await generateContext(projectId, projectPath)
}

export { generateLocalContext }
export default { generateLocalContext }
