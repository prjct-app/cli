/**
 * Tool Registry
 * Maps tool names to implementations for agentic execution.
 *
 * @module agentic/tool-registry
 * @version 1.0.0
 */

import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

type ToolFunction = (...args: unknown[]) => Promise<unknown>

interface ToolRegistry {
  tools: Map<string, ToolFunction>
  register(name: string, fn: ToolFunction): void
  get(name: string): ToolFunction | undefined
  isAllowed(name: string, allowedTools: string[]): boolean
  list(): string[]
}

const toolRegistry: ToolRegistry = {
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

// Read file
toolRegistry.register('Read', async (filePath: unknown): Promise<string | null> => {
  try {
    return await fs.readFile(filePath as string, 'utf-8')
  } catch {
    return null
  }
})

// Write file
toolRegistry.register('Write', async (filePath: unknown, content: unknown): Promise<boolean> => {
  try {
    await fs.writeFile(filePath as string, content as string, 'utf-8')
    return true
  } catch {
    return false
  }
})

// Execute bash command
toolRegistry.register('Bash', async (command: unknown): Promise<{ stdout: string; stderr: string }> => {
  try {
    const { stdout, stderr } = await execAsync(command as string)
    return { stdout, stderr }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || 'Command failed',
    }
  }
})

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
