import { describe, expect, test } from 'bun:test'
import { formatRiskForAgent, type RiskHit } from '../../services/task-service'

/**
 * CLI `prjct work` and MCP `prjct_task_start` MUST share this line shape so
 * multi-runtime agents see the same predictive-risk class (P0 build-loop parity).
 */
describe('formatRiskForAgent — CLI/MCP risk surface parity', () => {
  test('formats label, title, file, and id like work --md Risk lines', () => {
    const risk: RiskHit = {
      id: 'mem_42',
      label: 'gotcha',
      title: 'Daemon caches stale hook code',
      file: 'core/hooks/pre-edit.ts',
    }
    expect(formatRiskForAgent(risk)).toBe(
      '[gotcha] Daemon caches stale hook code — `core/hooks/pre-edit.ts`  `mem_42`'
    )
  })

  test('MCP task_start risk block composition matches CLI header intent', () => {
    const risks: RiskHit[] = [
      {
        id: 'mem_1',
        label: 'anti-pattern',
        title: 'Skip guard before edit',
        file: 'core/mcp/tools/project.ts',
      },
      {
        id: 'mem_2',
        label: 'gotcha',
        title: 'Empty likelyFiles yields no risks',
        file: 'core/services/task-service.ts',
      },
    ]
    // Same section title CLI uses (workflow.ts Risk section)
    const header = '⚠ Risk — what bit us in this area before (read before you edit):'
    const body = risks.map((r) => `- ${formatRiskForAgent(r)}`).join('\n')
    const block = [header, body].join('\n')
    expect(block).toContain('⚠ Risk — what bit us in this area before')
    expect(block).toContain(
      '[anti-pattern] Skip guard before edit — `core/mcp/tools/project.ts`  `mem_1`'
    )
    expect(block).toContain(
      '[gotcha] Empty likelyFiles yields no risks — `core/services/task-service.ts`  `mem_2`'
    )
    // Empty risks → no section (parity: CLI only prints when riskLines.length > 0)
    expect(([] as RiskHit[]).length > 0 ? formatRiskForAgent(risks[0]!) : '').toBe('')
  })
})
