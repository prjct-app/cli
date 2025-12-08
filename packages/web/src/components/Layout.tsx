import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Terminal as TerminalIcon,
  Clock,
  Settings
} from 'lucide-react'
import { Logo } from './Logo'

export function Layout() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-16 border-r border-border flex flex-col items-center py-4 gap-4">
        {/* Logo */}
        <div className="mb-4">
          <Logo size="xs" showText={false} />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-2">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/terminal" icon={TerminalIcon} label="Terminal" />
          <NavItem to="/sessions" icon={Clock} label="Sessions" />
        </nav>

        {/* Settings at bottom */}
        <div className="mt-auto">
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

interface NavItemProps {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`
      }
      title={label}
    >
      <Icon className="w-5 h-5" />
    </NavLink>
  )
}
