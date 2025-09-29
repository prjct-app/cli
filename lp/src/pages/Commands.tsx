import { CommandGuide } from '../components/CommandGuide'
import { motion } from 'framer-motion'
import { Terminal, Zap, GitBranch, Target, Lightbulb, BarChart3 } from 'lucide-react'

const commandCategories = [
 {
  title: 'Work Commands',
  icon: <Target className="w-5 h-5" />,
  commands: [
   { cmd: '/p:now [task]', desc: 'Set or show current task' },
   { cmd: '/p:next', desc: 'Show priority queue' },
   { cmd: '/p:done', desc: 'Complete current task' },
   { cmd: '/p:ship <feature>', desc: 'Ship and celebrate a feature' },
  ],
 },
 {
  title: 'Planning Commands',
  icon: <Lightbulb className="w-5 h-5" />,
  commands: [
   { cmd: '/p:idea <text>', desc: 'Capture ideas quickly' },
   { cmd: '/p:roadmap', desc: 'View strategic roadmap' },
   { cmd: '/p:roadmap add', desc: 'Add feature to roadmap' },
   { cmd: '/p:task <feature>', desc: 'Break down complex tasks' },
  ],
 },
 {
  title: 'Progress Commands',
  icon: <BarChart3 className="w-5 h-5" />,
  commands: [
   { cmd: '/p:recap', desc: 'Overview of progress' },
   { cmd: '/p:progress [period]', desc: 'Show progress metrics' },
   { cmd: '/p:context', desc: 'Show project context' },
  ],
 },
 {
  title: 'Git Integration',
  icon: <GitBranch className="w-5 h-5" />,
  commands: [
   { cmd: '/p:git', desc: 'Commit with smart message' },
   { cmd: '/p:git push', desc: 'Commit and push' },
   { cmd: '/p:git sync', desc: 'Pull, commit, and push' },
  ],
 },
 {
  title: 'Help Commands',
  icon: <Zap className="w-5 h-5" />,
  commands: [
   { cmd: '/p:stuck <issue>', desc: 'Get help with problems' },
   { cmd: '/p:fix <error>', desc: 'Auto-diagnose errors' },
   { cmd: '/p:analyze', desc: 'Analyze repository' },
   { cmd: '/p:init', desc: 'Initialize project' },
  ],
 },
]

export const Commands = () => {
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
      <Terminal className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">Complete Command Reference</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      All prjct Commands
     </h1>
     <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
      Master every command to maximize your productivity
     </p>
    </motion.div>
   </section>

   {/* Command Categories */}
   <section className="py-12 px-4">
    <div className="max-w-7xl mx-auto">
     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {commandCategories.map((category, index) => (
       <motion.div
        key={category.title}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="border border-border rounded-2xl p-6 hover:shadow-lg transition-all hover:border-primary/50"
       >
        <div className="flex items-center gap-3 mb-4">
         <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {category.icon}
         </div>
         <h2 className="text-xl font-semibold">{category.title}</h2>
        </div>
        <div className="space-y-3">
         {category.commands.map((command) => (
          <div key={command.cmd} className="flex flex-col">
           <code className="font-mono text-sm text-primary mb-1">
            {command.cmd}
           </code>
           <span className="text-sm text-muted-foreground">
            {command.desc}
           </span>
          </div>
         ))}
        </div>
       </motion.div>
      ))}
     </div>
    </div>
   </section>

   {/* Command Guide Component */}
   <CommandGuide />
  </div>
 )
}