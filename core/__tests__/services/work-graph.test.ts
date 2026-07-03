import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { workGraph } from '../../services/work-graph'
import { prjctDb } from '../../storage/database'
import { queueStorage } from '../../storage/queue-storage'

let tmpHome: string
let pid: string
let prevHome: string | undefined

async function addItem(desc: string, priority = 'medium'): Promise<string> {
  const t = await queueStorage.addTask(pid, {
    description: desc,
    section: 'active',
    type: 'feature',
    priority: priority as 'medium',
  })
  return t.id
}

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-test-'))
  prevHome = process.env.PRJCT_CLI_HOME
  process.env.PRJCT_CLI_HOME = tmpHome
  pid = 'wg-test-project'
  prjctDb.get(pid, 'SELECT 1') // force init + migrations
})

afterAll(() => {
  if (prevHome) process.env.PRJCT_CLI_HOME = prevHome
  else delete process.env.PRJCT_CLI_HOME
  fs.rmSync(tmpHome, { recursive: true, force: true })
})

describe('work graph — frontier, claims, phases', () => {
  it('ready excludes items with open blockers and surfaces them when unblocked', async () => {
    const a = await addItem('build the schema')
    const b = await addItem('build the API on top of the schema')
    workGraph.addDependency(pid, b, a, 'blocks')

    let ready = workGraph.ready(pid).map((i) => i.id)
    expect(ready).toContain(a)
    expect(ready).not.toContain(b)

    await queueStorage.completeTask(pid, a)
    ready = workGraph.ready(pid).map((i) => i.id)
    expect(ready).toContain(b)
  })

  it('rejects blocking cycles but allows informational edges', async () => {
    const x = await addItem('x')
    const y = await addItem('y')
    workGraph.addDependency(pid, x, y, 'blocks')
    expect(() => workGraph.addDependency(pid, y, x, 'blocks')).toThrow(/cycle/)
    // related never gates → no cycle check needed
    workGraph.addDependency(pid, y, x, 'related')
    expect(workGraph.dependenciesOf(pid, y).some((d) => d.depType === 'related')).toBe(true)
  })

  it('claim is race-free: second claimant loses', async () => {
    const c = await addItem('contested item')
    expect(workGraph.claim(pid, c, 'agent-1')).toBe(true)
    expect(workGraph.claim(pid, c, 'agent-2')).toBe(false)
    workGraph.release(pid, c)
    expect(workGraph.claim(pid, c, 'agent-2')).toBe(true)
  })

  it('phases: same level = parallelizable, dependent items land later', async () => {
    const p1a = await addItem('phase1 a')
    const p1b = await addItem('phase1 b')
    const p2 = await addItem('phase2 depends on both')
    workGraph.addDependency(pid, p2, p1a, 'blocks')
    workGraph.addDependency(pid, p2, p1b, 'blocks')

    const plan = workGraph.phases(pid)
    const phaseOf = (id: string) => plan.find((p) => p.items.some((i) => i.id === id))?.phase
    expect(phaseOf(p1a)).toBe(1)
    expect(phaseOf(p1b)).toBe(1)
    expect(phaseOf(p2)).toBe(2)
  })

  it('complexity record round-trips', () => {
    workGraph.recordComplexity(pid, 'task-z', {
      score: 8,
      recommendedSubtasks: 4,
      expansionPrompt: 'break it down',
    })
    const rec = workGraph.getComplexity(pid, 'task-z')
    expect(rec?.score).toBe(8)
    expect(rec?.recommendedSubtasks).toBe(4)
  })
})
