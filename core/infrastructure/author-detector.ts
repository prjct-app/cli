/**
 * Author Detector - Detects author information from multiple sources
 *
 * Detection priority:
 * 1. GitHub CLI (gh api user) - Most reliable for GitHub username
 * 2. Git config (user.name and user.email)
 * 3. Fallback to 'Unknown'
 *
 * @module infrastructure/author-detector
 */

import { promisify } from 'util'
import { exec as execCallback } from 'child_process'
import type { DetectedAuthorInfo, AuthorConfigStatus } from '../types'

const exec = promisify(execCallback)

// ============ Internal Helpers ============

async function execCommand(command: string): Promise<{ success: boolean; output: string }> {
  try {
    const { stdout } = await exec(command, { timeout: 5000 })
    return { success: true, output: stdout.trim() }
  } catch {
    return { success: false, output: '' }
  }
}

// ============ Detection Functions ============

export async function detectGitHubUsername(): Promise<string | null> {
  let result = await execCommand('gh api user --jq .login')
  if (result.success && result.output) return result.output

  result = await execCommand('git config --global github.user')
  if (result.success && result.output) return result.output

  return null
}

export async function detectGitName(): Promise<string | null> {
  const result = await execCommand('git config user.name')
  return result.success && result.output ? result.output : null
}

export async function detectGitEmail(): Promise<string | null> {
  const result = await execCommand('git config user.email')
  return result.success && result.output ? result.output : null
}

export async function detect(): Promise<DetectedAuthorInfo> {
  const [github, name, email] = await Promise.all([
    detectGitHubUsername(),
    detectGitName(),
    detectGitEmail()
  ])

  return {
    github,
    email,
    name: name || github || 'Unknown'
  }
}

export async function detectAuthorForLogs(): Promise<string> {
  const author = await detect()
  return author.github || (author.name !== 'Unknown' ? author.name! : 'unknown')
}

// ============ Status Functions ============

export async function isGitHubCLIAvailable(): Promise<boolean> {
  const result = await execCommand('gh --version')
  return result.success
}

export async function isGitConfigured(): Promise<boolean> {
  const [name, email] = await Promise.all([detectGitName(), detectGitEmail()])
  return !!(name && email)
}

export async function getConfigStatus(): Promise<AuthorConfigStatus> {
  const [hasGitHub, hasGit, author] = await Promise.all([
    isGitHubCLIAvailable(),
    isGitConfigured(),
    detect()
  ])

  return {
    hasGitHub,
    hasGit,
    author,
    isComplete: !!(author.github || (author.name !== 'Unknown' && author.email)),
    recommendations: getRecommendations(hasGitHub, hasGit, author)
  }
}

function getRecommendations(hasGitHub: boolean, hasGit: boolean, author: DetectedAuthorInfo): string[] {
  const recommendations: string[] = []

  if (!hasGitHub && !author.github) {
    recommendations.push('Install GitHub CLI (gh) for better collaboration support: https://cli.github.com/')
  }

  if (!hasGit) {
    recommendations.push('Configure git user: git config --global user.name "Your Name"')
    recommendations.push('Configure git email: git config --global user.email "your@email.com"')
  }

  if (author.github && !author.email) {
    recommendations.push('Consider setting your git email for better tracking')
  }

  return recommendations
}

// ============ Formatting ============

export function formatAuthor(author: DetectedAuthorInfo): string {
  const parts: string[] = []

  if (author.name && author.name !== 'Unknown') parts.push(author.name)
  if (author.github) parts.push(`@${author.github}`)
  if (author.email) parts.push(`<${author.email}>`)

  return parts.join(' ') || 'Unknown'
}

// ============ Default Export (backwards compat) ============

export default {
  detect,
  detectAuthorForLogs,
  detectGitHubUsername,
  detectGitName,
  detectGitEmail,
  isGitHubCLIAvailable,
  isGitConfigured,
  getConfigStatus,
  formatAuthor
}
