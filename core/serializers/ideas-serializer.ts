/**
 * Ideas Serializer
 *
 * Parses and serializes ideas.md for idea backlog.
 *
 * MD Format (ideas.md):
 * ```
 * # IDEAS 💡
 *
 * ## Brain Dump
 *
 * - Add dark mode _(2025-12-10)_ #ui #enhancement
 * - Improve caching _(2025-12-09)_ #performance
 *
 * ## Converted
 *
 * - ✓ Add user auth → feat_123 _(2025-12-08)_
 * ```
 */

export type IdeaStatus = 'pending' | 'converted' | 'archived'
export type IdeaPriority = 'low' | 'medium' | 'high'

export interface Idea {
  id: string
  text: string
  status: IdeaStatus
  priority: IdeaPriority
  tags: string[]
  addedAt: string         // ISO8601
  convertedTo?: string    // featureId if converted
}

/**
 * Parse ideas.md content to Idea[]
 */
export function parseIdeas(content: string): Idea[] {
  if (!content || !content.trim()) {
    return []
  }

  const ideas: Idea[] = []

  // Split by sections
  const sections = content.split(/\n## /).slice(1)

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const sectionName = lines[0]?.trim().toLowerCase() || ''

    // Determine status based on section
    let status: IdeaStatus = 'pending'
    if (sectionName.includes('converted')) {
      status = 'converted'
    } else if (sectionName.includes('archived')) {
      status = 'archived'
    }

    // Parse list items
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line.startsWith('-')) continue

      const itemText = line.slice(1).trim()
      if (!itemText) continue

      // Extract date: _(date)_
      const dateMatch = itemText.match(/_\((.+?)\)_/)
      const addedAt = dateMatch ? dateMatch[1].trim() : new Date().toISOString()

      // Extract tags: #tag1 #tag2
      const tags = (itemText.match(/#(\w+)/g) || []).map(t => t.slice(1))

      // Extract converted feature id: → feat_123
      const convertedMatch = itemText.match(/→\s*(\w+)/)
      const convertedTo = convertedMatch ? convertedMatch[1] : undefined

      // Clean text: remove date, tags, and conversion marker
      let text = itemText
        .replace(/_\(.+?\)_/g, '')
        .replace(/#\w+/g, '')
        .replace(/→\s*\w+/g, '')
        .replace(/^✓\s*/, '')
        .trim()

      // Detect priority from keywords
      let priority: IdeaPriority = 'medium'
      if (text.toLowerCase().includes('urgent') || text.toLowerCase().includes('critical')) {
        priority = 'high'
      } else if (text.toLowerCase().includes('nice to have') || text.toLowerCase().includes('maybe')) {
        priority = 'low'
      }

      ideas.push({
        id: `idea_${Date.parse(addedAt) || Date.now()}_${i}`,
        text,
        status,
        priority,
        tags,
        addedAt,
        convertedTo
      })
    }
  }

  return ideas
}

/**
 * Serialize Idea[] to ideas.md format
 */
export function serializeIdeas(ideas: Idea[]): string {
  const lines: string[] = ['# IDEAS 💡', '']

  const pending = ideas.filter(i => i.status === 'pending')
  const converted = ideas.filter(i => i.status === 'converted')
  const archived = ideas.filter(i => i.status === 'archived')

  // Brain Dump section (pending ideas)
  lines.push('## Brain Dump', '')

  if (pending.length === 0) {
    lines.push('_No pending ideas. Use `/p:idea` to capture one._', '')
  } else {
    // Sort by addedAt descending (newest first)
    const sorted = [...pending].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    )

    for (const idea of sorted) {
      const tagsStr = idea.tags.length > 0 ? ' ' + idea.tags.map(t => `#${t}`).join(' ') : ''
      const dateStr = formatDate(idea.addedAt)
      lines.push(`- ${idea.text} _(${dateStr})_${tagsStr}`)
    }
    lines.push('')
  }

  // Converted section
  if (converted.length > 0) {
    lines.push('## Converted', '')
    const sorted = [...converted].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    )

    for (const idea of sorted) {
      const convStr = idea.convertedTo ? ` → ${idea.convertedTo}` : ''
      const dateStr = formatDate(idea.addedAt)
      lines.push(`- ✓ ${idea.text}${convStr} _(${dateStr})_`)
    }
    lines.push('')
  }

  // Archived section
  if (archived.length > 0) {
    lines.push('## Archived', '')
    const sorted = [...archived].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    )

    for (const idea of sorted) {
      const dateStr = formatDate(idea.addedAt)
      lines.push(`- ${idea.text} _(${dateStr})_`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format date for display
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  } catch {
    return isoDate
  }
}

/**
 * Create empty ideas.md
 */
export function createEmptyIdeasMd(): string {
  return serializeIdeas([])
}
