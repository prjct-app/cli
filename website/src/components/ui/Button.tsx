import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

type ButtonBaseProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'gradient'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  isLoading?: boolean
  className?: string
  disabled?: boolean
}

type ButtonAsButton = ButtonBaseProps & {
  as?: 'button'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

type ButtonAsAnchor = ButtonBaseProps & {
  as: 'a'
  href?: string
  target?: string
  rel?: string
}

export type ButtonProps = ButtonAsButton | ButtonAsAnchor

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-card border-2 border-border hover:bg-accent text-foreground',
  ghost: 'hover:bg-muted/50 text-foreground',
  icon: 'p-2 hover:bg-muted rounded-xl',
  gradient:
    'bg-gradient-to-r from-cat-light-mauve from-purple-500 to-cat-light-sapphire to-blue-500 text-white hover:from-cat-light-mauve/90 hover:from-purple-600 hover:to-cat-light-sapphire/90 hover:to-blue-600',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-8 py-4',
}

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    const {
      variant = 'primary',
      size = 'md',
      className,
      children,
      leftIcon,
      rightIcon,
      isLoading,
      disabled,
      ...restProps
    } = props
    const isIconOnly = variant === 'icon'

    const baseClassName = cn(
      'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200',
      !isIconOnly && sizes[size],
      variants[variant],
      disabled && 'cursor-not-allowed opacity-50',
      className
    )

    const content = (
      <>
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <>
            {leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2">{rightIcon}</span>}
          </>
        )}
      </>
    )

    if ('as' in restProps && restProps.as === 'a') {
      return (
        <motion.a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={restProps.href}
          target={restProps.target}
          rel={restProps.rel}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={baseClassName}
        >
          {content}
        </motion.a>
      )
    }

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={'onClick' in restProps ? restProps.onClick : undefined}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={baseClassName}
        disabled={disabled || isLoading}
      >
        {content}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
