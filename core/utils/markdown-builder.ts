/**
 * MarkdownBuilder - Fluent API for constructing markdown documents
 *
 * Eliminates duplicated markdown generation across:
 * - state-storage.ts (~35 lines)
 * - queue-storage.ts (~45 lines)
 * - ideas-storage.ts (~40 lines)
 * - shipped-storage.ts (~25 lines)
 *
 * Usage:
 * ```typescript
 * const content = md()
 *   .h1('Title')
 *   .p('Description')
 *   .when(hasItems, m => m.list(items))
 *   .build()
 * ```
 */

export class MarkdownBuilder {
  private lines: string[] = []

  /**
   * Add H1 heading
   */
  h1(text: string): this {
    this.lines.push(`# ${text}`, '')
    return this
  }

  /**
   * Add H2 heading
   */
  h2(text: string): this {
    this.lines.push(`## ${text}`, '')
    return this
  }

  /**
   * Add H3 heading
   */
  h3(text: string): this {
    this.lines.push(`### ${text}`)
    return this
  }

  /**
   * Add H4 heading
   */
  h4(text: string): this {
    this.lines.push(`#### ${text}`)
    return this
  }

  /**
   * Add paragraph
   */
  p(text: string): this {
    this.lines.push(text, '')
    return this
  }

  /**
   * Add bold text on its own line
   */
  bold(text: string): this {
    this.lines.push(`**${text}**`)
    return this
  }

  /**
   * Add italic text on its own line
   */
  italic(text: string): this {
    this.lines.push(`*${text}*`)
    return this
  }

  /**
   * Add inline code
   */
  code(text: string): this {
    this.lines.push(`\`${text}\``)
    return this
  }

  /**
   * Add code block
   */
  codeBlock(code: string, lang = ''): this {
    this.lines.push(`\`\`\`${lang}`, code, '```', '')
    return this
  }

  /**
   * Add list item with optional checkbox
   */
  li(text: string, options?: { checked?: boolean; indent?: number }): this {
    const indent = '  '.repeat(options?.indent ?? 0)
    if (options?.checked !== undefined) {
      this.lines.push(`${indent}- [${options.checked ? 'x' : ' '}] ${text}`)
    } else {
      this.lines.push(`${indent}- ${text}`)
    }
    return this
  }

  /**
   * Add numbered list item
   */
  oli(text: string, number: number): this {
    this.lines.push(`${number}. ${text}`)
    return this
  }

  /**
   * Add multiple list items
   */
  list(items: string[], options?: { checked?: boolean }): this {
    for (const item of items) {
      this.li(item, options)
    }
    return this
  }

  /**
   * Add multiple numbered list items
   */
  orderedList(items: string[]): this {
    for (let i = 0; i < items.length; i++) {
      this.oli(items[i], i + 1)
    }
    return this
  }

  /**
   * Add horizontal rule
   */
  hr(): this {
    this.lines.push('', '---', '')
    return this
  }

  /**
   * Add blank line
   */
  blank(): this {
    this.lines.push('')
    return this
  }

  /**
   * Add raw line(s)
   */
  raw(text: string): this {
    this.lines.push(text)
    return this
  }

  /**
   * Add multiple raw lines
   */
  rawLines(lines: string[]): this {
    this.lines.push(...lines)
    return this
  }

  /**
   * Add blockquote
   */
  quote(text: string): this {
    this.lines.push(`> ${text}`)
    return this
  }

  /**
   * Add link
   */
  link(text: string, url: string): this {
    this.lines.push(`[${text}](${url})`)
    return this
  }

  /**
   * Add key-value pair (bold key)
   */
  kv(key: string, value: string): this {
    this.lines.push(`**${key}:** ${value}`)
    return this
  }

  /**
   * Add table from data
   */
  table(headers: string[], rows: string[][]): this {
    // Header row
    this.lines.push(`| ${headers.join(' | ')} |`)
    // Separator
    this.lines.push(`| ${headers.map(() => '---').join(' | ')} |`)
    // Data rows
    rows.forEach((row) => {
      this.lines.push(`| ${row.join(' | ')} |`)
    })
    this.blank()
    return this
  }

  /**
   * Conditional block - only adds content if condition is true
   */
  when(condition: boolean, builder: (md: MarkdownBuilder) => void): this {
    if (condition) {
      builder(this)
    }
    return this
  }

  /**
   * Optional block - only adds content if value exists
   */
  maybe<T>(value: T | null | undefined, builder: (md: MarkdownBuilder, val: T) => void): this {
    if (value != null) {
      builder(this, value)
    }
    return this
  }

  /**
   * Iterate and build for each item
   */
  each<T>(items: T[], builder: (md: MarkdownBuilder, item: T, index: number) => void): this {
    for (let i = 0; i < items.length; i++) {
      builder(this, items[i], i)
    }
    return this
  }

  /**
   * Add section with heading and content
   */
  section(heading: string, level: 1 | 2 | 3 | 4, builder: (md: MarkdownBuilder) => void): this {
    switch (level) {
      case 1:
        this.h1(heading)
        break
      case 2:
        this.h2(heading)
        break
      case 3:
        this.h3(heading)
        break
      case 4:
        this.h4(heading)
        break
    }
    builder(this)
    return this
  }

  /**
   * Build final markdown string
   */
  build(): string {
    return this.lines.join('\n')
  }

  /**
   * Get current line count
   */
  get length(): number {
    return this.lines.length
  }
}

/**
 * Factory function for fluent API
 */
export function md(): MarkdownBuilder {
  return new MarkdownBuilder()
}

// Default export
export default { MarkdownBuilder, md }
