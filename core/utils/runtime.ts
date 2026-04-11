/**
 * Runtime Detection Utility
 */

function detectRuntime(): 'bun' | 'node' {
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    return 'bun'
  }
  return 'node'
}

export function isBun(): boolean {
  return detectRuntime() === 'bun'
}

export function isBunAvailable(): boolean {
  if (detectRuntime() === 'bun') {
    return true
  }
  try {
    const { execSync } = require('node:child_process')
    execSync('bun --version', { stdio: 'ignore' })
    return true
  } catch (_error) {
    return false
  }
}
