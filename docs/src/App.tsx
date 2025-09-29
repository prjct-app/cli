import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { Compatibility } from './components/Compatibility'
import { Terminal } from './components/Terminal'
import { ForIndies } from './components/ForIndies'
import { FAQ } from './components/FAQ'
import { Footer } from './components/Footer'
import { PrjctLogo } from './components/Logo'
import WindsurfExtension from './components/WindsurfExtension'

function App() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors">
      <header className="container mx-auto flex justify-between items-center py-6">
        <PrjctLogo />
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => setIsDark(!isDark)}
          className="bg-card  rounded-xl hover:scale-110 transition-transform"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5 text-foreground" />
          )}
        </motion.button>
      </header>
      {/* Main Content */}
      <Hero />
      <Terminal />
      <Features />
      <Compatibility />
      <WindsurfExtension />
      <ForIndies />
      <FAQ />
      <Footer />

      {/* Scroll to top indicator */}
      <motion.div
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <div className="w-6 h-10 border-2 border-muted-foreground rounded-full flex justify-center">
          <motion.div
            className="w-1.5 h-3 bg-muted-foreground rounded-full mt-2"
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        </div>
      </motion.div>
    </main>
  )
}

export default App