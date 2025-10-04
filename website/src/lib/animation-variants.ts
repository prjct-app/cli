import { Variants, Transition } from 'framer-motion'

/**
 * Standardized animation variants for consistent motion across components
 */

// Common viewport settings
export const defaultViewport = {
  once: true,
  amount: 0.1,
}

// Common transitions
export const transitions = {
  default: { duration: 0.6 },
  fast: { duration: 0.3 },
  slow: { duration: 0.8 },
  withDelay: (delay: number): Transition => ({ duration: 0.5, delay }),
  stagger: (index: number, duration = 0.5, delayMultiplier = 0.1): Transition => ({
    duration,
    delay: index * delayMultiplier,
  }),
} as const

// Fade in animations
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
}

// Scale animations
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
}

// Hover animations (for whileHover prop)
export const hoverLift = {
  y: -8,
  transition: { duration: 0.2 },
}

export const hoverScale = {
  scale: 1.02,
  transition: { duration: 0.2 },
}

export const hoverScaleLarge = {
  scale: 1.05,
  transition: { duration: 0.2 },
}

// Tap animations (for whileTap prop)
export const tapScale = {
  scale: 0.98,
}

/**
 * Preset animation configurations for common use cases
 */
export const animationPresets = {
  // Standard fade in from bottom (most common)
  standard: {
    initial: 'hidden',
    whileInView: 'visible',
    variants: fadeInUp,
    transition: transitions.default,
    viewport: defaultViewport,
  },

  // Fade in from bottom with custom delay
  standardWithDelay: (delay: number) => ({
    initial: 'hidden',
    whileInView: 'visible',
    variants: fadeInUp,
    transition: transitions.withDelay(delay),
    viewport: defaultViewport,
  }),

  // Stagger animation for lists
  stagger: (index: number) => ({
    initial: 'hidden',
    whileInView: 'visible',
    variants: fadeInUp,
    transition: transitions.stagger(index),
    viewport: defaultViewport,
  }),

  // Fade in from left (timeline items)
  fromLeft: {
    initial: 'hidden',
    whileInView: 'visible',
    variants: fadeInLeft,
    transition: transitions.default,
    viewport: defaultViewport,
  },

  // Scale in (badges, small elements)
  scale: {
    initial: 'hidden',
    animate: 'visible',
    variants: scaleIn,
    transition: transitions.fast,
  },

  // Animate on mount (hero sections)
  hero: {
    initial: 'hidden',
    animate: 'visible',
    variants: fadeInUp,
    transition: transitions.default,
  },
} as const

/**
 * Helper to create custom stagger delays
 */
export const createStaggerDelay = (index: number, baseDelay = 0, increment = 0.1) => {
  return baseDelay + index * increment
}
