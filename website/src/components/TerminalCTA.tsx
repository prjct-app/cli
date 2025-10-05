import { motion } from 'framer-motion'
import { Play, Terminal as TerminalIcon } from 'lucide-react'
import { useState } from 'react'
import { TerminalDrawer } from './TerminalDrawer'
import { TerminalContent } from './Terminal'

export const TerminalCTA = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  return (
    <>
      <section className="bg-muted/20 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold md:text-5xl">See It In Action</h2>
            <p className="text-lg text-muted-foreground">
              From installation to shipping - watch the complete prjct flow
            </p>
          </motion.div>

          {/* CTA Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-12 shadow-2xl backdrop-blur-md"
          >
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5 opacity-60" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(168,85,247,0.1),transparent)]" />

            <div className="relative">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
                viewport={{ once: true }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20"
              >
                <TerminalIcon className="h-7 w-7 text-purple-500" />
              </motion.div>

              {/* Text */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                viewport={{ once: true }}
                className="mb-8 text-center"
              >
                <h3 className="mb-3 text-3xl font-bold">
                  <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    Watch the Complete Flow
                  </span>
                </h3>
                <p className="mx-auto max-w-md text-muted-foreground">
                  Interactive demo from{' '}
                  <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                    npm install
                  </code>{' '}
                  to{' '}
                  <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                    prjct ship
                  </code>
                </p>
              </motion.div>

              {/* Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <motion.button
                  onClick={() => setIsDrawerOpen(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-8 py-4 font-medium text-white transition-all duration-300"
                >
                  <Play className="h-5 w-5" />
                  <span>Launch Interactive Demo</span>
                </motion.button>
              </motion.div>

              {/* Hint */}
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                viewport={{ once: true }}
                className="mt-4 text-center text-xs text-muted-foreground"
              >
                Opens in a terminal-style drawer ↓
              </motion.p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Terminal Drawer */}
      <TerminalDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <TerminalContent />
      </TerminalDrawer>
    </>
  )
}
