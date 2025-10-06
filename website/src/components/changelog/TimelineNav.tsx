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
        inline: 'center',
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
        behavior: 'smooth',
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
            className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-lg backdrop-blur-md xl:hidden"
          >
            {/* Scroll Container with Snap */}
            <div className="relative">
              {/* Fade Indicators */}
              <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-background/95 to-transparent" />
              <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-background/95 to-transparent" />
              
              <div
                ref={scrollContainerRef}
                className="scrollbar-hide overflow-x-auto scroll-smooth"
                style={{ scrollSnapType: 'x mandatory', touchAction: 'pan-x' }}
              >
                <div className="flex min-w-max items-center gap-3 px-6 py-4">
                {/* Timeline Items - Larger touch targets */}
                {items.map((item, index) => {
                  const isActive = item.id === activeId
                  const isPast = items.findIndex((i) => i.id === activeId) > index

                  return (
                    <motion.button
                      key={item.id}
                      ref={isActive ? activeButtonRef : null}
                      onClick={() => scrollToSection(item.id)}
                      className={`flex min-h-[48px] min-w-[140px] flex-shrink-0 items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                        isActive
                          ? 'border-2 border-primary bg-primary/20 shadow-lg shadow-primary/20'
                          : 'border-2 border-transparent hover:bg-muted/50 active:scale-95'
                      } `}
                      style={{ scrollSnapAlign: 'center' }}
                      whileTap={{ scale: 0.96 }}
                    >
                      {/* Larger Dot */}
                      <div className="relative flex-shrink-0">
                        <motion.div
                          className={`h-5 w-5 rounded-full border-2 transition-all ${
                            isActive
                              ? 'border-primary bg-primary shadow-md shadow-primary/50'
                              : isPast
                                ? 'border-primary bg-primary/30'
                                : 'border-muted-foreground/30 bg-muted'
                          }`}
                          animate={{
                            scale: isActive ? 1.15 : 1,
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
                                ease: 'easeOut',
                              }}
                            />
                          )}
                        </motion.div>
                      </div>

                      {/* Larger Text */}
                      <div className="flex flex-col items-start">
                        <div
                          className={`whitespace-nowrap text-sm font-semibold leading-tight ${
                            isActive ? 'text-primary' : 'text-foreground'
                          }`}
                        >
                          {item.date}
                        </div>
                        <div
                          className={`mt-0.5 text-xs font-medium ${
                            isActive ? 'text-primary/80' : 'text-muted-foreground'
                          }`}
                        >
                          {item.releaseCount} {item.releaseCount === 1 ? 'release' : 'releases'}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}

                {/* Total Stats - Compact */}
                <div className="flex-shrink-0 pl-4 pr-2">
                  <div className="whitespace-nowrap text-xs font-medium text-muted-foreground/70">
                    {items.reduce((sum, item) => sum + item.releaseCount, 0)} total
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-px bg-border/50">
              <motion.div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary/80 shadow-sm"
                initial={{ width: 0 }}
                animate={{
                  width: `${(items.findIndex((item) => item.id === activeId) / (items.length - 1)) * 100}%`,
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
            className="fixed left-8 top-32 z-50 xl:block hidden"
          >
            <div className="min-w-[256px] rounded-2xl border border-border bg-background/90 p-4 shadow-2xl backdrop-blur-md">
              {/* Header */}
              <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Timeline</span>
              </div>

              {/* Timeline Items */}
              <div className="relative">
                {/* Connecting Line - connects between dots, not through them */}
                {items.length > 1 && (
                  <>
                    <div
                      className="absolute left-[11px] w-px bg-border"
                      style={{ 
                        top: '28px', // Start after first dot (mt-1: 4px + h-6: 24px)
                        bottom: '28px' // End before last dot
                      }}
                    />

                    {/* Active Progress Line */}
                    <motion.div
                      className="absolute left-[11px] w-px bg-primary shadow-sm"
                      style={{ top: '28px' }}
                      initial={{ height: 0 }}
                      animate={{
                        height:
                          items.length > 1
                            ? `calc((100% - 56px) * ${items.findIndex((item) => item.id === activeId) / (items.length - 1)})`
                            : '0px',
                      }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </>
                )}

                <div className="relative space-y-4">
                  {items.map((item, index) => {
                    const isActive = item.id === activeId
                    const isPast = items.findIndex((i) => i.id === activeId) > index

                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className="group flex w-full items-start gap-3 text-left"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        {/* Dot */}
                        <div className="relative mt-1 flex-shrink-0">
                          <motion.div
                            className={`h-6 w-6 rounded-full border-2 transition-all ${
                              isActive
                                ? 'border-primary bg-primary shadow-lg shadow-primary/50'
                                : isPast
                                  ? 'border-primary bg-primary/20'
                                  : 'border-border bg-background'
                            }`}
                            animate={{
                              scale: isActive ? 1.2 : 1,
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
                                  ease: 'easeOut',
                                }}
                              />
                            )}
                          </motion.div>
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <motion.div
                            className={`text-sm font-medium transition-colors ${
                              isActive
                                ? 'text-primary'
                                : 'text-muted-foreground group-hover:text-foreground'
                            }`}
                            animate={{
                              x: isActive ? 2 : 0,
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
              <div className="mt-4 border-t border-border pt-3">
                <div className="text-center text-xs text-muted-foreground">
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
