import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveCallerIdentity, sameOwner } from '../../services/agent-identity'
import { acceptAgentHandoff, switchAgent } from '../../services/agent-switch'
import { shouldIsolate, worktreeSlugFromIntent } from '../../services/workspace-occupancy'
import { prjctDb } from '../../storage/database'
import {
  acceptHandoff,
  createHandoff,
  getHandoff,
  listHandoffs,
  listPendingForAgent,
} from '../../storage/handoff-storage'
import { stateStorage } from '../../storage/state-storage'

let tmpHome: string
let pid: string
let prevHome: string | undefined
let prevRuntime: string | undefined
let prevAgent: string | undefined

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-test-'))
  prevHome = process.env.PRJCT_CLI_HOME
  process.env.PRJCT_CLI_HOME = tmpHome
  pid = 'handoff-test-project'
  prjctDb.get(pid, 'SELECT 1')
})

afterAll(() => {
  if (prevHome) process.env.PRJCT_CLI_HOME = prevHome
  else delete process.env.PRJCT_CLI_HOME
  fs.rmSync(tmpHome, { recursive: true, force: true })
})

beforeEach(() => {
  prevRuntime = process.env.PRJCT_AGENT_RUNTIME
  prevAgent = process.env.PRJCT_AGENT
  process.env.PRJCT_AGENT_RUNTIME = 'claude'
  process.env.PRJCT_AGENT = 'Popper'
  // Reset live state between tests
  void stateStorage.updateCurrentTask(pid, {}).catch(() => {})
})

afterAll(() => {
  if (prevRuntime === undefined) delete process.env.PRJCT_AGENT_RUNTIME
  else process.env.PRJCT_AGENT_RUNTIME = prevRuntime
  if (prevAgent === undefined) delete process.env.PRJCT_AGENT
  else process.env.PRJCT_AGENT = prevAgent
})

describe('agent-identity', () => {
  it('resolves runtime + PRJCT_AGENT identity', () => {
    process.env.PRJCT_AGENT_RUNTIME = 'codex'
    process.env.PRJCT_AGENT = 'Copernicus'
    const id = resolveCallerIdentity('seed')
    expect(id.agent).toBe('codex')
    expect(id.identity).toBe('Copernicus')
  })

  it('sameOwner matches identity, not just runtime', () => {
    const me = { agent: 'claude', identity: 'Popper' }
    expect(sameOwner({ ownerAgent: 'claude', ownerIdentity: 'Popper' }, me)).toBe(true)
    expect(sameOwner({ ownerAgent: 'claude', ownerIdentity: 'Ada' }, me)).toBe(false)
  })
})

describe('handoff storage', () => {
  it('create → accept is race-free for second claim', () => {
    const h = createHandoff({
      projectId: pid,
      taskId: 'task-1',
      taskDescription: 'fix auth',
      fromAgent: 'claude',
      fromIdentity: 'Popper',
      toAgent: 'codex',
      reason: 'Looping on refresh tokens',
      evidence: { turns: 12, files: ['a.ts'] },
    })
    expect(h.id.startsWith('hand_')).toBe(true)
    expect(listPendingForAgent(pid, 'codex').some((x) => x.id === h.id)).toBe(true)

    const won = acceptHandoff(pid, h.id, 'codex/Copernicus')
    expect(won?.status).toBe('accepted')
    expect(won?.acceptedBy).toBe('codex/Copernicus')

    const lost = acceptHandoff(pid, h.id, 'codex/Other')
    expect(lost).toBeNull()
    expect(getHandoff(pid, h.id)?.status).toBe('accepted')
  })

  it('lists handoffs filtered by target agent', () => {
    createHandoff({
      projectId: pid,
      taskId: 't-a',
      taskDescription: 'a',
      fromAgent: 'claude',
      toAgent: 'grok',
      reason: 'first-list',
    })
    createHandoff({
      projectId: pid,
      taskId: 't-b',
      taskDescription: 'b',
      fromAgent: 'claude',
      toAgent: 'grok',
      reason: 'second-list',
    })
    const rows = listHandoffs(pid, { toAgent: 'grok', limit: 10 })
    const reasons = rows.map((r) => r.reason)
    expect(reasons).toContain('first-list')
    expect(reasons).toContain('second-list')
  })
})

describe('workspace occupancy pure decisions', () => {
  it('slugifies intents', () => {
    expect(worktreeSlugFromIntent('Fix Auth Race!!')).toBe('fix-auth-race')
  })

  it('isolates when foreign occupant on main in auto mode', () => {
    const decision = shouldIsolate(
      {
        workspaceId: 'main',
        isMain: true,
        occupied: true,
        occupiedByMe: false,
        current: {
          taskId: 'task_abc',
          description: 'other work',
          ownerAgent: 'claude',
          ownerIdentity: 'Popper',
          startedAt: new Date().toISOString(),
          workspaceId: 'main',
        },
        others: [],
      },
      'auto',
      'my new feature'
    )
    expect(decision.isolate).toBe(true)
    expect(decision.block).toBeUndefined()
  })

  it('blocks in ask mode instead of isolating', () => {
    const decision = shouldIsolate(
      {
        workspaceId: 'main',
        isMain: true,
        occupied: true,
        occupiedByMe: false,
        current: {
          taskId: 'task_abc',
          description: 'other work',
          ownerAgent: 'claude',
          startedAt: new Date().toISOString(),
          workspaceId: 'main',
        },
        others: [],
      },
      'ask',
      'my new feature'
    )
    expect(decision.isolate).toBe(false)
    expect(decision.block).toBe(true)
  })

  it('does not isolate when free or mine', () => {
    expect(
      shouldIsolate(
        {
          workspaceId: 'main',
          isMain: true,
          occupied: false,
          occupiedByMe: false,
          current: null,
          others: [],
        },
        'auto',
        'x'
      ).isolate
    ).toBe(false)
    expect(
      shouldIsolate(
        {
          workspaceId: 'main',
          isMain: true,
          occupied: true,
          occupiedByMe: true,
          current: {
            taskId: 't',
            description: 'mine',
            startedAt: new Date().toISOString(),
            workspaceId: 'main',
          },
          others: [],
        },
        'auto',
        'x'
      ).isolate
    ).toBe(false)
  })
})

describe('switch + accept service', () => {
  it('yields active cycle and accept rebinds owner', async () => {
    process.env.PRJCT_AGENT_RUNTIME = 'claude'
    process.env.PRJCT_AGENT = 'Popper'
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-cwd-'))
    // startTask needs a project path; state-only path is enough for resolveActiveTask via main
    await stateStorage.startTask(pid, {
      id: 'task_switch_1',
      description: 'fix handoff flow',
      sessionId: 'sess_1',
      ownerAgent: 'claude',
      ownerIdentity: 'Popper',
      yieldStatus: 'active',
    })

    const sw = await switchAgent(pid, tmp, 'codex', {
      reason: 'Looping on edge cases after many turns',
    })
    expect(sw.ok).toBe(true)
    expect(sw.handoff?.toAgent).toBe('codex')
    expect(sw.handoff?.reason).toContain('Looping')
    expect(sw.resumeCard).toContain('prjct accept')

    const afterYield = await stateStorage.getCurrentTask(pid)
    expect(afterYield?.yieldStatus).toBe('yielded')
    expect(afterYield?.pendingHandoffId).toBe(sw.handoff!.id)

    process.env.PRJCT_AGENT_RUNTIME = 'codex'
    process.env.PRJCT_AGENT = 'Copernicus'
    const ac = await acceptAgentHandoff(pid, tmp, sw.handoff!.id)
    expect(ac.ok).toBe(true)
    expect(ac.brief).toContain('fix handoff flow')
    expect(ac.brief).toContain('Looping')

    const afterAccept = await stateStorage.getCurrentTask(pid)
    expect(afterAccept?.ownerAgent).toBe('codex')
    expect(afterAccept?.ownerIdentity).toBe('Copernicus')
    expect(afterAccept?.yieldStatus).toBe('active')
    expect(afterAccept?.pendingHandoffId).toBeUndefined()

    // Second accept fails
    const again = await acceptAgentHandoff(pid, tmp, sw.handoff!.id)
    expect(again.ok).toBe(false)

    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('switch without active cycle fails clearly', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-empty-'))
    // complete any active
    await stateStorage.completeTask(pid).catch(() => null)
    const sw = await switchAgent(pid, tmp, 'codex', { reason: 'nope' })
    expect(sw.ok).toBe(false)
    expect(sw.error).toMatch(/No active work cycle/)
    fs.rmSync(tmp, { recursive: true, force: true })
  })
})
