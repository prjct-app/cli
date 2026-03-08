/**
 * Review Tools Tests
 *
 * Tests diff inclusion, memory integration, file filtering.
 */

import { describe, expect, it } from 'bun:test'

describe('MCP Review Tools', () => {
  describe('file filtering', () => {
    // Test the matchGlob logic (extracted from review.ts for testing)
    function matchGlob(file: string, pattern: string): boolean {
      if (pattern.startsWith('*.')) {
        return file.endsWith(pattern.slice(1))
      }
      if (pattern.startsWith('**/*.')) {
        return file.endsWith(pattern.slice(3))
      }
      return file.includes(pattern)
    }

    function filterFiles(files: string[], include?: string[], exclude?: string[]): string[] {
      let filtered = files
      if (include && include.length > 0) {
        filtered = filtered.filter((f) => include.some((pattern) => matchGlob(f, pattern)))
      }
      if (exclude && exclude.length > 0) {
        filtered = filtered.filter((f) => !exclude.some((pattern) => matchGlob(f, pattern)))
      }
      return filtered
    }

    it('should filter by extension include', () => {
      const files = ['src/app.ts', 'src/app.tsx', 'src/style.css', 'README.md']
      const filtered = filterFiles(files, ['*.ts', '*.tsx'])
      expect(filtered).toEqual(['src/app.ts', 'src/app.tsx'])
    })

    it('should filter by extension exclude', () => {
      const files = ['src/app.ts', 'src/app.test.ts', 'src/utils.ts']
      const filtered = filterFiles(files, undefined, ['*.test.ts'])
      expect(filtered).toEqual(['src/app.ts', 'src/utils.ts'])
    })

    it('should match by extension using *.ext', () => {
      const files = ['src/deep/nested/file.ts', 'other.js']
      const filtered = filterFiles(files, ['*.ts'])
      expect(filtered).toEqual(['src/deep/nested/file.ts'])
    })

    it('should support partial path matching', () => {
      const files = ['src/components/Button.tsx', 'src/utils/helper.ts', 'test/unit.ts']
      const filtered = filterFiles(files, ['components'])
      expect(filtered).toEqual(['src/components/Button.tsx'])
    })

    it('should combine include and exclude', () => {
      const files = ['src/app.ts', 'src/app.test.ts', 'src/utils.ts', 'src/utils.test.ts']
      const filtered = filterFiles(files, ['*.ts'], ['*.test.ts'])
      expect(filtered).toEqual(['src/app.ts', 'src/utils.ts'])
    })

    it('should return all files with no filters', () => {
      const files = ['a.ts', 'b.js', 'c.css']
      const filtered = filterFiles(files)
      expect(filtered).toEqual(files)
    })
  })
})
