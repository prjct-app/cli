/**
 * Setup orchestrator. Drives the per-provider installation pipeline
 * (Claude Code, Gemini CLI, plus Antigravity & Codex skill installs)
 * and finishes by migrating known projects to the current CLI version.
 *
 * Implementation details live in `./setup/`:
 *   - ai-cli-install.ts   — npm-installs the chosen AI CLI when missing
 *   - gemini.ts           — Gemini router cleanup + GEMINI.md merge
 *   - antigravity.ts      — Google Antigravity SKILL.md install
 *   - codex-skill.ts      — OpenAI Codex SKILL.md install + verification
 *   - statusline.ts       — modular Claude Code statusline install
 *   - version-migration.ts — bump cliVersion on every known project
 *   - results-display.ts  — per-provider summary block
 *
 * Exposed:
 *   - `run()` — full pipeline. Auto-executes when this file is invoked
 *     directly (`bun core/infrastructure/setup.ts`).
 *   - `installCodexSkill`, `verifyCodexPRouterReady` — re-exported via
 *     direct imports from `./setup/codex-skill` (no barrel here; per
 *     project rule, callers import the module they actually need).
 *   - `installStatusLine` — same: import from `./setup/statusline`.
 */

import chalk from 'chalk'
import context7Service from '../services/context7-service'
import type { AIProviderName } from '../types/provider'
import { VERSION } from '../utils/version'
import {
  detectAllProviders,
  detectAntigravity,
  detectCodex,
  Providers,
  selectProvider,
} from './ai-provider'
import installer from './command-installer'
import editorsConfig from './editors-config'
import { installAICLI } from './setup/ai-cli-install'
import { installAntigravitySkill } from './setup/antigravity'
import { installCodexSkill, verifyCodexPRouterReady } from './setup/codex-skill'
import { installGeminiGlobalConfig, installGeminiRouter } from './setup/gemini'
import { type ProviderSetupResult, showResults } from './setup/results-display'
import { installStatusLine } from './setup/statusline'
import { migrateProjectsCliVersion } from './setup/version-migration'

interface SetupResults {
  provider: AIProviderName // Primary provider
  providers: ProviderSetupResult[] // All installed providers
  cliInstalled: boolean
  commandsAdded: number
  commandsUpdated: number
  configAction: string | null
}

/**
 * Main setup function — installs for ALL detected providers.
 */
async function run(): Promise<SetupResults> {
  // Step 0: Detect all available providers
  const detection = await detectAllProviders()
  const selection = await selectProvider()

  const results: SetupResults = {
    provider: selection.provider,
    providers: [],
    cliInstalled: false,
    commandsAdded: 0,
    commandsUpdated: 0,
    configAction: null,
  }

  // Step 1: Install for each CLI-based provider (Claude, Gemini)
  // Note: Cursor is project-level and handled separately via installCursorProject()
  const cliProviderNames: ('claude' | 'gemini')[] = ['claude', 'gemini']

  for (const providerName of cliProviderNames) {
    const providerConfig = Providers[providerName]
    const providerDetection = detection[providerName]

    const providerResult: ProviderSetupResult = {
      provider: providerName,
      cliInstalled: false,
      commandsAdded: 0,
      commandsUpdated: 0,
      configAction: null,
    }

    // Check if CLI is installed
    if (!providerDetection.installed) {
      // Only prompt to install the primary (selected) provider
      if (providerName === selection.provider) {
        const installed = await installAICLI(providerConfig)
        if (installed) {
          providerResult.cliInstalled = true
          results.cliInstalled = true
        } else {
          throw new Error(`${providerConfig.displayName} installation failed`)
        }
      } else {
        // Skip non-primary providers that aren't installed
        continue
      }
    }

    // Step 2: Install commands and config for this provider
    if (providerName === 'claude') {
      const providerDetected = await installer.detectActiveProvider()

      if (providerDetected) {
        // Sync commands
        const syncResult = await installer.syncCommands()
        if (syncResult.success) {
          providerResult.commandsAdded = syncResult.added
          providerResult.commandsUpdated = syncResult.updated
          results.commandsAdded += syncResult.added
          results.commandsUpdated += syncResult.updated
        }

        // Install global configuration
        const configResult = await installer.installGlobalConfig()
        if (configResult.success) {
          providerResult.configAction = configResult.action
          if (!results.configAction) {
            results.configAction = configResult.action
          }
        }

        // Install documentation files
        await installer.installDocs()

        // Install status line (Claude only)
        await installStatusLine()

        // Install and verify Context7 MCP (required for coding workflows)
        await context7Service.ensureReady()
      }
    } else if (providerName === 'gemini') {
      // Gemini provider — install router and global config
      const geminiInstalled = await installGeminiRouter()
      if (geminiInstalled) {
        providerResult.commandsAdded = 1
        results.commandsAdded += 1
      }

      const geminiConfigResult = await installGeminiGlobalConfig()
      if (geminiConfigResult.success) {
        providerResult.configAction = geminiConfigResult.action
      }
    }

    results.providers.push(providerResult)
  }

  // Step 2b: Install for Antigravity if detected (separate from CLI providers)
  const antigravityDetection = await detectAntigravity()
  if (antigravityDetection.installed) {
    const antigravityResult = await installAntigravitySkill()
    if (antigravityResult.success) {
      console.log(`   ${chalk.green('✓')} Antigravity skill installed`)
    }
  }

  // Step 2c: Install for Codex if detected
  const codexDetection = await detectCodex()
  if (codexDetection.installed) {
    const codexResult = await installCodexSkill()
    if (!codexResult.success) {
      throw new Error('Codex skill installation failed')
    }

    const codexRouter = await verifyCodexPRouterReady({ autoRepair: true })
    if (!codexRouter.verified) {
      throw new Error(codexRouter.message || 'Codex p. router verification failed')
    }

    console.log(`   ${chalk.green('✓')} Codex skill installed`)
    console.log(`   ${chalk.green('✓')} Codex p. router ready`)
  }

  // Step 3: Save version in editors-config
  await editorsConfig.saveConfig(VERSION, await installer.getInstallPath(), selection.provider)

  // Step 4: Migrate existing projects to add cliVersion
  await migrateProjectsCliVersion()

  // Show results for all providers
  for (const providerResult of results.providers) {
    showResults(providerResult, Providers[providerResult.provider])
  }

  return results
}

// Auto-execute when run directly (for bun/node CLI usage).
// This enables: `bun core/infrastructure/setup.ts`.
const isDirectRun = process.argv[1]?.includes('setup.ts') || process.argv[1]?.includes('setup.js')
if (isDirectRun) {
  run().catch((error) => {
    console.error('Setup error:', error.message)
    process.exit(1)
  })
}
