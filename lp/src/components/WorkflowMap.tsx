import { motion } from 'framer-motion'

const WorkflowMap = () => {
 return (
  <section className="py-20 px-4">
   <div className="max-w-4xl mx-auto">
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     viewport={{ once: true }}
     className="text-center mb-16"
    >
     <h2 className="text-3xl md:text-4xl font-bold mb-4">
      Your Workflow, Simplified
     </h2>
     <p className="text-lg text-muted-foreground">
      From idea to shipped feature - no project management overhead
     </p>
    </motion.div>

    {/* Simple Linear Flow */}
    <div className="relative">
     {/* Connection Line */}
     <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-border md:-translate-x-1/2" />

     {/* Step 1: Initialize */}
     <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="relative flex items-center gap-4 mb-12"
     >
      <div className="w-16 h-16 bg-card border-2 border-border rounded-full flex items-center justify-center z-10 shrink-0">
       <span className="text-2xl">🚀</span>
      </div>
      <div className="flex-1">
       <h3 className="font-semibold text-lg mb-1">Initialize Your Project</h3>
       <p className="text-muted-foreground text-sm mb-2">Start tracking your progress instantly</p>
       <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:init</code>
      </div>
     </motion.div>

     {/* Step 2: Capture */}
     <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      viewport={{ once: true }}
      className="relative flex items-center gap-4 mb-12 md:flex-row-reverse md:text-right"
     >
      <div className="w-16 h-16 bg-card border-2 border-border rounded-full flex items-center justify-center z-10 shrink-0">
       <span className="text-2xl">💡</span>
      </div>
      <div className="flex-1">
       <h3 className="font-semibold text-lg mb-1">Capture Ideas</h3>
       <p className="text-muted-foreground text-sm mb-2">Never lose a thought - AI remembers everything</p>
       <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:idea "your brilliant idea"</code>
      </div>
     </motion.div>

     {/* Step 3: Plan */}
     <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      viewport={{ once: true }}
      className="relative flex items-center gap-4 mb-12"
     >
      <div className="w-16 h-16 bg-card border-2 border-border rounded-full flex items-center justify-center z-10 shrink-0">
       <span className="text-2xl">🗺️</span>
      </div>
      <div className="flex-1">
       <h3 className="font-semibold text-lg mb-1">Generate Roadmap</h3>
       <p className="text-muted-foreground text-sm mb-2">AI creates actionable technical tasks</p>
       <div className="flex gap-2 flex-wrap">
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:roadmap</code>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:next</code>
       </div>
      </div>
     </motion.div>

     {/* Step 4: Execute */}
     <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      viewport={{ once: true }}
      className="relative flex items-center gap-4 mb-12 md:flex-row-reverse md:text-right"
     >
      <div className="w-16 h-16 bg-card border-2 border-border rounded-full flex items-center justify-center z-10 shrink-0">
       <span className="text-2xl">⚡</span>
      </div>
      <div className="flex-1">
       <h3 className="font-semibold text-lg mb-1">Focus & Execute</h3>
       <p className="text-muted-foreground text-sm mb-2">One task at a time, no context switching</p>
       <div className="flex gap-2 flex-wrap md:justify-end">
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:now "current task"</code>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:task</code>
       </div>
      </div>
     </motion.div>

     {/* Step 5: Overcome */}
     <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      viewport={{ once: true }}
      className="relative flex items-center gap-4 mb-12"
     >
      <div className="w-16 h-16 bg-card border-2 border-border rounded-full flex items-center justify-center z-10 shrink-0">
       <span className="text-2xl">🛠️</span>
      </div>
      <div className="flex-1">
       <h3 className="font-semibold text-lg mb-1">Get Unstuck</h3>
       <p className="text-muted-foreground text-sm mb-2">AI helps you overcome any blocker</p>
       <div className="flex gap-2 flex-wrap">
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:stuck</code>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:fix</code>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:analyze</code>
       </div>
      </div>
     </motion.div>

     {/* Step 6: Ship */}
     <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      viewport={{ once: true }}
      className="relative flex items-center gap-4 mb-12 md:flex-row-reverse md:text-right"
     >
      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center z-10 shrink-0">
       <span className="text-2xl">🎉</span>
      </div>
      <div className="flex-1">
       <h3 className="font-semibold text-lg mb-1">Ship & Celebrate</h3>
       <p className="text-muted-foreground text-sm mb-2">Complete features and track your wins</p>
       <div className="flex gap-2 flex-wrap md:justify-end">
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:done</code>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:ship</code>
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
      <div className="w-16 h-16 bg-card border-2 border-border rounded-full flex items-center justify-center z-10 shrink-0">
       <span className="text-2xl">📊</span>
      </div>
      <div className="flex-1">
       <h3 className="font-semibold text-lg mb-1">Track Progress</h3>
       <p className="text-muted-foreground text-sm mb-2">See your velocity and celebrate momentum</p>
       <div className="flex gap-2 flex-wrap">
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:progress</code>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/p:recap</code>
       </div>
      </div>
     </motion.div>
    </div>
   </div>
  </section>
 )
}

export default WorkflowMap