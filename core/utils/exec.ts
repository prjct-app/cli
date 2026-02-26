import { exec as execCallback, execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
export const execAsync = promisify(execCallback)
export const execFileAsync = promisify(execFileCallback)
