/**
 * Ingest extractors — selection logic, offline.
 *
 * The real extractors shell out to textutil/pdftotext/tesseract, which may or
 * may not exist on a given machine. To stay deterministic we inject fake
 * extractors and assert the registry's contract: first matching extractor that
 * yields non-empty text wins; absent (throwing) or empty ones fall through;
 * null when nothing handles it. The static metadata (extensions, hints) is
 * pinned directly.
 */

import { describe, expect, it } from 'bun:test'
import {
  EXTRACTABLE_EXTENSIONS,
  type Extractor,
  extractHint,
  extractText,
} from '../../services/ingest-extractors'

const ok = (label: string, ext: string, text: string): Extractor => ({
  label,
  exts: new Set([ext]),
  extract: async () => text,
})
const boom = (ext: string): Extractor => ({
  label: 'gone',
  exts: new Set([ext]),
  extract: async () => {
    throw new Error('ENOENT: tool not installed')
  },
})

describe('extractText — selection', () => {
  it('returns text + tool from the first matching extractor', async () => {
    const r = await extractText('/tmp/doc.pdf', [ok('pdftotext', '.pdf', 'hello pdf')])
    expect(r).toEqual({ text: 'hello pdf', tool: 'pdftotext' })
  })

  it('falls through an absent (throwing) extractor to the next one', async () => {
    const r = await extractText('/tmp/doc.pdf', [boom('.pdf'), ok('backup', '.pdf', 'recovered')])
    expect(r?.tool).toBe('backup')
    expect(r?.text).toBe('recovered')
  })

  it('skips an extractor that yields only whitespace', async () => {
    const r = await extractText('/tmp/doc.pdf', [
      ok('blank', '.pdf', '   \n  '),
      ok('real', '.pdf', 'text'),
    ])
    expect(r?.tool).toBe('real')
  })

  it('trims extracted text', async () => {
    const r = await extractText('/tmp/doc.pdf', [ok('t', '.pdf', '  spaced  ')])
    expect(r?.text).toBe('spaced')
  })

  it('returns null when no extractor matches the extension', async () => {
    const r = await extractText('/tmp/img.png', [ok('pdftotext', '.pdf', 'x')])
    expect(r).toBeNull()
  })

  it('returns null when every matching extractor fails', async () => {
    const r = await extractText('/tmp/doc.pdf', [boom('.pdf'), boom('.pdf')])
    expect(r).toBeNull()
  })

  it('matches case-insensitively on extension', async () => {
    const r = await extractText('/tmp/DOC.PDF', [ok('t', '.pdf', 'x')])
    expect(r?.text).toBe('x')
  })
})

describe('extractor metadata', () => {
  it('advertises the binary/rich formats it can handle', () => {
    for (const ext of ['.pdf', '.docx', '.png', '.jpg', '.rtf']) {
      expect(EXTRACTABLE_EXTENSIONS.has(ext)).toBe(true)
    }
    expect(EXTRACTABLE_EXTENSIONS.has('.txt')).toBe(false) // plain text is not "extracted"
  })

  it('gives a format-specific install hint', () => {
    expect(extractHint('.pdf')).toContain('poppler')
    expect(extractHint('.png')).toContain('tesseract')
    expect(extractHint('.docx')).toContain('textutil')
  })
})
