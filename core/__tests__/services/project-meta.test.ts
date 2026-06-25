import { describe, expect, it } from 'bun:test'
import { parseRemote } from '../../services/sync/project-meta'

describe('parseRemote', () => {
  it('parses scp-like github remotes', () => {
    expect(parseRemote('git@github.com:jlopezlira/prjct-cli-app.git')).toEqual({
      provider: 'github',
      repoSlug: 'jlopezlira/prjct-cli-app',
    })
  })

  it('parses https remotes and strips the .git suffix', () => {
    expect(parseRemote('https://github.com/jlopezlira/prjct-cli-app.git')).toEqual({
      provider: 'github',
      repoSlug: 'jlopezlira/prjct-cli-app',
    })
  })

  it('drops embedded credentials from https remotes', () => {
    const { provider, repoSlug } = parseRemote(
      'https://user:ghp_secrettoken@github.com/org/repo.git'
    )
    expect(provider).toBe('github')
    expect(repoSlug).toBe('org/repo')
    // The token must never leak into the slug.
    expect(JSON.stringify({ provider, repoSlug })).not.toContain('ghp_secrettoken')
  })

  it('keeps gitlab subgroups in the slug', () => {
    expect(parseRemote('git@gitlab.com:group/subgroup/repo.git')).toEqual({
      provider: 'gitlab',
      repoSlug: 'group/subgroup/repo',
    })
  })

  it('maps unknown hosts to "other"', () => {
    expect(parseRemote('git@git.example.org:team/app.git')).toEqual({
      provider: 'other',
      repoSlug: 'team/app',
    })
  })

  it('returns empty for blank or unparseable input', () => {
    expect(parseRemote('')).toEqual({})
    expect(parseRemote('not a url')).toEqual({})
  })
})
