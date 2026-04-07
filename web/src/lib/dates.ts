// Date formatting helpers — keep output compact and human-readable.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format as "Feb 21" (same year) or "Feb 21, 2025" (different year). */
export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const month = MONTHS[d.getMonth()]
  const day = d.getDate()
  return d.getFullYear() === now.getFullYear()
    ? `${month} ${day}`
    : `${month} ${day}, ${d.getFullYear()}`
}

/** Format as a short relative time: "now", "5m", "3h", "2d", "3w", "6mo", "2y" */
export function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms)) return ''
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  if (d < 30) return `${Math.floor(d / 7)}w`
  if (d < 365) return `${Math.floor(d / 30)}mo`
  return `${Math.floor(d / 365)}y`
}

/** Duration between two ISO dates: "3h 12m", "45m", "30s" */
export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return ''
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (isNaN(ms) || ms < 0) return ''
  if (ms >= 3600000) {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  if (ms >= 60000) return `${Math.floor(ms / 60000)}m`
  return `${Math.floor(ms / 1000)}s`
}
