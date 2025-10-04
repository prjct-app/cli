import { cn } from './utils'

/**
 * Standardized typography system for consistent text styling
 *
 * Usage:
 * <h1 className={typography.hero}>...</h1>
 * <h2 className={typography.sectionTitle}>...</h2>
 */

export const typography = {
  // Hero/Display text (largest)
  hero: 'text-6xl font-bold tracking-tight md:text-8xl',

  // Page titles
  pageTitle: 'text-5xl font-bold md:text-6xl',

  // Section titles (main sections)
  sectionTitle: 'text-4xl font-bold md:text-5xl',
  sectionTitleSmall: 'text-3xl font-bold md:text-4xl',

  // Subsection titles
  subsectionTitle: 'text-2xl font-bold',
  subsectionTitleMedium: 'text-xl font-bold',

  // Card/Component titles
  cardTitle: 'text-xl font-semibold',
  cardTitleLarge: 'text-2xl font-bold',
  cardTitleSmall: 'text-lg font-semibold',

  // Subtitles/Descriptions for sections
  sectionSubtitle: 'text-xl text-muted-foreground',
  sectionSubtitleSmall: 'text-lg text-muted-foreground',

  // Body text
  body: 'text-base text-foreground',
  bodyLarge: 'text-lg',
  bodySmall: 'text-sm',

  // Muted/Secondary text
  muted: 'text-sm text-muted-foreground',
  mutedLarge: 'text-base text-muted-foreground',
  mutedSmall: 'text-xs text-muted-foreground',

  // Code/Monospace
  code: 'font-mono text-sm',
  codeSmall: 'font-mono text-xs',
  codeInline: 'px-1.5 py-0.5 bg-primary/10 rounded font-mono text-sm text-primary',

  // Labels/Badges
  label: 'text-sm font-medium',
  labelSmall: 'text-xs font-medium',

  // Links
  link: 'text-primary hover:underline',
  linkMuted: 'text-muted-foreground hover:text-foreground transition-colors',
} as const

/**
 * Spacing system for consistent margins and padding
 */
export const spacing = {
  // Section spacing
  sectionPadding: 'px-4 py-20',
  sectionPaddingLarge: 'px-4 py-24',
  sectionPaddingSmall: 'px-4 py-16',

  // Container max widths
  containerSm: 'max-w-2xl mx-auto',
  containerMd: 'max-w-4xl mx-auto',
  containerLg: 'max-w-6xl mx-auto',
  containerXl: 'max-w-7xl mx-auto',

  // Card padding
  cardPadding: 'p-6',
  cardPaddingLarge: 'p-8',
  cardPaddingSmall: 'p-4',

  // Vertical spacing between elements
  stackTight: 'space-y-2',
  stackNormal: 'space-y-4',
  stackRelaxed: 'space-y-6',
  stackLoose: 'space-y-8',

  // Margins for headers/sections
  headerMargin: 'mb-12',
  headerMarginSmall: 'mb-8',
  headerMarginLarge: 'mb-16',

  // Element margins
  elementMarginSmall: 'mb-2',
  elementMargin: 'mb-4',
  elementMarginLarge: 'mb-6',
} as const

/**
 * Gradient system for consistent gradient usage
 */
export const gradients = {
  // Primary gradient (purple to blue)
  primary: 'bg-gradient-to-r from-purple-600 to-blue-600',
  primaryLight: 'bg-gradient-to-r from-purple-500 to-blue-500',
  primarySubtle: 'bg-gradient-to-r from-purple-500/10 to-blue-500/10',

  // Text gradients (with bg-clip-text)
  textPrimary: 'bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent',
  textPrimaryLight: 'bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent',

  // Background gradients
  bgPrimary: 'bg-gradient-to-br from-purple-500/5 to-blue-500/5',
  bgPrimaryMedium: 'bg-gradient-to-br from-purple-500/10 to-blue-500/10',
  bgCard: 'bg-gradient-to-br from-purple-500/10 via-card/80 to-blue-500/10',
} as const

/**
 * Border system for consistent borders
 */
export const borders = {
  // Standard borders
  default: 'border border-border',
  subtle: 'border border-border/50',

  // Primary colored borders
  primary: 'border border-primary/20',
  primaryMedium: 'border border-primary/40',
  primaryStrong: 'border-2 border-primary',

  // Specific color borders
  purple: 'border border-purple-500/20',
  purpleMedium: 'border border-purple-500/40',

  // Rounded corners (consistent with existing)
  rounded: 'rounded-2xl',
  roundedLarge: 'rounded-3xl',
  roundedSmall: 'rounded-xl',
  roundedFull: 'rounded-full',
} as const

/**
 * Shadow system
 */
export const shadows = {
  default: 'shadow-lg',
  large: 'shadow-2xl',
  primary: 'shadow-lg shadow-purple-500/20',
  primaryLarge: 'shadow-2xl shadow-purple-500/20',
  hover: 'hover:shadow-xl transition-shadow duration-300',
  hoverPrimary: 'hover:shadow-2xl hover:shadow-purple-500/20 transition-shadow duration-300',
} as const

/**
 * Helper function to combine typography classes with custom classes
 */
export const withTypography = (typoClass: string, customClass?: string) => {
  return cn(typoClass, customClass)
}
