import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { extractRepoRelativePaths, inferMemoryFileTag } from '../../memory/infer-memory-file'

describe('extractRepoRelativePaths', () => {
  test('pulls backtick and plain repo-relative paths', () => {
    const text = 'Bug in `src/lib/api.ts` and also core/hooks/pre-edit.ts — not http://x.com/a.ts'
    const paths = extractRepoRelativePaths(text)
    expect(paths).toContain('src/lib/api.ts')
    expect(paths).toContain('core/hooks/pre-edit.ts')
    expect(paths.some((p) => p.includes('http'))).toBe(false)
  })

  test('ignores bare basenames without a directory', () => {
    expect(extractRepoRelativePaths('see index.ts only')).toEqual([])
  })

  test('ignores node_modules and dist', () => {
    expect(extractRepoRelativePaths('broken in node_modules/foo/bar.ts and dist/out.js')).toEqual(
      []
    )
  })
})

describe('inferMemoryFileTag', () => {
  test('explicit tags.file wins', () => {
    expect(
      inferMemoryFileTag({
        content: 'mentions src/other.ts',
        tags: { file: 'src/explicit.ts' },
      })
    ).toBe('src/explicit.ts')
  })

  test('uses first path from tags.files when file absent', () => {
    expect(
      inferMemoryFileTag({
        content: 'no path here',
        tags: { files: 'src/a.ts,src/b.ts' },
      })
    ).toBe('src/a.ts')
  })

  test('infers from content path when no tags', () => {
    expect(
      inferMemoryFileTag({
        content:
          'TanStack autoCodeSplitting: only uppercase COMPONENT exports block route code-splitting. See src/routes/-route-code-splitting.test.ts for the control case.',
      })
    ).toBe('src/routes/-route-code-splitting.test.ts')
  })

  test('prefers path that exists on disk under projectPath', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prjct-infer-file-'))
    try {
      fs.mkdirSync(path.join(root, 'src', 'lib'), { recursive: true })
      fs.writeFileSync(path.join(root, 'src', 'lib', 'api.ts'), 'export {}')
      const hit = inferMemoryFileTag({
        content: 'touch src/lib/api.ts and also src/lib/missing.ts',
        projectPath: root,
      })
      expect(hit).toBe('src/lib/api.ts')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('promotes cycle file when basename appears in content', () => {
    expect(
      inferMemoryFileTag({
        content: 'MutationCache double toast in api.ts — set meta.skipGlobalError',
        cycleFiles: ['src/lib/api.ts', 'src/routes/other.tsx'],
      })
    ).toBe('src/lib/api.ts')
  })

  test('returns null when nothing confident', () => {
    expect(
      inferMemoryFileTag({
        content: 'we decided to use advisory mode for conflicts',
      })
    ).toBeNull()
  })

  test('strips absolute path to strong-prefix suffix', () => {
    expect(
      inferMemoryFileTag({
        content: 'edit /Users/jj/Apps/prjct/prjct-cli-app/src/lib/api.ts carefully',
      })
    ).toBe('src/lib/api.ts')
  })
})
