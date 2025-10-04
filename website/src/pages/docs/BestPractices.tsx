import { motion } from 'framer-motion'
import {
  Lightbulb,
  Target,
  Clock,
  Zap,
  Brain,
  Trophy,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const BestPractices = () => {
  const practices = [
    {
      icon: <Clock className="h-6 w-6" />,
      category: 'Daily Habits',
      tips: [
        {
          title: "Start with 'show my progress'",
          description: "Begin each day by saying 'show my progress' or use /p:recap",
          why: 'Instant context without searching through tickets or notes',
        },
        {
          title: 'One task at a time',
          description: 'Use /p:now to view current task, /p:feature to start new ones',
          why: 'Deep work beats multitasking every time',
        },
        {
          title: 'Plan features with value analysis',
          description: "Say 'add feature X' or use /p:feature",
          why: 'Smart prioritization with impact/effort analysis',
        },
        {
          title: 'Ship daily',
          description: "Say 'ship [feature]' or use /p:ship at least once a day",
          why: 'Momentum compounds - celebrate progress',
        },
      ],
    },
    {
      icon: <Target className="h-6 w-6" />,
      category: 'Task Management',
      tips: [
        {
          title: 'Add features with smart breakdown',
          description: 'Use /p:feature - automatically creates max 5 tasks',
          why: 'Automatic breakdown into manageable chunks',
        },
        {
          title: 'Clear task descriptions',
          description: "Be specific: 'implement user login' not 'auth stuff'",
          why: 'Future you will thank current you',
        },
        {
          title: 'Complete before switching',
          description: "Say 'I'm done' before starting new tasks",
          why: 'Clean transitions prevent lost work',
        },
        {
          title: 'Review your queue weekly',
          description: "Say 'what's next?' or use /p:next every Monday",
          why: 'Stay aligned with your goals',
        },
      ],
    },
    {
      icon: <Zap className="h-6 w-6" />,
      category: 'Productivity Boosters',
      tips: [
        {
          title: 'Get help when stuck',
          description: "Say 'I'm stuck on...' after 15 minutes - don't waste hours",
          why: 'Fresh perspective beats prolonged frustration',
        },
        {
          title: 'Batch similar tasks',
          description: 'Group bug fixes, UI updates, or refactoring',
          why: 'Context switching has a cost',
        },
        {
          title: 'Time-box exploration',
          description: 'Set limits for research and experimentation',
          why: 'Perfect is the enemy of shipped',
        },
        {
          title: 'Document decisions',
          description: 'Add context to your commits and shipped features',
          why: 'Your future self needs context',
        },
      ],
    },
  ]

  const antiPatterns = [
    {
      bad: 'Working on multiple tasks simultaneously',
      good: "Focus on one task - say 'I want to start [task]' only when ready",
      icon: <AlertCircle className="h-5 w-5 text-cat-red" />,
    },
    {
      bad: 'Jumping to new tasks without finishing',
      good: "Always say 'I'm done' before starting something new",
      icon: <AlertCircle className="h-5 w-5 text-cat-red" />,
    },
    {
      bad: 'Using prjct as a todo list',
      good: 'Use it for active work tracking',
      icon: <AlertCircle className="h-5 w-5 text-cat-red" />,
    },
    {
      bad: 'Forgetting to celebrate wins',
      good: 'Ship features and acknowledge progress',
      icon: <AlertCircle className="h-5 w-5 text-cat-red" />,
    },
    {
      bad: 'Overcomplicating task descriptions',
      good: 'Keep them clear and actionable',
      icon: <AlertCircle className="h-5 w-5 text-cat-red" />,
    },
  ]

  const workflows = [
    {
      title: 'Morning Routine',
      steps: [
        '/p:recap - See your progress',
        '/p:feature - Add new feature (or continue current)',
        'Deep work session',
        '/p:done - Complete task',
      ],
    },
    {
      title: 'Feature Development',
      steps: [
        '/p:feature - Create with value analysis',
        '/p:done - Complete tasks (auto-progress)',
        '/p:done - Finish remaining tasks',
        '/p:ship - Complete workflow & celebrate',
      ],
    },
    {
      title: 'End of Day',
      steps: [
        '/p:done - Complete current task',
        '/p:ship - Ship if feature complete',
        "/p:progress - Review day's work",
        "/p:next - Check tomorrow's priorities",
      ],
    },
  ]

  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Back Button */}
        <BackToDocsButton />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Maximize Productivity</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Best Practices</h1>
          <p className="text-xl text-muted-foreground">
            Tips and strategies to get the most out of prjct and maintain your shipping momentum.
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
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">{category.icon}</div>
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.tips.map((tip, index) => (
                  <motion.div
                    key={tip.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: categoryIndex * 0.1 + index * 0.05 }}
                    className="rounded-2xl bg-muted/20 p-6 transition-colors hover:bg-muted/30"
                  >
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                      <CheckCircle className="h-5 w-5 text-cat-green" />
                      {tip.title}
                    </h3>
                    <p className="mb-2 text-muted-foreground">{tip.description}</p>
                    <p className="text-sm font-medium text-primary/80">💡 {tip.why}</p>
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
          <h2 className="mb-8 text-3xl font-bold">Proven Workflows</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {workflows.map((workflow, index) => (
              <motion.div
                key={workflow.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-2xl bg-gradient-to-b from-primary/10 to-primary/5 p-6"
              >
                <h3 className="mb-4 text-lg font-semibold">{workflow.title}</h3>
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
          <h2 className="mb-8 text-3xl font-bold">Avoid These Anti-Patterns</h2>
          <div className="space-y-4">
            {antiPatterns.map((pattern, index) => (
              <motion.div
                key={pattern.bad}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="rounded-2xl border border-cat-red/20 bg-cat-maroon/5 p-6"
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
          className="mb-16 rounded-2xl bg-gradient-to-r from-primary/20 to-primary/10 p-8"
        >
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
            <Trophy className="h-6 w-6 text-cat-yellow" />
            Pro Tips from Power Users
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">→</span>
              <span>Create aliases for frequently used commands in your shell</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">→</span>
              <span>Use /p:analyze weekly to understand your codebase evolution</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">→</span>
              <span>Keep your roadmap realistic - 3-5 items max in "Next Up"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">→</span>
              <span>Version control your .prjct/ folder to track project evolution</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary">→</span>
              <span>Review your shipped.md monthly to appreciate your progress</span>
            </li>
          </ul>
        </motion.section>

        {/* Mindset */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="rounded-2xl bg-muted/20 p-8 text-center"
        >
          <Brain className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h2 className="mb-4 text-2xl font-bold">The Right Mindset</h2>
          <p className="mb-4 text-lg text-muted-foreground">
            prjct is not about tracking every minute or logging every thought. It's about
            maintaining focus, shipping consistently, and celebrating progress.
          </p>
          <p className="text-xl font-semibold text-primary">
            Ship small, ship often, ship with pride.
          </p>
        </motion.section>
      </div>
    </div>
  )
}
