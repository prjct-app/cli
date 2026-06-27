/**
 * git:push arg selection — pins the worktree-safety contract:
 *   - Upstream tracking THIS branch  → bare `git push`.
 *   - No upstream                    → `push -u origin HEAD`.
 *   - Upstream tracking a DIFFERENT branch (e.g. origin/main inherited by a
 *     worktree branch) → `push -u origin HEAD`, NEVER a bare push that would
 *     land on main.
 */

import { describe, expect, it } from 'bun:test'
import { decideGitPushArgs } from '../../workflow-engine/workflow-engine'

describe('decideGitPushArgs', () => {
  it('bare-pushes when the upstream tracks the current branch', () => {
    expect(decideGitPushArgs('feature/x', 'origin/feature/x')).toEqual(['push'])
  })

  it('sets upstream when there is none', () => {
    expect(decideGitPushArgs('feature/x', '')).toEqual(['push', '-u', 'origin', 'HEAD'])
  })

  it('refuses a bare push when the inherited upstream points at main', () => {
    expect(decideGitPushArgs('claude/worktree-branch', 'origin/main')).toEqual([
      'push',
      '-u',
      'origin',
      'HEAD',
    ])
  })

  it('handles nested branch names in both branch and upstream', () => {
    expect(
      decideGitPushArgs('claude/stupefied-hodgkin', 'origin/claude/stupefied-hodgkin')
    ).toEqual(['push'])
  })

  it('falls back to set-upstream when the branch name is unknown', () => {
    expect(decideGitPushArgs('', 'origin/main')).toEqual(['push', '-u', 'origin', 'HEAD'])
  })
})
