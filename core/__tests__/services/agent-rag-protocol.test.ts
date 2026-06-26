import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { _routing as agentsRouting } from '../../services/project-agents-md'
import { _routing as claudeRouting } from '../../services/project-claude-md'

const ROOT = path.resolve(__dirname, '..', '..', '..')

const STATIC_AGENT_SURFACES = [
  'templates/codex/SKILL.md',
  'templates/antigravity/SKILL.md',
  'templates/global/GEMINI.md',
  'templates/global/CURSOR.mdc',
  'templates/global/WINDSURF.md',
  'templates/global/ANTIGRAVITY.md',
] as const

const SIZE_CAPPED_SKILLS = ['templates/codex/SKILL.md', 'templates/antigravity/SKILL.md'] as const

const MAX_SKILL_BYTES = 1024

const REQUIRED_PROTOCOL = [
  'RAG-backed project memory harness',
  'do not preload project history',
  'Pull',
  'not something to load wholesale',
] as const

const FORBIDDEN_ALWAYS_ON_PHRASES = [
  'prjct runs → LLM generates relevant data',
  'Context synthesis first, then Key data for UI',
  'load full project history',
  'preload full project history',
] as const

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8')
}

function expectProtocol(body: string): void {
  const normalized = body.toLowerCase()
  for (const required of REQUIRED_PROTOCOL) {
    expect(normalized).toContain(required.toLowerCase())
  }
}

describe('compact RAG-first agent protocol', () => {
  it('keeps generated AGENTS.md and CLAUDE.md surfaces lookup-first, not history carriers', () => {
    for (const body of [agentsRouting.FULL_BLOCK, claudeRouting.FULL_BLOCK]) {
      expectProtocol(body)
      for (const forbidden of FORBIDDEN_ALWAYS_ON_PHRASES) expect(body).not.toContain(forbidden)
    }
  })

  it('keeps static agent adapters aligned with the lookup-first protocol', () => {
    for (const relativePath of STATIC_AGENT_SURFACES) {
      const body = readRepoFile(relativePath)
      expectProtocol(body)
      for (const forbidden of FORBIDDEN_ALWAYS_ON_PHRASES) expect(body).not.toContain(forbidden)
    }
  })

  it('keeps always-loaded skills below the Codex skill size ceiling', () => {
    for (const relativePath of SIZE_CAPPED_SKILLS) {
      expect(Buffer.byteLength(readRepoFile(relativePath), 'utf-8')).toBeLessThanOrEqual(
        MAX_SKILL_BYTES
      )
    }
  })
})
