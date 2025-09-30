import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface SectionProps extends Omit<HTMLMotionProps<'section'>, 'title'> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  centered?: boolean
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '6xl' | '7xl' | 'full'
}

const maxWidths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
}

export const Section = React.forwardRef<HTMLDivElement, SectionProps>(
  (
    {
      title,
      subtitle,
      badge,
      centered = false,
      maxWidth = '7xl',
      className,
      children,
      initial = { opacity: 0, y: 20 },
      whileInView = { opacity: 1, y: 0 },
      transition = { duration: 0.6 },
      viewport = { once: true },
      ...props
    },
    ref
  ) => {
    return (
      <motion.section
        ref={ref}
        initial={initial}
        whileInView={whileInView}
        transition={transition}
        viewport={viewport}
        className={cn('px-4 py-20', className)}
        {...props}
      >
        <div className={cn(maxWidths[maxWidth], 'mx-auto')}>
          {(title || subtitle || badge) && (
            <div className={cn('mb-12', centered && 'text-center')}>
              {badge && <div className="mb-6">{badge}</div>}
              {title && <h2 className="mb-4 text-4xl font-bold md:text-5xl">{title}</h2>}
              {subtitle && (
                <p className={cn('text-xl text-muted-foreground', centered && 'mx-auto max-w-2xl')}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {children}
        </div>
      </motion.section>
    )
  }
)

Section.displayName = 'Section'
