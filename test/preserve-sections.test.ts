/**
 * Tests for preserve-sections utility
 */

import { describe, it, expect } from 'bun:test'
import {
  extractPreservedSections,
  mergePreservedSections,
  hasPreservedSections,
  validatePreservedSections,
} from '../core/utils/preserve-sections'

describe('extractPreservedSections', () => {
  it('extracts single preserved section', () => {
    const content = `# Header
Some content

<!-- prjct:preserve -->
## My Custom Rules
- Rule 1
- Rule 2
<!-- prjct:end-preserve -->

More content`

    const sections = extractPreservedSections(content)

    expect(sections).toHaveLength(1)
    expect(sections[0].content).toContain('My Custom Rules')
    expect(sections[0].content).toContain('Rule 1')
    expect(sections[0].content).toStartWith('<!-- prjct:preserve -->')
    expect(sections[0].content).toEndWith('<!-- prjct:end-preserve -->')
  })

  it('extracts multiple preserved sections', () => {
    const content = `# Header

<!-- prjct:preserve -->
Section 1
<!-- prjct:end-preserve -->

Middle content

<!-- prjct:preserve -->
Section 2
<!-- prjct:end-preserve -->

Footer`

    const sections = extractPreservedSections(content)

    expect(sections).toHaveLength(2)
    expect(sections[0].content).toContain('Section 1')
    expect(sections[1].content).toContain('Section 2')
  })

  it('returns empty array when no preserved sections', () => {
    const content = '# Just normal content\n\nNo preserved sections here.'

    const sections = extractPreservedSections(content)

    expect(sections).toHaveLength(0)
  })

  it('handles unclosed preserve section', () => {
    const content = `# Header

<!-- prjct:preserve -->
This section is never closed
Content continues...`

    const sections = extractPreservedSections(content)

    expect(sections).toHaveLength(1)
    expect(sections[0].content).toContain('This section is never closed')
  })
})

describe('mergePreservedSections', () => {
  it('appends preserved sections to new content', () => {
    const newContent = '# New Generated Content\n\nSome generated stuff.'
    const preserved = [
      {
        content: `<!-- prjct:preserve -->
## My Rules
- Rule 1
<!-- prjct:end-preserve -->`,
        startIndex: 0,
        endIndex: 100,
      },
    ]

    const result = mergePreservedSections(newContent, preserved)

    expect(result).toContain('# New Generated Content')
    expect(result).toContain('My Rules')
    expect(result).toContain('User Customizations')
  })

  it('returns original content when no preserved sections', () => {
    const newContent = '# New Content'
    const preserved: { content: string; startIndex: number; endIndex: number }[] = []

    const result = mergePreservedSections(newContent, preserved)

    expect(result).toBe('# New Content')
  })

  it('does not duplicate if new content already has preserved sections', () => {
    const newContent = `# New Content

<!-- prjct:preserve -->
Already has preserved
<!-- prjct:end-preserve -->`
    const preserved = [
      {
        content: `<!-- prjct:preserve -->
Old preserved
<!-- prjct:end-preserve -->`,
        startIndex: 0,
        endIndex: 100,
      },
    ]

    const result = mergePreservedSections(newContent, preserved)

    // Should not duplicate
    expect(result).toBe(newContent)
  })
})

describe('hasPreservedSections', () => {
  it('returns true when content has preserved sections', () => {
    const content = 'Some text <!-- prjct:preserve --> stuff'
    expect(hasPreservedSections(content)).toBe(true)
  })

  it('returns false when content has no preserved sections', () => {
    const content = 'Just normal content'
    expect(hasPreservedSections(content)).toBe(false)
  })
})

describe('validatePreservedSections', () => {
  it('validates properly closed sections', () => {
    const content = `<!-- prjct:preserve -->
Content
<!-- prjct:end-preserve -->`

    const result = validatePreservedSections(content)

    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('warns about unclosed sections', () => {
    const content = `<!-- prjct:preserve -->
Content without end marker`

    const result = validatePreservedSections(content)

    expect(result.valid).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('start markers')
  })

  it('warns about orphaned end markers', () => {
    const content = `Content
<!-- prjct:end-preserve -->`

    const result = validatePreservedSections(content)

    expect(result.valid).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('end markers')
  })
})
