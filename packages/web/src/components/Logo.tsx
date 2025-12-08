import { cn } from '@/lib/utils'

interface LogoProps {
  showText?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  rounded?: boolean
}

export function Logo({ showText = true, size = 'md', rounded = false }: LogoProps) {
  const logoSize = {
    xs: 'size-7',
    sm: 'size-10',
    md: 'size-12',
    lg: 'size-14',
    xl: 'size-16',
  }

  const textSize = {
    xs: 'text-sm',
    sm: 'text-lg',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  const containerTextSize = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  const brandTextSize = {
    xs: 'text-xs',
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
      <div className="relative isolate overflow-visible">
        <div className={cn("fancy-border pointer-events-none", rounded && "rounded-full")}></div>
        <div
          className={cn(
            'relative z-10 flex items-center justify-center border border-border bg-foreground text-background shadow-sm',
            rounded ? 'rounded-full' : 'rounded-lg',
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
