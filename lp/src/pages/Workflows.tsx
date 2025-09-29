import { InteractiveTerminal } from '../components/InteractiveTerminal'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

export const Workflows = () => {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-7xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Learn by Doing</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Interactive Workflows</h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Step-by-step guides for real-world scenarios. Click through each workflow to see exactly
            how prjct works.
          </p>
        </motion.div>
      </section>

      {/* Interactive Terminal Component */}
      <InteractiveTerminal />

      {/* Additional Tips */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 p-8"
          >
            <h2 className="mb-4 text-2xl font-bold">Pro Tips</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary">1.</span>
                <p className="text-muted-foreground">
                  Start each day with <code className="text-primary">/p:recap</code> to see your
                  progress and current focus
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary">2.</span>
                <p className="text-muted-foreground">
                  Use <code className="text-primary">/p:idea</code> to capture thoughts without
                  breaking your flow
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary">3.</span>
                <p className="text-muted-foreground">
                  Remember: you can only have ONE active task at a time - this is by design to
                  maintain focus
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-primary">4.</span>
                <p className="text-muted-foreground">
                  Celebrate your wins with <code className="text-primary">/p:ship</code> - it's
                  important to acknowledge progress!
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
