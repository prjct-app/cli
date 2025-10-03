import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar } from 'lucide-react'

interface TimelineItem {
  date: string
  releaseCount: number
  id: string
}

interface TimelineNavProps {
  items: TimelineItem[]
}

export const TimelineNav = ({ items }: TimelineNavProps) => {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || '')
  const [isVisible, setIsVisible] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Show timeline after slight delay
    const timer = setTimeout(() => setIsVisible(true), 500)

    // Scroll tracking
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200

      for (let i = items.length - 1; i >= 0; i--) {
        const element = document.getElementById(items[i].id)
        if (element && element.offsetTop <= scrollPosition) {
          setActiveId(items[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [items])

  // Auto-scroll active item into view on mobile
  useEffect(() => {
    if (activeButtonRef.current && scrollContainerRef.current) {
      activeButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  }, [activeId])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 100
      const elementPosition = element.offsetTop - offset
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      })
    }
  }

  return (
    <>
      {/* Mobile Timeline - Horizontal Sticky */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="sticky top-0 z-50 xl:hidden bg-background/95 backdrop-blur-md border-b border-border shadow-lg"
          >
            {/* Scroll Container with Snap */}
            <div
              ref={scrollContainerRef}
              className="overflow-x-auto scrollbar-hide scroll-smooth"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {/* Fade Indicators */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/95 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/95 to-transparent z-10 pointer-events-none" />

              <div className="flex items-center gap-3 px-6 py-4 min-w-max">
                {/* Timeline Items - Larger touch targets */}
                {items.map((item, index) => {
                  const isActive = item.id === activeId
                  const isPast = items.findIndex(i => i.id === activeId) > index

                  return (
                    <motion.button
                      key={item.id}
                      ref={isActive ? activeButtonRef : null}
                      onClick={() => scrollToSection(item.id)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all flex-shrink-0
                        min-h-[48px] min-w-[140px]
                        ${isActive
                          ? 'bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20'
                          : 'border-2 border-transparent hover:bg-muted/50 active:scale-95'
                        }
                      `}
                      style={{ scrollSnapAlign: 'center' }}
                      whileTap={{ scale: 0.96 }}
                    >
                      {/* Larger Dot */}
                      <div className="relative flex-shrink-0">
                        <motion.div
                          className={`w-5 h-5 rounded-full border-2 transition-all ${isActive
                            ? 'border-primary bg-primary shadow-md shadow-primary/50'
                            : isPast
                              ? 'border-primary bg-primary/30'
                              : 'border-muted-foreground/30 bg-muted'
                            }`}
                          animate={{
                            scale: isActive ? 1.15 : 1
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          {isActive && (
                            <motion.div
                              className="absolute inset-0 rounded-full bg-primary"
                              initial={{ scale: 1, opacity: 0.5 }}
                              animate={{ scale: 1.8, opacity: 0 }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeOut'
                              }}
                            />
                          )}
                        </motion.div>
                      </div>

                      {/* Larger Text */}
                      <div className="flex flex-col items-start">
                        <div className={`text-sm font-semibold whitespace-nowrap leading-tight ${isActive ? 'text-primary' : 'text-foreground'
                          }`}>
                          {item.date}
                        </div>
                        <div className={`text-xs font-medium mt-0.5 ${isActive ? 'text-primary/80' : 'text-muted-foreground'
                          }`}>
                          {item.releaseCount} {item.releaseCount === 1 ? 'release' : 'releases'}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}

                {/* Total Stats - Compact */}
                <div className="flex-shrink-0 pl-4 pr-2">
                  <div className="text-xs font-medium text-muted-foreground/70 whitespace-nowrap">
                    {items.reduce((sum, item) => sum + item.releaseCount, 0)} total
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-px bg-border/50 relative">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/80 absolute left-0 top-0 shadow-sm"
                initial={{ width: 0 }}
                animate={{
                  width: `${(items.findIndex(item => item.id === activeId) / (items.length - 1)) * 100}%`
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Timeline - Vertical Fixed */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="fixed left-8 top-1/2 -translate-y-1/2 z-50 hidden xl:block"
          >
            <div className="bg-background/90 backdrop-blur-md border border-border rounded-2xl px-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Timeline</span>
              </div>

              {/* Timeline Items */}
              <div className="relative">
                {/* Connecting Line - starts after first dot, ends before last dot */}
                <div className="absolute left-[11px] top-[28px] w-px bg-border" style={{ height: 'calc(100% - 52px)' }} />

                {/* Active Progress Line */}
                <motion.div
                  className="absolute left-[11px] top-[28px] w-px bg-primary shadow-sm"
                  initial={{ height: 0 }}
                  animate={{
                    height: items.length > 1
                      ? `calc((100% - 52px) * ${items.findIndex(item => item.id === activeId) / (items.length - 1)})`
                      : '0px'
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />

                <div className="space-y-4 relative">
                  {items.map((item, index) => {
                    const isActive = item.id === activeId
                    const isPast = items.findIndex(i => i.id === activeId) > index

                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className="flex items-start gap-3 w-full text-left group"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        {/* Dot */}
                        <div className="relative mt-1 flex-shrink-0">
                          <motion.div
                            className={`w-6 h-6 rounded-full border-2 transition-all ${isActive
                              ? 'border-primary bg-primary shadow-lg shadow-primary/50'
                              : isPast
                                ? 'border-primary bg-primary/20'
                                : 'border-border bg-background'
                              }`}
                            animate={{
                              scale: isActive ? 1.2 : 1
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            {isActive && (
                              <motion.div
                                className="absolute inset-0 rounded-full bg-primary"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: 'easeOut'
                                }}
                              />
                            )}
                          </motion.div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <motion.div
                            className={`text-sm font-medium transition-colors ${isActive
                              ? 'text-primary'
                              : 'text-muted-foreground group-hover:text-foreground'
                              }`}
                            animate={{
                              x: isActive ? 2 : 0
                            }}
                          >
                            {item.date}
                          </motion.div>
                          <div className="text-xs text-muted-foreground">
                            {item.releaseCount} {item.releaseCount === 1 ? 'release' : 'releases'}
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Footer Stats */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground text-center">
                  {items.reduce((sum, item) => sum + item.releaseCount, 0)} total releases
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
