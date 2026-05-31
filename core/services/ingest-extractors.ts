/**
 * Ingest extractors — turn a binary/rich document into plain text using
 * EXTERNAL tools that are already on the machine, then feed that text through
 * the normal capture pipeline (chunk → `source` memory → vectorized).
 *
 * Design (mirrors the embeddings tiering): ZERO bundled dependency. We never
 * ship a PDF/OCR library — instead we shell out to a tool IF the user has it,
 * exactly like embeddings use a local engine when one is present:
 *   - `.docx/.doc/.rtf/.html/.pages/…` → `textutil` (built into macOS)
 *   - `.pdf`                            → `pdftotext` (poppler)
 *   - images `.png/.jpg/…`             → `tesseract` (OCR)
 *
 * A tool that is absent simply throws ENOENT on exec; we catch, try the next
 * extractor, and ultimately return null so the caller can skip the file with
 * an actionable "install X" hint. Nothing here is reached unless the user
 * dropped a non-text file, so the common path pays zero cost.
 *
 * Safety: every tool is invoked with `execFile` (no shell, argv array) on a
 * user-supplied path, with a timeout and a generous maxBuffer. The extracted
 * text still runs through the secret/prompt-injection scanners in wiki-ingest.
 */

import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const EXEC_OPTS = { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 } as const

export interface Extractor {
  /** Stamped onto the memory as `extracted:<label>` for provenance. */
  label: string
  exts: Set<string>
  /** Resolve to the document's text. Throw (e.g. ENOENT) when the tool is
   *  absent or the file has no extractable text — the caller falls through. */
  extract(absPath: string): Promise<string>
}

/** macOS built-in. Handles Office/rich-text/HTML without any install. */
const textutilExtractor: Extractor = {
  label: 'textutil',
  exts: new Set([
    '.docx',
    '.doc',
    '.rtf',
    '.rtfd',
    '.html',
    '.htm',
    '.odt',
    '.pages',
    '.webarchive',
  ]),
  async extract(absPath) {
    if (process.platform !== 'darwin') throw new Error('textutil is macOS-only')
    const { stdout } = await execFileAsync(
      'textutil',
      ['-convert', 'txt', '-stdout', absPath],
      EXEC_OPTS
    )
    return stdout
  },
}

/** poppler. The de-facto PDF→text tool; `-` writes to stdout. */
const pdftotextExtractor: Extractor = {
  label: 'pdftotext',
  exts: new Set(['.pdf']),
  async extract(absPath) {
    const { stdout } = await execFileAsync('pdftotext', ['-q', '-nopgbrk', absPath, '-'], EXEC_OPTS)
    return stdout
  },
}

/** Tesseract OCR for images. `stdout` is its special "write to stdout" target. */
const tesseractExtractor: Extractor = {
  label: 'tesseract',
  exts: new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp']),
  async extract(absPath) {
    const { stdout } = await execFileAsync('tesseract', [absPath, 'stdout'], EXEC_OPTS)
    return stdout
  },
}

export const DEFAULT_EXTRACTORS: Extractor[] = [
  textutilExtractor,
  pdftotextExtractor,
  tesseractExtractor,
]

/** Every extension some extractor could handle — used to widen the ingest
 *  dropzone's file allowlist beyond plain text. */
export const EXTRACTABLE_EXTENSIONS: Set<string> = new Set(
  DEFAULT_EXTRACTORS.flatMap((e) => [...e.exts])
)

/** Static, availability-free hint for the skip message when extraction yields
 *  nothing — so the user knows which tool unlocks the format. */
export function extractHint(ext: string): string {
  const e = ext.toLowerCase()
  if (e === '.pdf')
    return 'install poppler (`brew install poppler`) for PDF text, or convert it to .txt'
  if (['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'].includes(e)) {
    return 'install tesseract (`brew install tesseract`) for image OCR, or add a sidecar .txt note'
  }
  if (['.docx', '.doc', '.rtf', '.odt', '.pages', '.html', '.htm', '.webarchive'].includes(e)) {
    return 'rich-doc extraction needs macOS `textutil`; on other platforms convert to .txt/.md'
  }
  return 'convert it to a supported text format (.txt/.md)'
}

/**
 * Extract text from a non-text file, or null if no available tool produced
 * any. `extractors` is injectable so tests run without real binaries.
 */
export async function extractText(
  absPath: string,
  extractors: Extractor[] = DEFAULT_EXTRACTORS
): Promise<{ text: string; tool: string } | null> {
  const ext = path.extname(absPath).toLowerCase()
  for (const e of extractors) {
    if (!e.exts.has(ext)) continue
    try {
      const text = (await e.extract(absPath)).trim()
      if (text) return { text, tool: e.label }
    } catch {
      // Tool absent (ENOENT) or failed on this file — try the next extractor.
    }
  }
  return null
}
