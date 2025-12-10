'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Settings,
  HelpCircle,
  Menu,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-border">
        <Link href="/" onClick={onNavigate}>
          <Logo size="xs" showText rounded />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-1">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors min-h-[44px]',
            pathname === '/settings'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Settings</span>
        </Link>
        <Link
          href="/help"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors min-h-[44px]',
            pathname === '/help'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <HelpCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Need help?</span>
        </Link>
      </div>
    </>
  )
}

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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

  // Desktop: Static sidebar
  return (
    <aside className="hidden md:flex h-full w-60 flex-col border-r border-border bg-card">
      <SidebarContent />
    </aside>
  )
}

// Mobile header spacer - use in pages that need top padding for the menu button
export function MobileHeaderSpacer() {
  return <div className="h-16 md:h-0" />
}
