import { cn } from '@/lib/utils'

interface PrjctLogoProps {
  showText?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const PrjctLogo = ({ showText = true, size = 'md' }: PrjctLogoProps) => {
  const logoSize = {
    sm: 'size-10',
    md: 'size-12',
    lg: 'size-14',
    xl: 'size-16',
  }

  const textSize = {
    sm: 'text-lg',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  const containerTextSize = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  const brandTextSize = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  }

  return (
    <div
      className={cn('flex items-center gap-2', containerTextSize[size])}
      data-testid="prjct-logo"
    >
      <div className="relative">
        <div className="fancy-border"></div>
        <div
          className={cn(
            'relative flex items-center justify-center rounded-lg border border-border bg-foreground text-background shadow-sm',
            logoSize[size]
          )}
          data-testid="prjct-logo-icon"
        >
          <p className={cn('mb-0.5 inline-block font-bold leading-none', textSize[size])}>p/</p>
        </div>
      </div>
      {showText && (
        <span className={cn(brandTextSize[size], 'font-bold text-foreground')}>prjct</span>
      )}
    </div>
  )
}
