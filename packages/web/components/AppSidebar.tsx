'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Settings,
  HelpCircle,
  PanelLeft
} from 'lucide-react'
import { Logo } from './Logo'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card transition-all duration-200',
        isCollapsed ? 'w-14' : 'w-60'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex h-14 items-center border-b border-border',
        isCollapsed ? 'justify-center' : 'justify-between px-3'
      )}>
        {!isCollapsed && (
          <Link href="/">
            <Logo size="xs" showText rounded />
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className={cn(
        'flex-1 overflow-y-auto py-4',
        isCollapsed ? 'px-2' : 'px-3'
      )}>
        <div className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
                  isCollapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                title={isCollapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className={cn(
        'border-t border-border p-3 space-y-1',
        isCollapsed && 'px-2'
      )}>
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
            isCollapsed && 'justify-center px-2',
            pathname === '/settings'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </Link>
        <Link
          href="/help"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
            isCollapsed && 'justify-center px-2',
            pathname === '/help'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={isCollapsed ? 'Help' : undefined}
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Need help?</span>}
        </Link>
      </div>
    </aside>
  )
}
