/**
 * Tool Registry
 * Maps tool names to implementations for agentic execution.
 *
 * @module agentic/tool-registry
 * @version 1.0.0
 */

import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import type { ToolFunction, ToolRegistryInterface } from '../types/agentic'
import { defaultToolRetryPolicy, isPermanentError, isTransientError } from '../utils/retry'

// Re-export types for convenience
export type { ToolFunction, ToolRegistryInterface } from '../types/agentic'

const execAsync = promisify(exec)

const toolRegistry: ToolRegistryInterface = {
  tools: new Map(),

  /**
   * Register a tool
   */
  register(name: string, fn: ToolFunction): void {
    this.tools.set(name, fn)
  },

  /**
   * Get a tool by name
   */
  get(name: string): ToolFunction | undefined {
    return this.tools.get(name)
  },

  /**
   * Check if tool is allowed for command
   */
  isAllowed(name: string, allowedTools: string[]): boolean {
    // If no restrictions, allow all
    if (!allowedTools || allowedTools.length === 0) {
      return true
    }

    // Check if tool name matches or starts with allowed pattern
    return allowedTools.some((allowed) => {
      if (allowed.endsWith('*')) {
        return name.startsWith(allowed.slice(0, -1))
      }
      return name === allowed
    })
  },

  /**
   * List all registered tools
   */
  list(): string[] {
    return Array.from(this.tools.keys())
  },
}

// Register built-in tools

// Read file with retry for transient errors
toolRegistry.register('Read', async (filePath: unknown): Promise<string | null> => {
  try {
    return await defaultToolRetryPolicy.execute(
      async () => await fs.readFile(filePath as string, 'utf-8'),
      `read-${filePath}`
    )
  } catch (error) {
    // Permanent errors (ENOENT, EPERM) - return null (expected)
    if (isPermanentError(error)) {
      return null
    }
    // Transient errors exhausted retries - return null
    if (isTransientError(error)) {
      return null
    }
    // Unknown errors - return null (fail gracefully)
    return null
  }
})

// Write file with retry for transient errors
toolRegistry.register('Write', async (filePath: unknown, content: unknown): Promise<boolean> => {
  try {
    await defaultToolRetryPolicy.execute(
      async () => await fs.writeFile(filePath as string, content as string, 'utf-8'),
      `write-${filePath}`
    )
    return true
  } catch (error) {
    // Permanent errors (EPERM, EISDIR) - return false (expected)
    if (isPermanentError(error)) {
      return false
    }
    // Transient errors exhausted retries - return false
    if (isTransientError(error)) {
      return false
    }
    // Unknown errors - return false (fail gracefully)
    return false
  }
})

// Execute bash command with retry for transient errors
toolRegistry.register(
  'Bash',
  async (command: unknown): Promise<{ stdout: string; stderr: string }> => {
    try {
      return await defaultToolRetryPolicy.execute(
        async () => await execAsync(command as string),
        `bash-${command}`
      )
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string; code?: string }

      // For command execution errors, return output with error in stderr
      // This maintains the existing behavior while adding retry for transient errors
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message || 'Command failed',
      }
    }
  }
)

// Get current timestamp
toolRegistry.register('GetTimestamp', async (): Promise<string> => {
  return new Date().toISOString()
})

// Get current date
toolRegistry.register('GetDate', async (): Promise<string> => {
  return new Date().toISOString().split('T')[0]
})

// Get current datetime
toolRegistry.register('GetDateTime', async (): Promise<string> => {
  return new Date().toISOString()
})

export default toolRegistry
export { toolRegistry }
