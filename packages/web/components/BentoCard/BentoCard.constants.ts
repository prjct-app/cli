import type { AccentColor, BentoSize } from './BentoCard.types'

export const BENTO_SIZE_CLASSES: Record<BentoSize, string> = {
  '1x1': 'col-span-1 row-span-1',
  '1x2': 'col-span-1 row-span-2',
  '2x1': 'col-span-1 sm:col-span-2 row-span-1',
  '2x2': 'col-span-1 sm:col-span-2 row-span-2',
  'full': 'col-span-1 sm:col-span-2 lg:col-span-full',
}

export const ACCENT_STYLES: Record<AccentColor, string> = {
  default: '',
  success: 'border-emerald-500/20 bg-emerald-500/5',
  warning: 'border-amber-500/20 bg-amber-500/5',
  destructive: 'border-destructive/20 bg-destructive/5',
}
