import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  X,
  Home,
  BookOpen,
  Terminal as TerminalIcon,
  HelpCircle,
  Sparkles,
  Zap,
} from 'lucide-react'
import { PrjctLogo } from './Logo'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/', icon: <Home className="h-4 w-4" /> },
  { label: 'Docs', path: '/docs', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Commands', path: '/commands', icon: <TerminalIcon className="h-4 w-4" /> },
  { label: 'Workflows', path: '/workflows', icon: <Sparkles className="h-4 w-4" /> },
  { label: 'Windsurf Extension', path: '/windsurf-extension', icon: <Zap className="h-4 w-4" /> },
  { label: 'FAQ', path: '/faq', icon: <HelpCircle className="h-4 w-4" /> },
]

export const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <PrjctLogo size="sm" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-4 lg:flex w-full">
            {navItems.map((item, index) => (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <Link
                  to={item.path}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                    isActive(item.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </motion.div>
            ))}
          </nav>

          {/* Right side - Mobile Menu */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              className="rounded-xl p-2 transition-all hover:bg-muted lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-border lg:hidden"
            >
              <div className="space-y-2 py-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                      isActive(item.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
