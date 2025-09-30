import { motion } from 'framer-motion'

const WorkflowMap = () => {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Your Workflow, Simplified</h2>
          <p className="text-lg text-muted-foreground">
            From idea to shipped feature - no project management overhead
          </p>
        </motion.div>

        {/* Simple Linear Flow */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute bottom-0 left-8 top-0 w-0.5 bg-border md:left-1/2 md:-translate-x-1/2" />

          {/* Step 1: Initialize */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">🚀</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Initialize Your Project</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Start tracking your progress instantly
              </p>
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:init</code>
            </div>
          </motion.div>

          {/* Step 2: Capture */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4 md:flex-row-reverse md:text-right"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">💡</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Capture Ideas</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Never lose a thought - AI remembers everything
              </p>
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                /p:idea "your brilliant idea"
              </code>
            </div>
          </motion.div>

          {/* Step 3: Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">🗺️</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Generate Roadmap</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                AI creates actionable technical tasks
              </p>
              <div className="flex flex-wrap gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:roadmap</code>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:next</code>
              </div>
            </div>
          </motion.div>

          {/* Step 4: Execute */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4 md:flex-row-reverse md:text-right"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Focus & Execute</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                One task at a time, no context switching
              </p>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  /p:now "current task"
                </code>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:task</code>
              </div>
            </div>
          </motion.div>

          {/* Step 5: Overcome */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">🛠️</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Get Unstuck</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                AI helps you overcome any blocker
              </p>
              <div className="flex flex-wrap gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:stuck</code>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:fix</code>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:analyze</code>
              </div>
            </div>
          </motion.div>

          {/* Step 6: Ship */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4 md:flex-row-reverse md:text-right"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <span className="text-2xl">🎉</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Ship & Celebrate</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Complete features and track your wins
              </p>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:done</code>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:ship</code>
              </div>
            </div>
          </motion.div>

          {/* Step 7: Review */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            viewport={{ once: true }}
            className="relative flex items-center gap-4"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">📊</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Track Progress</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                See your velocity and celebrate momentum
              </p>
              <div className="flex flex-wrap gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:progress</code>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:recap</code>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default WorkflowMap
