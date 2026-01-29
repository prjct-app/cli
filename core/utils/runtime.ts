/**
 * Runtime Detection Utility
 *
 * Detects available JavaScript runtimes and provides utilities
 * for runtime-agnostic code execution.
 *
 * @version 1.0.0
 */

import type { Runtime } from '../types'

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): Runtime {
  // Check for Bun-specific global
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    return 'bun'
  }

  return 'node'
}

/**
 * Check if Bun is available on the system
 */
export function isBunAvailable(): boolean {
  // If we're already running in Bun, it's available
  if (detectRuntime() === 'bun') {
    return true
  }

  // Check if bun command exists in PATH
  try {
    const { execSync } = require('node:child_process')
    execSync('bun --version', { stdio: 'ignore' })
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Check if Node is available on the system
 */
export function isNodeAvailable(): boolean {
  // If we're running, Node is available (either native or via Bun's node compat)
  return true
}

/**
 * Get runtime version
 */
export function getRuntimeVersion(): string {
  const runtime = detectRuntime()

  if (runtime === 'bun') {
    return `bun ${Bun.version || 'unknown'}`
  }

  return `node ${process.version}`
}

/**
 * Check if we're running in a Bun environment
 */
export function isBun(): boolean {
  return detectRuntime() === 'bun'
}

/**
 * Check if we're running in a Node environment
 */
export function isNode(): boolean {
  return detectRuntime() === 'node'
}

/**
 * Get the preferred runtime for execution
 * Returns 'bun' if available, otherwise 'node'
 */
export function getPreferredRuntime(): Runtime {
  if (isBunAvailable()) {
    return 'bun'
  }
  return 'node'
}

/**
 * Get command to run a script with the appropriate runtime
 */
export function getRunCommand(scriptPath: string, args: string[] = []): string {
  const runtime = getPreferredRuntime()
  const argsStr = args.length > 0 ? ` ${args.join(' ')}` : ''

  if (runtime === 'bun') {
    return `bun ${scriptPath}${argsStr}`
  }

  // For Node, check if it's a .ts file
  if (scriptPath.endsWith('.ts')) {
    // Use compiled version
    const jsPath = scriptPath.replace(/\.ts$/, '.js').replace('/bin/', '/dist/bin/')
    return `node ${jsPath}${argsStr}`
  }

  return `node ${scriptPath}${argsStr}`
}

export default {
  detectRuntime,
  isBunAvailable,
  isNodeAvailable,
  getRuntimeVersion,
  isBun,
  isNode,
  getPreferredRuntime,
  getRunCommand,
}
