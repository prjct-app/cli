import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
 Lightbulb,
 CheckCircle,
 HelpCircle,
 BarChart3,
 GitBranch, AlertCircle,
 Zap, BookOpen,
 Terminal
} from 'lucide-react'

interface Scenario {
 id: string
 title: string
 icon: any
 description: string
 commands: {
  command: string
  description: string
  output: string
  preferred?: boolean
 }[]
}

const scenarios: Scenario[] = [
 {
  id: 'new-idea',
  title: 'I have a new idea or unplanned feature',
  icon: Lightbulb,
  description: "Wasn't planned but I want to work on it",
  commands: [
   {
    command: '/p:idea "add dark mode"',
    description: 'Just capture it to not forget',
    output: '💡 Idea saved to ideas.md'
   },
   {
    command: '/p:roadmap add "dark mode"',
    description: 'Add it to the strategic plan',
    output: '📋 Added as priority #3'
   },
   {
    command: '/p:now "implement dark mode"',
    description: 'Start working on it NOW',
    output: '🎯 Current task set',
    preferred: true
   }
  ]
 },
 {
  id: 'task-complete',
  title: "I'm done with what I was doing",
  icon: CheckCircle,
  description: 'How do I mark it complete and what comes next?',
  commands: [
   {
    command: '/p:done',
    description: 'Mark task as completed',
    output: '✅ Complete! Next: API integration',
    preferred: true
   },
   {
    command: '/p:ship "authentication system"',
    description: 'If it is an important feature',
    output: '🚀 SHIPPED! Authentication system 🎉'
   }
  ]
 },
 {
  id: 'lost-context',
  title: "Don't know what to do or what I was working on",
  icon: HelpCircle,
  description: 'Lost context or don\'t know where to start',
  commands: [
   {
    command: '/p:recap',
    description: 'See complete project overview',
    output: '📊 Current: auth | Shipped: 5 | Queue: 3',
    preferred: true
   },
   {
    command: '/p:next',
    description: 'View prioritized task queue',
    output: '1. Fix auth bug\n2. Add tests\n3. Update docs'
   },
   {
    command: '/p:context',
    description: 'Project info and recent actions',
    output: '📚 Sprint 3, Day 12, 67% complete'
   }
  ]
 },
 {
  id: 'stuck-problem',
  title: "I'm stuck with a problem",
  icon: AlertCircle,
  description: 'Have an error or don\'t know how to solve something',
  commands: [
   {
    command: '/p:stuck "CORS error in API"',
    description: 'Get contextual solutions',
    output: '💡 Solution: Add cors middleware\nnpm install cors',
    preferred: true
   },
   {
    command: '/p:fix "undefined is not a function"',
    description: 'Auto-diagnose errors',
    output: '🔧 Check: null/undefined before calling'
   }
  ]
 },
 {
  id: 'check-progress',
  title: 'I want to see my progress',
  icon: BarChart3,
  description: 'How am I doing? What have I achieved?',
  commands: [
   {
    command: '/p:progress week',
    description: 'Weekly metrics',
    output: '📈 Shipped: 7 | Velocity: 1.4/day | Trend: ↗️',
    preferred: true
   },
   {
    command: '/p:progress month',
    description: 'Complete monthly view',
    output: '📊 Features: 23 | Tasks: 87 | Ideas: 42'
   }
  ]
 },
 {
  id: 'git-commit',
  title: 'I need to commit/push changes',
  icon: GitBranch,
  description: 'Save changes to git quickly',
  commands: [
   {
    command: '/p:git',
    description: 'Commit with smart message',
    output: '✅ feat: add payment system',
    preferred: true
   },
   {
    command: '/p:git push',
    description: 'Commit + push to origin',
    output: '🚀 Pushed to origin/main'
   },
   {
    command: '/p:git sync',
    description: 'Full pull + commit + push',
    output: '🔄 Synchronized with remote'
   }
  ]
 }
]

export const CommandGuide = () => {
 const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
 const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

 const handleCopyCommand = (command: string) => {
  navigator.clipboard.writeText(command)
  setCopiedCommand(command)
  setTimeout(() => setCopiedCommand(null), 2000)
 }

 return (
  <section className="py-20 px-4">
   <div className="max-w-7xl mx-auto">
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     viewport={{ once: true }}
     className="text-center mb-12"
    >
     <h2 className="text-4xl md:text-5xl font-bold mb-4">
      Which Command Should I Use When...?
     </h2>
     <p className="text-xl text-muted-foreground">
      Find the perfect command for every situation
     </p>
    </motion.div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
     {scenarios.map((scenario, index) => (
      <motion.div
       key={scenario.id}
       initial={{ opacity: 0, y: 20 }}
       whileInView={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.5, delay: index * 0.1 }}
       viewport={{ once: true }}
       className={`border rounded-2xl p-6 cursor-pointer transition-all hover:shadow-lg ${selectedScenario === scenario.id
        ? 'border-primary bg-primary/5'
        : 'border-border hover:border-primary/50'
        }`}
       onClick={() => setSelectedScenario(
        selectedScenario === scenario.id ? null : scenario.id
       )}
      >
       <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
         <scenario.icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
         <h3 className="font-semibold text-lg mb-2">
          {scenario.title}
         </h3>
         <p className="text-sm text-muted-foreground mb-4">
          {scenario.description}
         </p>

         {selectedScenario === scenario.id && (
          <motion.div
           initial={{ opacity: 0, height: 0 }}
           animate={{ opacity: 1, height: 'auto' }}
           className="space-y-3 mt-4 pt-4 border-t"
          >
           {scenario.commands.map((cmd, cmdIndex) => (
            <div
             key={cmdIndex}
             className={`p-3 rounded-lg ${cmd.preferred
              ? 'bg-primary/10 border border-primary/20'
              : 'bg-muted/50'
              }`}
            >
             {cmd.preferred && (
              <div className="flex items-center gap-1 text-xs text-primary mb-2">
               <Zap className="w-3 h-3" />
               <span>Recommended</span>
              </div>
             )}
             <div className="flex items-center justify-between mb-2">
              <code
               className="text-sm font-mono cursor-pointer hover:text-primary"
               onClick={(e) => {
                e.stopPropagation()
                handleCopyCommand(cmd.command)
               }}
              >
               {cmd.command}
              </code>
              {copiedCommand === cmd.command && (
               <span className="text-xs text-cat-green">Copied!</span>
              )}
             </div>
             <p className="text-xs text-muted-foreground mb-2">
              {cmd.description}
             </p>
             <div className="text-xs font-mono bg-black/50 rounded p-2 text-cat-teal">
              → {cmd.output}
             </div>
            </div>
           ))}
          </motion.div>
         )}
        </div>
       </div>
      </motion.div>
     ))}
    </div>

    {/* Quick Reference Matrix */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     viewport={{ once: true }}
     className="mt-16 p-8 bg-muted/20 rounded-2xl"
    >
     <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
      <Terminal className="w-6 h-6" />
      Quick Decision Matrix
     </h3>
     <div className="overflow-x-auto">
      <table className="w-full text-sm">
       <thead>
        <tr className="border-b">
         <th className="text-left py-2 pr-4">Situation</th>
         <th className="text-left py-2 pr-4">Main Command</th>
         <th className="text-left py-2">Alternatives</th>
        </tr>
       </thead>
       <tbody>
        <tr className="border-b">
         <td className="py-3 pr-4">I have a new idea</td>
         <td className="py-3 pr-4 font-mono text-primary">/p:idea</td>
         <td className="py-3 font-mono text-muted-foreground">/p:roadmap add, /p:now</td>
        </tr>
        <tr className="border-b">
         <td className="py-3 pr-4">Want to start something</td>
         <td className="py-3 pr-4 font-mono text-primary">/p:now</td>
         <td className="py-3 font-mono text-muted-foreground">/p:next to see options</td>
        </tr>
        <tr className="border-b">
         <td className="py-3 pr-4">Finished my task</td>
         <td className="py-3 pr-4 font-mono text-primary">/p:done</td>
         <td className="py-3 font-mono text-muted-foreground">/p:ship if important</td>
        </tr>
        <tr className="border-b">
         <td className="py-3 pr-4">Don't know what to do</td>
         <td className="py-3 pr-4 font-mono text-primary">/p:recap</td>
         <td className="py-3 font-mono text-muted-foreground">/p:next, /p:roadmap</td>
        </tr>
        <tr className="border-b">
         <td className="py-3 pr-4">Have an error</td>
         <td className="py-3 pr-4 font-mono text-primary">/p:stuck</td>
         <td className="py-3 font-mono text-muted-foreground">/p:fix for auto-fix</td>
        </tr>
        <tr className="border-b">
         <td className="py-3 pr-4">Want to plan</td>
         <td className="py-3 pr-4 font-mono text-primary">/p:roadmap</td>
         <td className="py-3 font-mono text-muted-foreground">/p:task to break down</td>
        </tr>
        <tr>
         <td className="py-3 pr-4">Need metrics</td>
         <td className="py-3 pr-4 font-mono text-primary">/p:progress</td>
         <td className="py-3 font-mono text-muted-foreground">/p:recap for overview</td>
        </tr>
       </tbody>
      </table>
     </div>
    </motion.div>

    {/* Workflow Examples */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     viewport={{ once: true }}
     className="mt-12 text-center"
    >
     <Link
      to="/workflows"
      className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
     >
      <BookOpen className="w-5 h-5" />
      See Complete Workflows
     </Link>
    </motion.div>
   </div>
  </section>
 )
}