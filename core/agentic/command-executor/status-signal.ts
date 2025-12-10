/**
 * Status Signal
 * Running file for status line integration
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

const RUNNING_FILE = path.join(os.homedir(), '.prjct-cli', '.running')

/**
 * Signal that a command is running (for status line)
 */
export function signalStart(commandName: string): void {
  try {
    const dir = path.dirname(RUNNING_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(RUNNING_FILE, `/p:${commandName}`)
  } catch {
    // Silently ignore - status line is optional
  }
}

/**
 * Signal that command has finished (for status line)
 */
export function signalEnd(): void {
  try {
    if (fs.existsSync(RUNNING_FILE)) {
      fs.unlinkSync(RUNNING_FILE)
    }
  } catch {
    // Silently ignore - status line is optional
  }
}
