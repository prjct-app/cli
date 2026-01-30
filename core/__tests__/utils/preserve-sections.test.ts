import { describe, expect, it } from 'bun:test'
import {
  extractPreservedContent,
  extractPreservedSections,
  hasPreservedSections,
  mergePreservedSections,
  stripPreservedSections,
  validatePreserveBlocks,
  wrapInPreserveMarkers,
} from '../../utils/preserve-sections'

describe('preserve-sections', () => {
  describe('extractPreservedSections', () => {
    it('should extract a single preserved section', () => {
      const content = `# Header

<!-- prjct:preserve -->
My custom content
<!-- /prjct:preserve -->

# Footer`

      const sections = extractPreservedSections(content)
      expect(sections).toHaveLength(1)
      expect(sections[0].content).toContain('My custom content')
    })

    it('should extract multiple preserved sections', () => {
      const content = `# Header

<!-- prjct:preserve -->
First section
<!-- /prjct:preserve -->

Some content

<!-- prjct:preserve -->
Second section
<!-- /prjct:preserve -->`

      const sections = extractPreservedSections(content)
      expect(sections).toHaveLength(2)
      expect(sections[0].content).toContain('First section')
      expect(sections[1].content).toContain('Second section')
    })

    it('should handle named sections', () => {
      const content = `<!-- prjct:preserve:custom-rules -->
My rules
<!-- /prjct:preserve -->`

      const sections = extractPreservedSections(content)
      expect(sections).toHaveLength(1)
      expect(sections[0].id).toBe('custom-rules')
    })

    it('should return empty array when no preserved sections', () => {
      const content = '# Just normal content'
      const sections = extractPreservedSections(content)
      expect(sections).toHaveLength(0)
    })

    it('should ignore unclosed preserve blocks', () => {
      const content = `<!-- prjct:preserve -->
No closing tag here`

      const sections = extractPreservedSections(content)
      expect(sections).toHaveLength(0)
    })
  })

  describe('extractPreservedContent', () => {
    it('should extract inner content without markers', () => {
      const content = `<!-- prjct:preserve -->
My content
<!-- /prjct:preserve -->`

      const inner = extractPreservedContent(content)
      expect(inner).toHaveLength(1)
      expect(inner[0]).toBe('My content')
    })
  })

  describe('hasPreservedSections', () => {
    it('should return true when preserved sections exist', () => {
      const content = '<!-- prjct:preserve -->content<!-- /prjct:preserve -->'
      expect(hasPreservedSections(content)).toBe(true)
    })

    it('should return false when no preserved sections', () => {
      const content = '# Normal markdown'
      expect(hasPreservedSections(content)).toBe(false)
    })
  })

  describe('mergePreservedSections', () => {
    it('should append preserved sections to new content', () => {
      const oldContent = `# Old Header

<!-- prjct:preserve -->
# My Rules
- Use tabs
<!-- /prjct:preserve -->`

      const newContent = `# New Generated Content

This is fresh.`

      const merged = mergePreservedSections(newContent, oldContent)

      expect(merged).toContain('# New Generated Content')
      expect(merged).toContain('My Rules')
      expect(merged).toContain('Use tabs')
      expect(merged).toContain('prjct:preserve')
    })

    it('should return new content unchanged when no preserved sections', () => {
      const oldContent = '# Old content without preserve markers'
      const newContent = '# New content'

      const merged = mergePreservedSections(newContent, oldContent)
      expect(merged).toBe(newContent)
    })

    it('should preserve multiple sections', () => {
      const oldContent = `<!-- prjct:preserve -->
Section 1
<!-- /prjct:preserve -->

<!-- prjct:preserve -->
Section 2
<!-- /prjct:preserve -->`

      const newContent = '# New'

      const merged = mergePreservedSections(newContent, oldContent)
      expect(merged).toContain('Section 1')
      expect(merged).toContain('Section 2')
    })
  })

  describe('wrapInPreserveMarkers', () => {
    it('should wrap content with default markers', () => {
      const content = 'My content'
      const wrapped = wrapInPreserveMarkers(content)

      expect(wrapped).toContain('<!-- prjct:preserve -->')
      expect(wrapped).toContain('My content')
      expect(wrapped).toContain('<!-- /prjct:preserve -->')
    })

    it('should wrap content with named markers', () => {
      const content = 'My content'
      const wrapped = wrapInPreserveMarkers(content, 'custom')

      expect(wrapped).toContain('<!-- prjct:preserve:custom -->')
    })
  })

  describe('stripPreservedSections', () => {
    it('should remove preserved sections from content', () => {
      const content = `# Header

<!-- prjct:preserve -->
Custom stuff
<!-- /prjct:preserve -->

# Footer`

      const stripped = stripPreservedSections(content)
      expect(stripped).toContain('# Header')
      expect(stripped).toContain('# Footer')
      expect(stripped).not.toContain('Custom stuff')
      expect(stripped).not.toContain('prjct:preserve')
    })

    it('should return content unchanged when no preserved sections', () => {
      const content = '# Normal content'
      const stripped = stripPreservedSections(content)
      expect(stripped).toBe(content)
    })
  })

  describe('validatePreserveBlocks', () => {
    it('should validate correct blocks', () => {
      const content = `<!-- prjct:preserve -->
Content
<!-- /prjct:preserve -->`

      const result = validatePreserveBlocks(content)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect mismatched markers', () => {
      const content = `<!-- prjct:preserve -->
Content without closing`

      const result = validatePreserveBlocks(content)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should detect nested blocks', () => {
      const content = `<!-- prjct:preserve -->
<!-- prjct:preserve -->
Nested
<!-- /prjct:preserve -->
<!-- /prjct:preserve -->`

      const result = validatePreserveBlocks(content)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Nested'))).toBe(true)
    })
  })
})
