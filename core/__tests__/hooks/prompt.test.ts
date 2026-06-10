/**
 * UserPromptSubmit hook — project state injection.
 *
 * The state block is the LLM's per-turn anchor for intent
 * disambiguation. These tests pin the contract:
 *   1. No project config → null (no injection).
 *   2. With a fresh project → at least one fact emitted.
 *   3. Active task → surfaces task description + relative time.
 *   4. Git working tree → surfaces branch + dirty/clean state.
 *   5. Inbox entries → surfaces count.
 *   6. Empty repo (no HEAD) doesn't break the hook.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildProjectState, buildTopicalCue } from '../../hooks/prompt'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import prjctDb from '../../storage/database'
import { stateStorage } from '../../storage/state-storage'
import { execFileAsync } from '../../utils/exec'

let projectPath: string
let projectId: string

async function freshProject(): Promise<void> {
  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-prompt-state-test-'))
  await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
  projectId = `prompt-state-${crypto.randomUUID()}`
  await configManager.writeConfig(projectPath, {
    projectId,
    dataPath: path.join(projectPath, '.prjct-data'),
  } as Parameters<typeof configManager.writeConfig>[1])
  await pathManager.ensureProjectStructure(projectId)

  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: projectPath })
  await execFileAsync('git', ['config', 'user.email', 't@example.com'], { cwd: projectPath })
  await execFileAsync('git', ['config', 'user.name', 'Tester'], { cwd: projectPath })
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: projectPath })
}

beforeEach(async () => {
  prjctDb.close()
})

afterEach(async () => {
  if (projectPath) {
    await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {})
  }
  prjctDb.close()
})

describe('UserPromptSubmit — project state', () => {
  it('returns null when there is no prjct config', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-prompt-noconfig-'))
    const r = await buildProjectState(dir)
    expect(r).toBeNull()
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  it('emits a state block with branch + working tree info on a fresh repo', async () => {
    await freshProject()
    const r = await buildProjectState(projectPath)
    expect(r).not.toBeNull()
    expect(r).toContain('# prjct: project state')
    expect(r).toMatch(/Branch: main — working tree (clean|\d+ untracked)/)
  })

  it('surfaces an active task when one exists', async () => {
    await freshProject()
    await stateStorage.startTask(projectId, {
      id: `t-${Date.now()}`,
      description: 'fix auth race condition',
      startedAt: new Date().toISOString(),
      sessionId: 's',
    } as Parameters<typeof stateStorage.startTask>[1])
    const r = await buildProjectState(projectPath)
    expect(r).toContain('Active task: "fix auth race condition"')
  })

  it('surfaces dirty working tree counts', async () => {
    await freshProject()
    await fs.writeFile(path.join(projectPath, 'a.txt'), 'hi')
    const r = await buildProjectState(projectPath)
    expect(r).toMatch(/working tree.*untracked/)
  })

  it('surfaces inbox count when entries exist', async () => {
    await freshProject()
    // Write inbox entries directly via the events table (memoryService.log
    // would require a project-id round-trip we already handled in the
    // freshProject() init).
    for (let i = 0; i < 3; i++) {
      prjctDb.appendEvent(projectId, 'memory.remember.inbox', {
        content: `note ${i}`,
        tags: {},
        provenance: 'declared',
      })
    }
    const r = await buildProjectState(projectPath)
    expect(r).toContain('Inbox: 3 items pending')
  })

  it('does not throw on an empty repo with no HEAD', async () => {
    await freshProject()
    // No commits yet — captureGit's `git rev-list @{u}..HEAD` will fail.
    const r = await buildProjectState(projectPath)
    expect(r).not.toBeNull()
    expect(r).toContain('# prjct: project state')
  })
})

describe('UserPromptSubmit — topical trap cue', () => {
  function seedMirror(id: string, type: string, content: string): void {
    const now = new Date().toISOString()
    prjctDb.run(
      projectId,
      `INSERT INTO memories
         (id, project_id, title, content, tags, type, provenance, user_triggered,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      projectId,
      content.slice(0, 80),
      content,
      '{}',
      type,
      'declared',
      0,
      now,
      now
    )
  }

  it('surfaces ONE gotcha when prompt keywords match', async () => {
    await freshProject()
    seedMirror('mem_1', 'gotcha', 'the daemon caches stale hook code until restarted')
    seedMirror('mem_2', 'gotcha', 'embeddings clear also wipes the keychain key')
    const cue = buildTopicalCue(projectId, 'why is the daemon serving stale responses?')
    expect(cue).not.toBeNull()
    expect(cue).toContain('Trap on this topic')
    expect(cue).toContain('mem_1')
    expect(cue).not.toContain('mem_2')
  })

  it('ignores non-preventive types even when they match', async () => {
    await freshProject()
    seedMirror('mem_3', 'decision', 'we chose a daemon architecture for warm starts')
    const cue = buildTopicalCue(projectId, 'tell me about the daemon architecture')
    expect(cue).toBeNull()
  })

  it('returns null when nothing matches', async () => {
    await freshProject()
    seedMirror('mem_4', 'gotcha', 'biome resolves zero files inside a git worktree')
    const cue = buildTopicalCue(projectId, 'completely unrelated cooking recipe question')
    expect(cue).toBeNull()
  })
})
