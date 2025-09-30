import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface BadgeProps extends HTMLMotionProps<'span'> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info' | 'danger'
  size?: 'sm' | 'md'
  children: React.ReactNode
  icon?: React.ReactNode
}

const variants = {
  default: 'bg-muted text-foreground border-border',
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-cat-green/10 text-cat-green border-cat-green/20',
  warning: 'bg-cat-yellow/10 text-cat-yellow border-cat-yellow/20',
  info: 'bg-cat-sapphire/10 text-cat-sapphire border-cat-sapphire/20',
  danger: 'bg-cat-red/10 text-cat-red border-cat-red/20',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', className, children, icon, ...props }, ref) => {
    return (
      <motion.span
        ref={ref}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border font-medium',
          sizes[size],
          variants[variant],
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </motion.span>
    )
  }
)

Badge.displayName = 'Badge'
