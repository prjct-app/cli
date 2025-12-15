/**
 * Project Colors - Consistent color generation based on projectId
 *
 * Uses a hash of the projectId to generate a consistent color
 * that matches between UI elements and browser tab titles.
 */

// Color palette - visually distinct colors that work well in both
// Tailwind classes and as emojis
export const PROJECT_COLORS = [
  { name: 'red', emoji: '🔴', bg: 'bg-red-500', text: 'text-red-500' },
  { name: 'orange', emoji: '🟠', bg: 'bg-orange-500', text: 'text-orange-500' },
  { name: 'yellow', emoji: '🟡', bg: 'bg-yellow-500', text: 'text-yellow-500' },
  { name: 'green', emoji: '🟢', bg: 'bg-green-500', text: 'text-green-500' },
  { name: 'blue', emoji: '🔵', bg: 'bg-blue-500', text: 'text-blue-500' },
  { name: 'purple', emoji: '🟣', bg: 'bg-purple-500', text: 'text-purple-500' },
  { name: 'brown', emoji: '🟤', bg: 'bg-amber-700', text: 'text-amber-700' },
] as const

export type ProjectColor = typeof PROJECT_COLORS[number]

/**
 * Simple hash function for strings
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get a consistent color for a project based on its ID
 */
export function getProjectColor(projectId: string): ProjectColor {
  const hash = hashString(projectId)
  const index = hash % PROJECT_COLORS.length
  return PROJECT_COLORS[index]
}

/**
 * Get just the emoji for a project (for use in titles)
 * Returns a neutral symbol instead of colored circles
 */
export function getProjectEmoji(projectId: string): string {
  return '▸'
}

/**
 * Get the Tailwind background class for a project
 * Returns neutral color - projects no longer have color-coded backgrounds
 */
export function getProjectBgClass(projectId: string): string {
  return 'bg-muted'
}
