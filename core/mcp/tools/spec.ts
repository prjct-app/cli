/**
 * MCP Spec tools — exposes the SDD primitive to the desktop Claude app
 * (and any other MCP client).
 *
 * Mirrors `prjct spec` CLI: create, list, get, update, set-status,
 * record-review, link-task, ship, audit. The `audit` tool returns the
 * dispatch prompt; the host model runs the three review subagents in
 * parallel via its own tool-use mechanism (Agent / Task tool, etc.) and
 * writes verdicts back via `prjct_spec_record_review`.
 *
 * Tool descriptions intentionally lead with WHEN the host should call
 * them (intent recognition) so a fresh Claude session in the desktop
 * app routes feature/spec talk to the right tool.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { specService } from '../../services/spec-service'
import { specStorage } from '../../storage/spec-storage'
import {
  SPEC_REVIEWERS,
  SPEC_STATUSES,
  type SpecContent,
  SpecContentSchema,
  type SpecReviewer,
  type SpecStatus,
} from '../../types/spec'
import { resolveProjectId } from '../resolve'
import { safeMcpCall } from './error-handler'

// MCP SDK TS2589 workaround: cast server to any to avoid deep type
// instantiation during tool registration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any

export function registerSpecTools(server: McpServer) {
  const s: S = server

  s.tool(
    'prjct_spec_create',
    'CALL THIS when the user describes a feature, fix, or initiative WITH goals or stakes attached (e.g. "we need rate limiting on auth", "fix onboarding", "let\'s build SDD"). Drafts a spec — Goal/ELI10/Stakes/Acceptance criteria/Scope/Out-of-scope/Risks/Test plan. The structured fields default to empty; populate them by calling `prjct_spec_update` once you have the answers. Skip this tool only for routine work (single-file fix, doc tweak, GTD capture) — for that, use `prjct_capture` or the matching memory tool.',
    {
      projectPath: z.string().describe('Project directory path'),
      title: z.string().describe("One-line title (what you'd say to a coworker walking by)"),
      goal: z.string().describe('What success looks like, 1-3 sentences. Concrete, observable.'),
      eli10: z.string().optional().describe('Plain English a 16-year-old follows, 2-4 sentences'),
      stakes: z.string().optional().describe('What breaks if we ship the wrong thing'),
      acceptance_criteria: z
        .array(z.string())
        .optional()
        .describe('Testable, observable list. Each item ends in a verifiable claim.'),
      scope: z.array(z.string()).optional().describe("What's IN — file paths, modules, surfaces"),
      out_of_scope: z.array(z.string()).optional().describe("What's OUT — anti-creep shield"),
      risks: z
        .array(z.object({ risk: z.string(), mitigation: z.string() }))
        .optional()
        .describe('Each risk has a mitigation; a risk without one is just a complaint'),
      test_plan: z.array(z.string()).optional().describe('How you prove acceptance criteria'),
      tags: z
        .record(z.string(), z.string())
        .optional()
        .describe('Key:value tags (e.g. {domain: "auth", priority: "high"})'),
    },
    safeMcpCall(
      'prjct_spec_create',
      async (args: {
        projectPath: string
        title: string
        goal: string
        eli10?: string
        stakes?: string
        acceptance_criteria?: string[]
        scope?: string[]
        out_of_scope?: string[]
        risks?: { risk: string; mitigation: string }[]
        test_plan?: string[]
        tags?: Record<string, string>
      }) => {
        const spec = await specService.create(args.projectPath, {
          title: args.title,
          content: {
            goal: args.goal,
            eli10: args.eli10,
            stakes: args.stakes,
            acceptance_criteria: args.acceptance_criteria,
            scope: args.scope,
            out_of_scope: args.out_of_scope,
            risks: args.risks,
            test_plan: args.test_plan,
          },
          tags: args.tags,
        })

        const summary = [
          `✓ spec drafted: ${spec.title}`,
          ``,
          `id: ${spec.id}`,
          `status: ${spec.status}`,
          `goal: ${spec.content.goal}`,
          ``,
          `Next: \`prjct_spec_audit\` to dispatch the three review subagents (strategic / architecture / design) in parallel.`,
        ].join('\n')
        return { content: [{ type: 'text', text: summary }] }
      }
    )
  )

  s.tool(
    'prjct_spec_list',
    'List specs in this project. Use to check what specs exist before drafting a new one (avoid duplicates) or to find the right spec to link a task to.',
    {
      projectPath: z.string().describe('Project directory path'),
      status: z
        .enum(SPEC_STATUSES)
        .optional()
        .describe('Filter by status: draft|reviewed|in_progress|shipped|archived'),
      includeArchived: z.boolean().optional().describe('Include archived specs (default: false)'),
    },
    safeMcpCall(
      'prjct_spec_list',
      async (args: { projectPath: string; status?: SpecStatus; includeArchived?: boolean }) => {
        const projectId = await resolveProjectId(args.projectPath)
        const specs = specStorage.list(projectId, {
          status: args.status,
          includeArchived: args.includeArchived,
        })
        if (specs.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '_No specs match. Start one with `prjct_spec_create`._',
              },
            ],
          }
        }
        const parts = ['# Specs', '']
        for (const sp of specs) {
          const ac = sp.content.acceptance_criteria.length
          const tasks = sp.content.linked_tasks.length
          parts.push(
            `## ${sp.title}\n- id: \`${sp.id}\`\n- status: ${sp.status}\n- acceptance criteria: ${ac}\n- linked tasks: ${tasks}\n- created: ${sp.createdAt}`
          )
          parts.push('')
        }
        return { content: [{ type: 'text', text: parts.join('\n') }] }
      }
    )
  )

  s.tool(
    'prjct_spec_get',
    'Fetch one spec by id, including all structured fields (goal, acceptance criteria, scope, risks, reviews, linked tasks).',
    {
      projectPath: z.string().describe('Project directory path'),
      id: z.string().describe('Spec id'),
    },
    safeMcpCall('prjct_spec_get', async (args: { projectPath: string; id: string }) => {
      const spec = await specService.get(args.projectPath, args.id)
      if (!spec) {
        return { content: [{ type: 'text', text: `_Spec not found: ${args.id}_` }] }
      }
      return {
        content: [{ type: 'text', text: renderSpecMarkdown(spec) }],
      }
    })
  )

  s.tool(
    'prjct_spec_update',
    "Replace a spec's structured content. Pass the FULL content object (this is a replace, not a merge) — when filling in acceptance_criteria for the first time, fetch with `prjct_spec_get` first and merge in your changes.",
    {
      projectPath: z.string().describe('Project directory path'),
      id: z.string().describe('Spec id'),
      content: z
        .object({
          goal: z.string(),
          eli10: z.string().optional(),
          stakes: z.string().optional(),
          acceptance_criteria: z.array(z.string()).optional(),
          scope: z.array(z.string()).optional(),
          out_of_scope: z.array(z.string()).optional(),
          risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })).optional(),
          test_plan: z.array(z.string()).optional(),
          notes: z.string().optional(),
          linked_tasks: z.array(z.string()).optional(),
        })
        .describe('Full SpecContent shape — Zod-validated server-side'),
    },
    safeMcpCall(
      'prjct_spec_update',
      async (args: {
        projectPath: string
        id: string
        content: Partial<SpecContent> & { goal: string }
      }) => {
        const validated = SpecContentSchema.parse(args.content)
        const updated = await specService.update(
          args.projectPath,
          args.id,
          validated as SpecContent
        )
        if (!updated) {
          return { content: [{ type: 'text', text: `_Spec not found: ${args.id}_` }] }
        }
        return {
          content: [{ type: 'text', text: `✓ spec updated: ${updated.title}` }],
        }
      }
    )
  )

  s.tool(
    'prjct_spec_set_status',
    'Promote / demote a spec lifecycle state. Reviewers passing is auto-promoting (draft → reviewed); use this tool to mark a spec `in_progress` when work starts, `archived` when superseded, or `shipped` (use `prjct_spec_ship` instead when shipping for the first time, since it also records the PR).',
    {
      projectPath: z.string().describe('Project directory path'),
      id: z.string().describe('Spec id'),
      status: z.enum(SPEC_STATUSES).describe('Target status'),
    },
    safeMcpCall(
      'prjct_spec_set_status',
      async (args: { projectPath: string; id: string; status: SpecStatus }) => {
        const next = await specService.setStatus(args.projectPath, args.id, args.status)
        if (!next) {
          return { content: [{ type: 'text', text: `_Spec not found: ${args.id}_` }] }
        }
        return {
          content: [{ type: 'text', text: `✓ spec ${args.id} → ${args.status}` }],
        }
      }
    )
  )

  s.tool(
    'prjct_spec_audit',
    'CALL THIS before any implementation work begins on a spec. Returns a dispatch prompt for THREE review subagents (strategic / architecture / design). RUN ALL THREE IN PARALLEL via your Agent / Task tool — one tool-use block per reviewer in the SAME message. Each returns a verdict (pass | fail) + notes. Persist each via `prjct_spec_record_review`. All three pass → the spec auto-promotes draft → reviewed and is safe to start a task against.',
    {
      projectPath: z.string().describe('Project directory path'),
      id: z.string().describe('Spec id to audit'),
    },
    safeMcpCall('prjct_spec_audit', async (args: { projectPath: string; id: string }) => {
      const spec = await specService.get(args.projectPath, args.id)
      if (!spec) {
        return { content: [{ type: 'text', text: `_Spec not found: ${args.id}_` }] }
      }
      return {
        content: [{ type: 'text', text: renderAuditDispatch(spec.id, spec.title, spec.content) }],
      }
    })
  )

  s.tool(
    'prjct_spec_record_review',
    "Persist one reviewer's verdict from `prjct_spec_audit` dispatch. Call once per reviewer (strategic, architecture, design). When all three are recorded with verdict=pass, the spec auto-promotes draft → reviewed.",
    {
      projectPath: z.string().describe('Project directory path'),
      id: z.string().describe('Spec id'),
      reviewer: z.enum(SPEC_REVIEWERS).describe('Which reviewer'),
      verdict: z.enum(['pass', 'fail']).describe('Verdict'),
      notes: z.string().describe('2-4 sentence notes from the subagent'),
    },
    safeMcpCall(
      'prjct_spec_record_review',
      async (args: {
        projectPath: string
        id: string
        reviewer: SpecReviewer
        verdict: 'pass' | 'fail'
        notes: string
      }) => {
        const updated = await specService.recordReview(args.projectPath, args.id, args.reviewer, {
          verdict: args.verdict,
          notes: args.notes,
        })
        if (!updated) {
          return { content: [{ type: 'text', text: `_Spec not found: ${args.id}_` }] }
        }
        const promoted =
          updated.status === 'reviewed' ? ' (all reviewers passed → status: reviewed)' : ''
        return {
          content: [{ type: 'text', text: `✓ ${args.reviewer} → ${args.verdict}${promoted}` }],
        }
      }
    )
  )

  s.tool(
    'prjct_spec_link_task',
    'Link a task to its spec. Call this AFTER starting the task (when the user begins implementation) so `prjct_ship` later knows which spec to gate against. Idempotent — re-linking the same task is a no-op.',
    {
      projectPath: z.string().describe('Project directory path'),
      specId: z.string().describe('Spec id'),
      taskId: z.string().describe('Task id (from `prjct_session_start_task` or stateStorage)'),
    },
    safeMcpCall(
      'prjct_spec_link_task',
      async (args: { projectPath: string; specId: string; taskId: string }) => {
        const updated = await specService.linkTask(args.projectPath, args.specId, args.taskId)
        if (!updated) {
          return { content: [{ type: 'text', text: `_Spec not found: ${args.specId}_` }] }
        }
        return {
          content: [{ type: 'text', text: `✓ linked task ${args.taskId} to spec ${args.specId}` }],
        }
      }
    )
  )

  s.tool(
    'prjct_spec_ship',
    'Mark a spec as shipped (after the linked PR merges). Records the PR number on the spec for provenance.',
    {
      projectPath: z.string().describe('Project directory path'),
      id: z.string().describe('Spec id'),
      pr: z.number().optional().describe('PR / MR number that delivered the spec'),
    },
    safeMcpCall(
      'prjct_spec_ship',
      async (args: { projectPath: string; id: string; pr?: number }) => {
        const next = await specService.ship(args.projectPath, args.id, args.pr)
        if (!next) {
          return { content: [{ type: 'text', text: `_Spec not found: ${args.id}_` }] }
        }
        return {
          content: [
            {
              type: 'text',
              text: `✓ spec shipped: ${next.title}${args.pr ? ` (PR #${args.pr})` : ''}`,
            },
          ],
        }
      }
    )
  )
}

function renderSpecMarkdown(spec: {
  id: string
  title: string
  status: string
  content: SpecContent
  createdAt: string
  updatedAt: string
}): string {
  const c = spec.content
  const lines = [
    `# ${spec.title}`,
    '',
    `**id:** \`${spec.id}\` · **status:** ${spec.status} · **created:** ${spec.createdAt}`,
    '',
    '## Goal',
    c.goal,
  ]
  if (c.eli10) lines.push('', '## ELI10', c.eli10)
  if (c.stakes) lines.push('', '## Stakes', c.stakes)
  if (c.acceptance_criteria.length > 0) {
    lines.push('', '## Acceptance criteria')
    for (const ac of c.acceptance_criteria) lines.push(`- [ ] ${ac}`)
  }
  if (c.scope.length > 0) {
    lines.push('', '## Scope')
    for (const s of c.scope) lines.push(`- ${s}`)
  }
  if (c.out_of_scope.length > 0) {
    lines.push('', '## Out of scope')
    for (const s of c.out_of_scope) lines.push(`- ${s}`)
  }
  if (c.risks.length > 0) {
    lines.push('', '## Risks')
    for (const r of c.risks) lines.push(`- **${r.risk}** — ${r.mitigation}`)
  }
  if (c.test_plan.length > 0) {
    lines.push('', '## Test plan')
    for (const t of c.test_plan) lines.push(`- ${t}`)
  }
  if (c.reviews) {
    lines.push('', '## Reviews')
    for (const reviewer of SPEC_REVIEWERS) {
      const r = c.reviews[reviewer]
      if (r) lines.push(`- **${reviewer}:** ${r.verdict} — ${r.notes} _(${r.ts})_`)
    }
  }
  if (c.linked_tasks.length > 0) {
    lines.push('', '## Linked tasks', ...c.linked_tasks.map((t) => `- ${t}`))
  }
  if (c.notes) lines.push('', '## Notes', c.notes)
  return lines.join('\n')
}

function renderAuditDispatch(id: string, title: string, content: SpecContent): string {
  const summary = JSON.stringify(content)
  return [
    `# audit-spec dispatch — ${title}`,
    '',
    `Spec id: \`${id}\``,
    '',
    'Run three review subagents IN PARALLEL via your Agent / Task tool — one tool-use block per reviewer, all in the SAME message so they run concurrently. Each subagent reads the spec body and applies its rubric, then returns a structured verdict (pass | fail + 2-4 sentence notes).',
    '',
    '## Reviewer A — strategic (scope sanity)',
    'Subagent prompt: "Review this spec for strategic soundness. Does it solve a real problem? Is the goal worth the cost? Is out_of_scope coherent with goal? Is the spec OVER- or UNDER-scoped? Return verdict (pass|fail) and 2-4 sentence notes."',
    '',
    '## Reviewer B — architecture (eng feasibility)',
    'Subagent prompt: "Review this spec for engineering feasibility. Can this be built? Is the data flow / state machine implicit in the acceptance criteria coherent? What failure modes / dependencies / edge cases are missing? Include a short ASCII diagram of the proposed architecture in notes if applicable. Return verdict (pass|fail) and 2-4 sentence notes."',
    '',
    '## Reviewer C — design (UX/DX)',
    'Subagent prompt: "Review this spec for design quality. Rate 0-10 across {clarity, ergonomics, consistency, accessibility} for the user-facing or developer-facing surface this spec defines. Note the lowest-scoring dimension and why. Return verdict (pass if all dimensions ≥6, fail otherwise) and notes including the four scores."',
    '',
    '## Spec body (verbatim, pass to each reviewer)',
    '```json',
    summary,
    '```',
    '',
    '## After dispatch',
    'For each reviewer that returns:',
    `  Call \`prjct_spec_record_review\` with id="${id}", reviewer=<strategic|architecture|design>, verdict=<pass|fail>, notes="<their notes>"`,
    '',
    'When all three are recorded with verdict=pass, the spec auto-promotes from `draft` → `reviewed`.',
  ].join('\n')
}
