#!/usr/bin/env node

const { execFileSync } = require('node:child_process')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function hasBetterSqliteBinding() {
  try {
    const Database = require('better-sqlite3')
    new Database(':memory:').close()
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.includes('Could not locate the bindings file') ||
      message.includes('better_sqlite3.node')
    ) {
      return false
    }
    throw error
  }
}

function ensureNativeDependencies(options = {}) {
  if (process.env.PRJCT_SKIP_NATIVE_REBUILD === '1') {
    return { rebuilt: false, skipped: true }
  }
  if (hasBetterSqliteBinding()) {
    return { rebuilt: false, skipped: false }
  }

  const stdio = options.stdio || 'inherit'
  execFileSync(npmCommand(), ['rebuild', 'better-sqlite3', '--foreground-scripts'], {
    cwd: ROOT,
    stdio,
    timeout: 120000,
  })

  if (!hasBetterSqliteBinding()) {
    throw new Error('better-sqlite3 native binding is still unavailable after rebuild')
  }

  return { rebuilt: true, skipped: false }
}

if (require.main === module) {
  try {
    ensureNativeDependencies()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`prjct native dependency install failed: ${message}`)
    process.exit(1)
  }
}

module.exports = {
  ensureNativeDependencies,
  hasBetterSqliteBinding,
}
