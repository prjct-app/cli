import { InteractiveTerminal } from '../components/InteractiveTerminal'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

export const Workflows = () => {
 return (
  <div className="min-h-screen">
   {/* Header */}
   <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-transparent">
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     className="max-w-7xl mx-auto text-center"
    >
     <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
      <Zap className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">Learn by Doing</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      Interactive Workflows
     </h1>
     <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
      Step-by-step guides for real-world scenarios. Click through each workflow to see exactly how prjct works.
     </p>
    </motion.div>
   </section>

   {/* Interactive Terminal Component */}
   <InteractiveTerminal />

   {/* Additional Tips */}
   <section className="py-20 px-4">
    <div className="max-w-4xl mx-auto">
     <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-8"
     >
      <h2 className="text-2xl font-bold mb-4">Pro Tips</h2>
      <div className="space-y-3">
       <div className="flex items-start gap-3">
        <span className="text-primary font-bold">1.</span>
        <p className="text-muted-foreground">
         Start each day with <code className="text-primary">/p:recap</code> to see your progress and current focus
        </p>
       </div>
       <div className="flex items-start gap-3">
        <span className="text-primary font-bold">2.</span>
        <p className="text-muted-foreground">
         Use <code className="text-primary">/p:idea</code> to capture thoughts without breaking your flow
        </p>
       </div>
       <div className="flex items-start gap-3">
        <span className="text-primary font-bold">3.</span>
        <p className="text-muted-foreground">
         Remember: you can only have ONE active task at a time - this is by design to maintain focus
        </p>
       </div>
       <div className="flex items-start gap-3">
        <span className="text-primary font-bold">4.</span>
        <p className="text-muted-foreground">
         Celebrate your wins with <code className="text-primary">/p:ship</code> - it's important to acknowledge progress!
        </p>
       </div>
      </div>
     </motion.div>
    </div>
   </section>
  </div>
 )
}