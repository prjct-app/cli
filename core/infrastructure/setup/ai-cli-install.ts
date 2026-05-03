/**
 * Install an AI CLI provider (Claude Code or Gemini CLI) globally via
 * npm. PRJ-114 enhanced this with graceful degradation: if npm itself
 * is missing or the install times out, we print install alternatives
 * (brew, pnpm, yarn, npx) and return false instead of throwing.
 */

import { execFileSync } from 'node:child_process'
import chalk from 'chalk'
import { dependencyValidator } from '../../services/dependency-validator'
import type { AIProviderConfig } from '../../types/provider'
import { getTimeout } from '../../utils/constants'

export async function installAICLI(provider: AIProviderConfig): Promise<boolean> {
  const packageName =
    provider.name === 'claude' ? '@anthropic-ai/claude-code' : '@google/gemini-cli'

  // PRJ-114: Check npm availability first
  if (!dependencyValidator.isAvailable('npm')) {
    console.log(`${chalk.yellow('⚠️  npm is not available')}`)
    console.log('')
    console.log(`${chalk.dim(`Install ${provider.displayName} using one of:`)}`)
    console.log(chalk.dim('  • Install Node.js: https://nodejs.org'))
    console.log(
      chalk.dim(
        `  • Use Homebrew: brew install ${provider.name === 'claude' ? 'claude' : 'gemini'}`
      )
    )
    console.log(chalk.dim(`  • Use npx directly: npx ${packageName}`))
    console.log('')
    return false
  }

  try {
    console.log(chalk.yellow(`📦 ${provider.displayName} not found. Installing...`))
    console.log('')
    // PRJ-111: Add timeout to npm install (default: 2 minutes, configurable via PRJCT_TIMEOUT_NPM_INSTALL)
    execFileSync('npm', ['install', '-g', packageName], {
      stdio: 'inherit',
      timeout: getTimeout('NPM_INSTALL'),
    })
    console.log('')
    console.log(`${chalk.green('✓')} ${provider.displayName} installed successfully`)
    console.log('')
    return true
  } catch (error) {
    const err = error as Error & { killed?: boolean; signal?: string }
    const isTimeout = err.killed && err.signal === 'SIGTERM'

    if (isTimeout) {
      console.log(chalk.yellow(`⚠️  Installation timed out for ${provider.displayName}`))
      console.log('')
      console.log(chalk.dim('The npm install took too long. Try:'))
      console.log(chalk.dim('  • Set PRJCT_TIMEOUT_NPM_INSTALL=300000 for 5 minutes'))
      console.log(chalk.dim(`  • Run manually: npm install -g ${packageName}`))
    } else {
      console.log(chalk.yellow(`⚠️  Failed to install ${provider.displayName}: ${err.message}`))
    }
    console.log('')
    console.log(chalk.dim('Alternative installation methods:'))
    console.log(chalk.dim(`  • npm:  npm install -g ${packageName}`))
    console.log(chalk.dim(`  • yarn: yarn global add ${packageName}`))
    console.log(chalk.dim(`  • pnpm: pnpm add -g ${packageName}`))
    console.log(
      chalk.dim(`  • brew: brew install ${provider.name === 'claude' ? 'claude' : 'gemini'}`)
    )
    console.log('')
    return false
  }
}
