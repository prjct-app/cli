import { motion } from 'framer-motion'

const WorkflowMap = () => {
  return (
    <section className="px-4 py-20 max-w-6xl mx-auto">
      <div className="mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h3 className="mb-4 text-2xl font-bold md:text-3xl">Core Workflow</h3>
          <p className="text-lg text-muted-foreground">
            Five essential commands - zero overhead
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
                One-time setup with automatic repository analysis
              </p>
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:init</code>
            </div>
          </motion.div>

          {/* Step 2: Add Feature */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4 md:flex-row-reverse md:text-right"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">✨</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Add Feature</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Value analysis, roadmap, and task breakdown (max 5 tasks)
              </p>
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                /p:feature "add authentication"
              </code>
            </div>
          </motion.div>

          {/* Step 3: Work on Tasks */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative mb-12 flex items-center gap-4"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Work & Complete</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Tasks auto-start, mark done when finished
              </p>
              <div className="flex flex-wrap gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:done</code>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">/p:next</code>
              </div>
            </div>
          </motion.div>

          {/* Step 4: Ship */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="relative flex items-center gap-4 md:flex-row-reverse md:text-right"
          >
            <div className="z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <span className="text-2xl">🚀</span>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold">Ship & Celebrate</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Complete workflow: lint, test, docs, version, changelog, commit, push
              </p>
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                /p:ship "authentication"
              </code>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default WorkflowMap
