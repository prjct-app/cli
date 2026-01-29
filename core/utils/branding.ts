/**
 * Branding Configuration for prjct-cli
 * Single source of truth for all branding across CLI and AI agents
 *
 * Supports multiple AI providers (Claude Code, Gemini CLI)
 */

import chalk from 'chalk'
import { getProviderBranding } from '../infrastructure/ai-provider'
import type { AIProviderName } from '../types/provider'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_SPEED = 80

interface Branding {
  name: string
  icon: string
  signature: string
  spinner: {
    frames: string[]
    speed: number
  }
  cli: {
    header: () => string
    footer: () => string
    spin: (frame: number, msg?: string) => string
  }
  template: {
    header: string
    footer: string
  }
  commitFooter: string
  urls: {
    website: string
    docs: string
  }
  // Provider-aware methods
  getCommitFooter: (provider?: AIProviderName) => string
  getSignature: (provider?: AIProviderName) => string
}

const branding: Branding = {
  // Core identity
  name: 'prjct',
  icon: '⚡',
  signature: '⚡ prjct',

  // Spinner config
  spinner: {
    frames: SPINNER_FRAMES,
    speed: SPINNER_SPEED,
  },

  // CLI output (with chalk colors)
  cli: {
    header: () => `${chalk.cyan.bold('⚡')} ${chalk.cyan('prjct')}`,
    footer: () => chalk.dim('⚡ prjct'),
    spin: (frame: number, msg?: string) =>
      `${chalk.cyan('⚡')} ${chalk.cyan('prjct')} ${chalk.cyan(SPINNER_FRAMES[frame % 10])} ${chalk.dim(msg || '')}`,
  },

  // Template (plain text)
  template: {
    header: '⚡ prjct',
    footer: '⚡ prjct',
  },

  // Default Git commit footer (generic)
  commitFooter: `Generated with [p/](https://www.prjct.app/)`,

  // URLs
  urls: {
    website: 'https://prjct.app',
    docs: 'https://prjct.app/docs',
  },

  // Provider-aware commit footer
  getCommitFooter: (provider: AIProviderName = 'claude') => {
    return getProviderBranding(provider).commitFooter
  },

  // Provider-aware signature
  getSignature: (provider: AIProviderName = 'claude') => {
    return getProviderBranding(provider).signature
  },
}

export default branding
