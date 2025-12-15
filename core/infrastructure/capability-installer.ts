/**
 * Capability Installer
 *
 * AGENTIC: This module provides TOOLS, not DECISIONS.
 * Claude reads project context and decides what to install/configure.
 *
 * NO hardcoded configurations for specific frameworks.
 * Configuration should be template-driven, not code-driven.
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface Recommendation {
  install: string
}

interface InstallResult {
  success: boolean
  capability: string
  command: string
  duration?: number
  output?: string
  errors?: string | null
  error?: string
}

class CapabilityInstaller {
  /**
   * Install capability using provided command
   *
   * AGENTIC: Claude provides the install command based on analysis.
   * This is just the executor - no hardcoded logic.
   */
  async install(
    capability: string,
    recommendation: Recommendation,
    _dataPath: string
  ): Promise<InstallResult> {
    const command = recommendation.install
    const startTime = Date.now()

    try {
      const { stdout, stderr } = await execAsync(command)

      const duration = Date.now() - startTime
      const durationMin = Math.round((duration / 1000 / 60) * 10) / 10

      return {
        success: true,
        capability,
        command,
        duration: durationMin,
        output: stdout,
        errors: stderr || null,
      }
    } catch (error) {
      return {
        success: false,
        capability,
        command,
        error: (error as Error).message,
      }
    }
  }

  // NOTE: configure() and hardcoded framework configs REMOVED.
  // Configuration is AGENTIC - Claude reads templates and generates configs.
  // See templates/workflows/ for configuration guidance.
}

const capabilityInstaller = new CapabilityInstaller()
export default capabilityInstaller
