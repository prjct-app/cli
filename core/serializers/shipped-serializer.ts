/**
 * Shipped Serializer
 *
 * Parses and serializes shipped.md for shipped features.
 *
 * MD Format (shipped.md):
 * ```
 * # SHIPPED 🚀
 *
 * ## Feature Name
 *
 * Shipped: 2025-12-10T10:00:00.000Z
 * Version: 0.1.5
 *
 * ## Another Feature
 *
 * Shipped: 2025-12-09T14:30:00.000Z
 * Version: 0.1.4
 * ```
 */

export interface ShippedFeature {
  id: string
  name: string
  shippedAt: string      // ISO8601
  version: string
  description?: string
}

/**
 * Parse shipped.md content to ShippedFeature[]
 */
export function parseShipped(content: string): ShippedFeature[] {
  if (!content || !content.trim()) {
    return []
  }

  const features: ShippedFeature[] = []
  const sections = content.split(/\n## /).slice(1) // Skip header

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const name = lines[0]?.trim()

    if (!name) continue

    const shippedMatch = section.match(/Shipped:\s*(.+)/i)
    const versionMatch = section.match(/Version:\s*(.+)/i)

    const shippedAt = shippedMatch ? shippedMatch[1].trim() : new Date().toISOString()
    const version = versionMatch ? versionMatch[1].trim() : '0.0.0'

    // Extract description (lines between name and metadata)
    const descLines: string[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('Shipped:') || line.startsWith('Version:') || !line) break
      descLines.push(line)
    }

    features.push({
      id: `ship_${Date.parse(shippedAt) || Date.now()}`,
      name,
      shippedAt,
      version,
      description: descLines.join(' ') || undefined
    })
  }

  return features
}

/**
 * Serialize ShippedFeature[] to shipped.md format
 */
export function serializeShipped(features: ShippedFeature[]): string {
  const lines: string[] = ['# SHIPPED 🚀', '']

  if (features.length === 0) {
    lines.push('_No features shipped yet._', '')
    lines.push('Use `/p:ship` to celebrate your first ship!')
    return lines.join('\n')
  }

  // Sort by shippedAt descending (newest first)
  const sorted = [...features].sort(
    (a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime()
  )

  for (const feature of sorted) {
    lines.push(`## ${feature.name}`, '')
    if (feature.description) {
      lines.push(feature.description, '')
    }
    lines.push(`Shipped: ${feature.shippedAt}`)
    lines.push(`Version: ${feature.version}`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Create empty shipped.md
 */
export function createEmptyShippedMd(): string {
  return serializeShipped([])
}
