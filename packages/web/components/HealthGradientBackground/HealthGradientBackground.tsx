import { cn } from '@/lib/utils'
import { getHealthGradient } from './HealthGradientBackground.utils'
import type { HealthGradientBackgroundProps } from './HealthGradientBackground.types'

export function HealthGradientBackground({ score }: HealthGradientBackgroundProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 -m-4 md:-m-8 rounded-2xl opacity-30 blur-3xl transition-colors duration-1000',
        getHealthGradient(score)
      )}
    />
  )
}
