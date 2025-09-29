import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface IconBoxProps extends HTMLMotionProps<"div"> {
 variant?: 'default' | 'primary' | 'gradient' | 'outline' | 'muted'
 size?: 'sm' | 'md' | 'lg'
 children: React.ReactNode
 rounded?: 'md' | 'lg' | 'xl' | 'full'
}

const variants = {
 default: 'bg-card border border-border',
 primary: 'bg-primary/10 text-primary',
 gradient: 'bg-gradient-to-br from-purple-500/20 to-blue-500/20',
 outline: 'border-2 border-current',
 muted: 'bg-muted',
}

const sizes = {
 sm: 'w-8 h-8 p-1.5',
 md: 'w-12 h-12 p-2.5',
 lg: 'w-16 h-16 p-3',
}

const roundedSizes = {
 md: 'rounded-md',
 lg: 'rounded-lg',
 xl: 'rounded-xl',
 full: 'rounded-full',
}

export const IconBox = React.forwardRef<HTMLDivElement, IconBoxProps>(
 ({
  variant = 'default',
  size = 'md',
  rounded = 'lg',
  className,
  children,
  whileHover = { scale: 1.05 },
  transition = { type: 'spring', stiffness: 200 },
  ...props
 }, ref) => {
  return (
   <motion.div
    ref={ref}
    whileHover={whileHover}
    transition={transition}
    className={cn(
     'inline-flex items-center justify-center flex-shrink-0',
     sizes[size],
     roundedSizes[rounded],
     variants[variant],
     className
    )}
    {...props}
   >
    {children}
   </motion.div>
  )
 }
)

IconBox.displayName = 'IconBox'