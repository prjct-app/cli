import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface CardProps extends HTMLMotionProps<"div"> {
 variant?: 'default' | 'feature' | 'highlight' | 'gradient' | 'interactive'
 hover?: boolean
 children: React.ReactNode
}

const variants = {
 default: 'bg-card border border-border',
 feature: 'bg-card border border-border hover:shadow-xl hover:scale-[1.02]',
 highlight: 'bg-card border border-primary ring-1 ring-primary/20',
 gradient: 'bg-gradient-to-br from-purple-500/10 via-card/80 to-blue-500/10 border border-cat-mauve/20',
 interactive: 'bg-card/60 border border-border/30 hover:border-primary/50',
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
 ({
  variant = 'default',
  hover = true,
  className,
  children,
  initial = { opacity: 0, y: 20 },
  whileInView = { opacity: 1, y: 0 },
  transition = { duration: 0.5 },
  viewport = { once: true },
  ...props
 }, ref) => {
  return (
   <motion.div
    ref={ref}
    initial={initial}
    whileInView={whileInView}
    transition={transition}
    viewport={viewport}
    className={cn(
     'rounded-2xl p-6 transition-all duration-300',
     variants[variant],
     hover && 'hover:shadow-lg',
     className
    )}
    {...props}
   >
    {children}
   </motion.div>
  )
 }
)

Card.displayName = 'Card'