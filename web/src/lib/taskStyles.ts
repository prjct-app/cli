// Central style helpers for task/idea visual language.
// Returns full class strings so Tailwind JIT picks them up (also safelisted in tailwind.config.js).

export const PRIORITY_ORDER: Record<string, number> = {
  critical: 0, urgent: 0, high: 1, medium: 2, normal: 3, low: 4,
}

export const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical', urgent: 'Urgent', high: 'High', medium: 'Medium', normal: 'Normal', low: 'Low',
}

export const TYPE_LABEL: Record<string, string> = {
  bug: 'Bug', feature: 'Feature', improvement: 'Improvement', security: 'Security', chore: 'Chore', fix: 'Fix',
}

function priorityKey(p?: string): 'critical' | 'high' | 'medium' | 'low' | 'normal' {
  if (!p) return 'normal'
  if (p === 'urgent' || p === 'critical') return 'critical'
  if (p === 'high') return 'high'
  if (p === 'medium') return 'medium'
  if (p === 'low') return 'low'
  return 'normal'
}

function typeKey(t?: string): 'bug' | 'feature' | 'improvement' | 'security' | 'chore' {
  if (t === 'bug' || t === 'fix') return 'bug'
  if (t === 'feature') return 'feature'
  if (t === 'improvement' || t === 'refactor') return 'improvement'
  if (t === 'security') return 'security'
  return 'chore'
}

export function priorityColor(p?: string): string {
  const map = {
    critical: 'text-priority-critical',
    high: 'text-priority-high',
    medium: 'text-priority-medium',
    low: 'text-priority-low',
    normal: 'text-priority-normal',
  }
  return map[priorityKey(p)]
}

export function priorityStripe(p?: string): string {
  const map = {
    critical: 'border-l-priority-critical',
    high: 'border-l-priority-high',
    medium: 'border-l-priority-medium',
    low: 'border-l-priority-low',
    normal: 'border-l-priority-normal',
  }
  return map[priorityKey(p)]
}

export function priorityBg(p?: string): string {
  const map = {
    critical: 'bg-priority-critical-bg',
    high: 'bg-priority-high-bg',
    medium: 'bg-priority-medium-bg',
    low: 'bg-priority-low-bg',
    normal: 'bg-priority-normal-bg',
  }
  return map[priorityKey(p)]
}

export function priorityDot(p?: string): string {
  const map = {
    critical: 'bg-priority-critical',
    high: 'bg-priority-high',
    medium: 'bg-priority-medium',
    low: 'bg-priority-low',
    normal: 'bg-priority-normal',
  }
  return map[priorityKey(p)]
}

export function typeColor(t?: string): string {
  const map = {
    bug: 'text-type-bug',
    feature: 'text-type-feature',
    improvement: 'text-type-improvement',
    security: 'text-type-security',
    chore: 'text-type-chore',
  }
  return map[typeKey(t)]
}

export function typeBg(t?: string): string {
  const map = {
    bug: 'bg-type-bug-bg',
    feature: 'bg-type-feature-bg',
    improvement: 'bg-type-improvement-bg',
    security: 'bg-type-security-bg',
    chore: 'bg-type-chore-bg',
  }
  return map[typeKey(t)]
}

export function statusColor(s?: string): string {
  if (s === 'active' || s === 'running') return 'text-status-active'
  if (s === 'blocked' || s === 'paused') return 'text-status-blocked'
  return 'text-status-done'
}
