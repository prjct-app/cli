'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Settings,
  HelpCircle,
  Menu,
  PanelLeft,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
]

function SidebarContent({
  onNavigate,
  isCollapsed = false,
  onToggleCollapse
}: {
  onNavigate?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const pathname = usePathname()

  return (
    <>
      {/* Header */}
      <div className={cn(
        "flex h-14 items-center border-b border-border",
        isCollapsed ? "justify-center px-2" : "justify-between px-3"
      )}>
        {!isCollapsed && (
          <Link href="/" onClick={onNavigate}>
            <Logo size="xs" showText rounded />
          </Link>
        )}
        {onToggleCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Expand" : "Collapse"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto py-4", isCollapsed ? "px-2" : "px-3")}>
        <div className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            const linkContent = (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center rounded-md transition-colors min-h-[44px]',
                  isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  'py-2.5',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
              </Link>
            )

            if (isCollapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            }
            return linkContent
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-border space-y-1", isCollapsed ? "p-2" : "p-3")}>
        {[
          { href: '/settings', icon: Settings, label: 'Settings' },
          { href: '/help', icon: HelpCircle, label: 'Need help?' }
        ].map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          const linkContent = (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center rounded-md transition-colors min-h-[44px]',
                isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                'py-2.5',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          )

          if (isCollapsed) {
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            )
          }
          return linkContent
        })}
      </div>
    </>
  )
}

const SIDEBAR_COLLAPSED_KEY = 'prjct-sidebar-collapsed'

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
  }, [])

  // Persist collapsed state to localStorage
  const handleToggleCollapse = () => {
    const newValue = !isCollapsed
    setIsCollapsed(newValue)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue))
  }

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Mobile: Sheet/Drawer
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed top-3 left-3 z-50 h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SidebarContent onNavigate={() => setIsOpen(false)} />
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Collapsible sidebar
  return (
    <aside className={cn(
      "hidden md:flex h-full flex-col border-r border-border bg-card transition-all duration-200",
      isCollapsed ? "w-14" : "w-60"
    )}>
      <SidebarContent
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
    </aside>
  )
}

// Mobile header spacer - use in pages that need top padding for the menu button
export function MobileHeaderSpacer() {
  return <div className="h-16 md:h-0" />
}
