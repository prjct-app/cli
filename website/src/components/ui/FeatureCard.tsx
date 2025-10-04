import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface FeatureCardProps extends Omit<HTMLMotionProps<'div'>, 'children' | 'layout'> {
  icon: React.ComponentType<{ className?: string }> | React.ReactNode
  title: string
  description?: string
  bullets?: React.ReactNode[]
  variant?: 'default' | 'large' | 'simple' | 'fancy'
  index?: number
  contentLayout?: 'center' | 'horizontal'
}

const variants = {
  default: {
    container:
      'group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20',
    iconBox:
      'mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 h-14 w-14 transition-all duration-300 group-hover:scale-110 group-hover:from-purple-500/30 group-hover:to-blue-500/30',
    iconSize: 'text-purple-500 transition-transform duration-300 group-hover:scale-110',
    title: 'mb-2 font-bold text-lg',
    description: 'text-sm leading-relaxed text-muted-foreground',
    hasGlow: true,
  },
  large: {
    container:
      'group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 transition-all duration-300 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20',
    iconBox:
      'mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 h-16 w-16 transition-all duration-300 group-hover:scale-110 group-hover:from-purple-500/30 group-hover:to-blue-500/30',
    iconSize: 'text-purple-500 transition-transform duration-300 group-hover:scale-110',
    title: 'mb-2 font-bold text-xl',
    description: 'text-sm leading-relaxed text-muted-foreground',
    hasGlow: true,
  },
  simple: {
    container: 'p-6 bg-muted/20 rounded-2xl',
    iconBox: 'w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0',
    iconSize: 'w-5 h-5 text-primary',
    title: 'text-xl font-bold mb-2',
    description: 'text-muted-foreground mb-3',
    hasGlow: false,
  },
  fancy: {
    container:
      'relative p-6 bg-gradient-to-br from-cat-mauve/10 to-cat-blue/10 rounded-2xl border-2 border-cat-mauve/30',
    iconBox: 'w-10 h-10 rounded-lg bg-cat-mauve/20 flex items-center justify-center flex-shrink-0',
    iconSize: 'w-5 h-5 text-cat-mauve',
    title: 'text-xl font-bold mb-2',
    description: 'text-muted-foreground mb-3',
    hasGlow: false,
  },
}

export const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  (
    {
      icon,
      title,
      description,
      bullets,
      variant = 'default',
      index = 0,
      contentLayout = 'center',
      className,
      initial = { opacity: 0, y: 20 },
      whileInView = { opacity: 1, y: 0 },
      transition = { duration: 0.5, delay: index * 0.1 },
      viewport = { once: true },
      whileHover,
      ...props
    },
    ref
  ) => {
    const variantConfig = variants[variant]
    const isCentered = contentLayout === 'center'
    const hasMotion = variant === 'default' || variant === 'large'

    const defaultHover = hasMotion ? { y: -8, transition: { duration: 0.2 } } : undefined

    // Check if icon is a React element (already instantiated like <Icon />)
    const isElement = React.isValidElement(icon)
    // If not an element, treat it as a component type (function, forwardRef, memo, etc.)
    const isComponentType =
      !isElement && (typeof icon === 'function' || (typeof icon === 'object' && icon !== null))
    const Icon = isComponentType ? (icon as React.ComponentType<{ className?: string }>) : null

    const content = (
      <>
        {/* Gradient glow effect (only for default/large) */}
        {variantConfig.hasGlow && (
          <>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
          </>
        )}

        <div
          className={cn(
            'relative',
            isCentered && 'text-center',
            !isCentered && 'flex items-start gap-4'
          )}
        >
          {/* Icon */}
          <div className={variantConfig.iconBox}>
            {Icon ? (
              <Icon className={variantConfig.iconSize} />
            ) : isElement ? (
              React.cloneElement(icon as React.ReactElement, { className: variantConfig.iconSize })
            ) : (
              <div className={variantConfig.iconSize}>{icon as React.ReactNode}</div>
            )}
          </div>

          {/* Content */}
          <div className={isCentered ? '' : 'flex-1'}>
            <h3 className={variantConfig.title}>{title}</h3>
            {description && <p className={variantConfig.description}>{description}</p>}
            {bullets && bullets.length > 0 && (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    )

    return (
      <motion.div
        ref={ref}
        initial={initial}
        whileInView={whileInView}
        transition={transition}
        viewport={viewport}
        whileHover={whileHover || defaultHover}
        className={cn(variantConfig.container, className)}
        {...props}
      >
        {content}
      </motion.div>
    )
  }
)

FeatureCard.displayName = 'FeatureCard'
