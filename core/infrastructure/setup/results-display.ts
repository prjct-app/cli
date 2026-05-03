/**
 * Render the post-setup summary block for a single AI provider.
 * Pure I/O — every line goes to stdout, nothing is returned.
 */

import chalk from 'chalk'
import type { AIProviderConfig } from '../../types/provider'

export interface ProviderSetupResult {
  provider: AIProviderConfig['name']
  cliInstalled: boolean
  commandsAdded: number
  commandsUpdated: number
  configAction: string | null
}

export function showResults(results: ProviderSetupResult, provider: AIProviderConfig): void {
  console.log('')

  if (results.cliInstalled) {
    console.log(`   ${chalk.green('✓')} ${provider.displayName} CLI installed`)
  } else {
    console.log(`   ${chalk.green('✓')} ${provider.displayName} CLI found`)
  }

  const totalCommands = results.commandsAdded + results.commandsUpdated
  if (totalCommands > 0) {
    const parts: string[] = []
    if (results.commandsAdded > 0) parts.push(`${results.commandsAdded} new`)
    if (results.commandsUpdated > 0) parts.push(`${results.commandsUpdated} updated`)
    console.log(`   ${chalk.green('✓')} Commands synced (${parts.join(', ')})`)
  } else {
    console.log(`   ${chalk.green('✓')} Commands up to date`)
  }

  if (results.configAction === 'created') {
    console.log(`   ${chalk.green('✓')} Global config created (${provider.contextFile})`)
  } else if (results.configAction === 'updated') {
    console.log(`   ${chalk.green('✓')} Global config updated (${provider.contextFile})`)
  } else if (results.configAction === 'appended') {
    console.log(`   ${chalk.green('✓')} Global config merged (${provider.contextFile})`)
  }

  console.log('')
}
