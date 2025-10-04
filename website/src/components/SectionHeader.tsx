import { motion } from 'framer-motion'
import { typography, spacing, gradients } from '../lib/typography-system'
import { animationPresets } from '../lib/animation-variants'
import { cn } from '../lib/utils'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  gradient?: boolean
}

export const SectionHeader = ({ title, subtitle, gradient = false }: SectionHeaderProps) => {
  return (
    <motion.div {...animationPresets.standard} className={cn('text-center', spacing.headerMargin)}>
      <h2 className={cn(typography.sectionTitleSmall, spacing.elementMargin)}>
        {gradient ? <span className={gradients.textPrimary}>{title}</span> : title}
      </h2>
      {subtitle && (
        <p className={cn(typography.sectionSubtitleSmall, 'mx-auto max-w-2xl')}>{subtitle}</p>
      )}
    </motion.div>
  )
}
