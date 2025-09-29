import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Home, BookOpen, Terminal as TerminalIcon, HelpCircle, Zap, Github } from 'lucide-react'
import { PrjctLogo } from './Logo'

interface NavItem {
 label: string
 path: string
 icon: React.ReactNode
}

const navItems: NavItem[] = [
 { label: 'Home', path: '/', icon: <Home className="w-4 h-4" /> },
 { label: 'Documentation', path: '/docs', icon: <BookOpen className="w-4 h-4" /> },
 { label: 'Commands', path: '/commands', icon: <TerminalIcon className="w-4 h-4" /> },
 { label: 'Workflows', path: '/workflows', icon: <Zap className="w-4 h-4" /> },
 { label: 'FAQ', path: '/faq', icon: <HelpCircle className="w-4 h-4" /> },
]

export const Navigation = () => {
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
 const location = useLocation()

 const isActive = (path: string) => {
  if (path === '/' && location.pathname !== '/') return false
  return location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
 }

 return (
  <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
   <div className="container mx-auto px-4">
    <div className="flex justify-between items-center h-16">
     {/* Logo */}
     <Link to="/" className="flex items-center">
      <PrjctLogo size="sm" />
     </Link>

     {/* Desktop Navigation */}
     <nav className="hidden md:flex items-center gap-6">
      {navItems.map((item) => (
       <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${isActive(item.path)
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
         }`}
       >
        {item.icon}
        <span>{item.label}</span>
       </Link>
      ))}
     </nav>

     {/* Right side - GitHub & Mobile Menu */}
     <div className="flex items-center gap-3">
      <motion.a
       href="https://github.com/jlopezlira/prjct-cli"
       target="_blank"
       rel="noopener noreferrer"
       initial={{ opacity: 0, y: -20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.5 }}
       className="p-2 rounded-xl hover:bg-muted transition-all"
       aria-label="GitHub repository"
      >
       <Github className="w-5 h-5" />
      </motion.a>

      {/* Mobile Menu Button */}
      <button
       className="md:hidden p-2 rounded-xl hover:bg-muted transition-all"
       onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
       aria-label="Toggle mobile menu"
      >
       {isMobileMenuOpen ? (
        <X className="w-5 h-5" />
       ) : (
        <Menu className="w-5 h-5" />
       )}
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
       className="md:hidden border-t border-border"
      >
       <div className="py-4 space-y-2">
        {navItems.map((item) => (
         <Link
          key={item.path}
          to={item.path}
          onClick={() => setIsMobileMenuOpen(false)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive(item.path)
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
           }`}
         >
          {item.icon}
          <span>{item.label}</span>
         </Link>
        ))}

        {/* GitHub Link in Mobile */}
        <a
         href="https://github.com/jlopezlira/prjct-cli"
         target="_blank"
         rel="noopener noreferrer"
         onClick={() => setIsMobileMenuOpen(false)}
         className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 border-t border-border mt-2 pt-4"
        >
         <Github className="w-5 h-5" />
         <span>GitHub</span>
        </a>
       </div>
      </motion.nav>
     )}
    </AnimatePresence>
   </div>
  </header>
 )
}