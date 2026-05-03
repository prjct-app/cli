/**
 * Hook manager detection + per-strategy install / uninstall implementations.
 *
 * Three managers supported: lefthook, husky, direct (.git/hooks).
 * Each install function appends to existing config when present rather
 * than overwriting, so prjct cohabits with project-owned hooks.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { HookName, HookStrategy } from '../../types/services/extracted'
import { fileExists } from '../../utils/file-helper'
import { getPostCheckoutScript, getPostCommitScript } from './scripts'

// ============================================================================
// DETECTION
// ============================================================================

export async function detectHookManagers(projectPath: string): Promise<HookStrategy[]> {
  const detected: HookStrategy[] = []

  if (
    (await fileExists(path.join(projectPath, 'lefthook.yml'))) ||
    (await fileExists(path.join(projectPath, 'lefthook.yaml')))
  ) {
    detected.push('lefthook')
  }

  if (
    (await fileExists(path.join(projectPath, '.husky'))) ||
    (await fileExists(path.join(projectPath, '.husky', '_')))
  ) {
    detected.push('husky')
  }

  if (await fileExists(path.join(projectPath, '.git'))) {
    detected.push('direct')
  }

  return detected
}

export function selectStrategy(detected: HookStrategy[]): HookStrategy {
  if (detected.includes('lefthook')) return 'lefthook'
  if (detected.includes('husky')) return 'husky'
  return 'direct'
}

// ============================================================================
// INSTALL
// ============================================================================

export async function installLefthook(projectPath: string, hooks: HookName[]): Promise<boolean> {
  const configFile = (await fileExists(path.join(projectPath, 'lefthook.yml')))
    ? 'lefthook.yml'
    : 'lefthook.yaml'
  const configPath = path.join(projectPath, configFile)

  let content = await fs.readFile(configPath, 'utf-8')

  for (const hook of hooks) {
    const sectionName = hook
    const commandName = `prjct-sync-${hook}`

    if (content.includes(commandName)) continue

    const hookBlock = `
${sectionName}:
  commands:
    ${commandName}:
      run: prjct sync --quiet --yes
      fail_text: "prjct sync failed (non-blocking)"
`

    const escapedSection = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const sectionRegex = new RegExp(`^${escapedSection}:\\s*$`, 'm')
    if (sectionRegex.test(content)) {
      content = content.replace(
        sectionRegex,
        `${sectionName}:\n  commands:\n    ${commandName}:\n      run: prjct sync --quiet --yes\n      fail_text: "prjct sync failed (non-blocking)"`
      )
    } else {
      content = `${content.trimEnd()}\n${hookBlock}`
    }
  }

  await fs.writeFile(configPath, content, 'utf-8')
  return true
}

export async function installHusky(projectPath: string, hooks: HookName[]): Promise<boolean> {
  const huskyDir = path.join(projectPath, '.husky')

  for (const hook of hooks) {
    const hookPath = path.join(huskyDir, hook)
    const script = hook === 'post-commit' ? getPostCommitScript() : getPostCheckoutScript()

    if (await fileExists(hookPath)) {
      const existing = await fs.readFile(hookPath, 'utf-8')
      if (existing.includes('prjct sync')) continue
      await fs.appendFile(hookPath, '\n# prjct auto-sync\nprjct sync --quiet --yes &\n')
    } else {
      await fs.writeFile(hookPath, script, { mode: 0o755 })
    }
  }

  return true
}

export async function installDirect(projectPath: string, hooks: HookName[]): Promise<boolean> {
  const hooksDir = path.join(projectPath, '.git', 'hooks')

  if (!(await fileExists(hooksDir))) {
    await fs.mkdir(hooksDir, { recursive: true })
  }

  for (const hook of hooks) {
    const hookPath = path.join(hooksDir, hook)
    const script = hook === 'post-commit' ? getPostCommitScript() : getPostCheckoutScript()

    if (await fileExists(hookPath)) {
      const existing = await fs.readFile(hookPath, 'utf-8')
      if (existing.includes('prjct sync')) continue
      await fs.appendFile(
        hookPath,
        `\n# prjct auto-sync\n${script.split('\n').slice(1).join('\n')}`
      )
    } else {
      await fs.writeFile(hookPath, script, { mode: 0o755 })
    }
  }

  return true
}

// ============================================================================
// UNINSTALL
// ============================================================================

export async function uninstallLefthook(projectPath: string): Promise<boolean> {
  const configFile = (await fileExists(path.join(projectPath, 'lefthook.yml')))
    ? 'lefthook.yml'
    : 'lefthook.yaml'
  const configPath = path.join(projectPath, configFile)

  if (!(await fileExists(configPath))) return false

  let content = await fs.readFile(configPath, 'utf-8')

  content = content.replace(/\s*prjct-sync-[\w-]+:[\s\S]*?(?=\n\S|\n*$)/g, '')
  content = content.replace(/^(post-commit|post-checkout):\s*commands:\s*$/gm, '')

  await fs.writeFile(configPath, `${content.trimEnd()}\n`, 'utf-8')
  return true
}

export async function uninstallHusky(projectPath: string): Promise<boolean> {
  const huskyDir = path.join(projectPath, '.husky')

  for (const hook of ['post-commit', 'post-checkout'] as HookName[]) {
    const hookPath = path.join(huskyDir, hook)
    if (!(await fileExists(hookPath))) continue

    const content = await fs.readFile(hookPath, 'utf-8')
    if (!content.includes('prjct sync')) continue

    const cleaned = content
      .split('\n')
      .filter((line) => !line.includes('prjct sync') && !line.includes('prjct auto-sync'))
      .join('\n')

    if (cleaned.trim() === '#!/bin/sh' || cleaned.trim() === '#!/usr/bin/env sh') {
      await fs.unlink(hookPath)
    } else {
      await fs.writeFile(hookPath, cleaned, { mode: 0o755 })
    }
  }

  return true
}

export async function uninstallDirect(projectPath: string): Promise<boolean> {
  const hooksDir = path.join(projectPath, '.git', 'hooks')

  for (const hook of ['post-commit', 'post-checkout'] as HookName[]) {
    const hookPath = path.join(hooksDir, hook)
    if (!(await fileExists(hookPath))) continue

    const content = await fs.readFile(hookPath, 'utf-8')
    if (!content.includes('prjct sync')) continue

    if (content.includes('Installed by: prjct hooks install')) {
      await fs.unlink(hookPath)
    } else {
      const cleaned = content
        .split('\n')
        .filter((line) => !line.includes('prjct sync') && !line.includes('prjct auto-sync'))
        .join('\n')
      await fs.writeFile(hookPath, cleaned, { mode: 0o755 })
    }
  }

  return true
}
