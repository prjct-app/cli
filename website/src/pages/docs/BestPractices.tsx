import { motion } from 'framer-motion'
import { Lightbulb, Target, Clock, Zap, Brain, Trophy, AlertCircle, CheckCircle } from 'lucide-react'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const BestPractices = () => {
 const practices = [
  {
   icon: <Clock className="w-6 h-6" />,
   category: "Daily Habits",
   tips: [
    {
     title: "Start with /p:recap",
     description: "Begin each day by checking where you left off",
     why: "Instant context without searching through tickets or notes"
    },
    {
     title: "One task at a time",
     description: "Use /p:now for a single focus, complete it before moving on",
     why: "Deep work beats multitasking every time"
    },
    {
     title: "Capture ideas immediately",
     description: "Use /p:idea the moment inspiration strikes",
     why: "Never lose a thought while maintaining focus"
    },
    {
     title: "Ship daily",
     description: "Use /p:ship at least once a day, even for small wins",
     why: "Momentum compounds - celebrate progress"
    }
   ]
  },
  {
   icon: <Target className="w-6 h-6" />,
   category: "Task Management",
   tips: [
    {
     title: "Break down complex features",
     description: "Use /p:task to split large features into subtasks",
     why: "Manageable chunks = consistent progress"
    },
    {
     title: "Clear task descriptions",
     description: "Be specific: 'implement user login' not 'auth stuff'",
     why: "Future you will thank current you"
    },
    {
     title: "Complete before switching",
     description: "Always /p:done before /p:now with new task",
     why: "Clean transitions prevent lost work"
    },
    {
     title: "Review your queue weekly",
     description: "Check /p:next and /p:roadmap every Monday",
     why: "Stay aligned with your goals"
    }
   ]
  },
  {
   icon: <Zap className="w-6 h-6" />,
   category: "Productivity Boosters",
   tips: [
    {
     title: "Use /p:stuck early",
     description: "Don't waste hours - get help after 15 minutes stuck",
     why: "Fresh perspective beats prolonged frustration"
    },
    {
     title: "Batch similar tasks",
     description: "Group bug fixes, UI updates, or refactoring",
     why: "Context switching has a cost"
    },
    {
     title: "Time-box exploration",
     description: "Set limits for research and experimentation",
     why: "Perfect is the enemy of shipped"
    },
    {
     title: "Document decisions",
     description: "Add context to your commits and shipped features",
     why: "Your future self needs context"
    }
   ]
  }
 ]

 const antiPatterns = [
  {
   bad: "Working on multiple tasks simultaneously",
   good: "Focus on one task until completion",
   icon: <AlertCircle className="w-5 h-5 text-cat-red" />
  },
  {
   bad: "Skipping /p:done and jumping to new tasks",
   good: "Always complete current task first",
   icon: <AlertCircle className="w-5 h-5 text-cat-red" />
  },
  {
   bad: "Using prjct as a todo list",
   good: "Use it for active work tracking",
   icon: <AlertCircle className="w-5 h-5 text-cat-red" />
  },
  {
   bad: "Forgetting to celebrate wins",
   good: "Ship features and acknowledge progress",
   icon: <AlertCircle className="w-5 h-5 text-cat-red" />
  },
  {
   bad: "Overcomplicating task descriptions",
   good: "Keep them clear and actionable",
   icon: <AlertCircle className="w-5 h-5 text-cat-red" />
  }
 ]

 const workflows = [
  {
   title: "Morning Routine",
   steps: [
    "/p:recap - See your progress",
    "/p:now - Confirm or set focus",
    "Deep work session",
    "/p:done - Complete task"
   ]
  },
  {
   title: "Feature Development",
   steps: [
    "/p:task - Break down feature",
    "/p:now - Start first subtask",
    "/p:done - Complete subtask",
    "/p:ship - Celebrate feature"
   ]
  },
  {
   title: "End of Day",
   steps: [
    "/p:done - Complete current",
    "/p:git - Commit changes",
    "/p:progress - Review day",
    "/p:idea - Capture tomorrow's thoughts"
   ]
  }
 ]

 return (
  <div className="min-h-screen py-20 px-4">
   <div className="max-w-4xl mx-auto">
    {/* Back Button */}
    <BackToDocsButton />

    {/* Header */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     className="mb-12"
    >
     <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
      <Lightbulb className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">Maximize Productivity</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      Best Practices
     </h1>
     <p className="text-xl text-muted-foreground">
      Tips and strategies to get the most out of prjct and maintain
      your shipping momentum.
     </p>
    </motion.div>

    {/* Core Practices */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.1 }}
     className="mb-16"
    >
     {practices.map((category, categoryIndex) => (
      <div key={category.category} className="mb-12">
       <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
         {category.icon}
        </div>
        {category.category}
       </h2>
       <div className="space-y-4">
        {category.tips.map((tip, index) => (
         <motion.div
          key={tip.title}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: categoryIndex * 0.1 + index * 0.05 }}
          className="p-6 bg-muted/20 rounded-2xl hover:bg-muted/30 transition-colors"
         >
          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
           <CheckCircle className="w-5 h-5 text-cat-green" />
           {tip.title}
          </h3>
          <p className="text-muted-foreground mb-2">{tip.description}</p>
          <p className="text-sm text-primary/80 font-medium">
           💡 {tip.why}
          </p>
         </motion.div>
        ))}
       </div>
      </div>
     ))}
    </motion.section>

    {/* Common Workflows */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.2 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Proven Workflows</h2>
     <div className="grid md:grid-cols-3 gap-6">
      {workflows.map((workflow, index) => (
       <motion.div
        key={workflow.title}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="p-6 bg-gradient-to-b from-primary/10 to-primary/5 rounded-2xl"
       >
        <h3 className="font-semibold text-lg mb-4">{workflow.title}</h3>
        <ol className="space-y-2">
         {workflow.steps.map((step, stepIndex) => (
          <li key={stepIndex} className="text-sm">
           <span className="font-mono text-primary">{stepIndex + 1}.</span> {step}
          </li>
         ))}
        </ol>
       </motion.div>
      ))}
     </div>
    </motion.section>

    {/* Anti-Patterns */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.3 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Avoid These Anti-Patterns</h2>
     <div className="space-y-4">
      {antiPatterns.map((pattern, index) => (
       <motion.div
        key={pattern.bad}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: index * 0.05 }}
        className="p-6 bg-cat-maroon/5 border border-cat-red/20 rounded-2xl"
       >
        <div className="flex items-start gap-4">
         {pattern.icon}
         <div className="flex-1">
          <div className="mb-2">
           <span className="font-semibold text-cat-red">Don't: </span>
           <span className="text-muted-foreground line-through">{pattern.bad}</span>
          </div>
          <div>
           <span className="font-semibold text-cat-green">Do: </span>
           <span>{pattern.good}</span>
          </div>
         </div>
        </div>
       </motion.div>
      ))}
     </div>
    </motion.section>

    {/* Pro Tips */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.4 }}
     className="mb-16 p-8 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl"
    >
     <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
      <Trophy className="w-6 h-6 text-cat-yellow" />
      Pro Tips from Power Users
     </h2>
     <ul className="space-y-3">
      <li className="flex items-start gap-2">
       <span className="text-primary font-bold">→</span>
       <span>Create aliases for frequently used commands in your shell</span>
      </li>
      <li className="flex items-start gap-2">
       <span className="text-primary font-bold">→</span>
       <span>Use /p:analyze weekly to understand your codebase evolution</span>
      </li>
      <li className="flex items-start gap-2">
       <span className="text-primary font-bold">→</span>
       <span>Keep your roadmap realistic - 3-5 items max in "Next Up"</span>
      </li>
      <li className="flex items-start gap-2">
       <span className="text-primary font-bold">→</span>
       <span>Version control your .prjct/ folder to track project evolution</span>
      </li>
      <li className="flex items-start gap-2">
       <span className="text-primary font-bold">→</span>
       <span>Review your shipped.md monthly to appreciate your progress</span>
      </li>
     </ul>
    </motion.section>

    {/* Mindset */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.5 }}
     className="text-center p-8 bg-muted/20 rounded-2xl"
    >
     <Brain className="w-12 h-12 text-primary mx-auto mb-4" />
     <h2 className="text-2xl font-bold mb-4">The Right Mindset</h2>
     <p className="text-lg text-muted-foreground mb-4">
      prjct is not about tracking every minute or logging every thought.
      It's about maintaining focus, shipping consistently, and celebrating progress.
     </p>
     <p className="text-xl font-semibold text-primary">
      Ship small, ship often, ship with pride.
     </p>
    </motion.section>
   </div>
  </div>
 )
}