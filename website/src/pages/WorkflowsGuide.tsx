import { motion } from 'framer-motion'
import {
  Sparkles,
  Zap,
  ArrowRight,
  CheckCircle,
  Code,
  FileText,
  GitBranch,
  Clock,
  Terminal as TerminalIcon,
  Rocket,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

// Terminal configurations for workflow demos
const workflowTerminalConfigs = [
  {
    name: 'Complete Feature Workflow',
    commands: [
      {
        cmd: '/p:feature "user authentication system"',
        output: '✨ Analyzing feature value...',
        delay: 600,
      },
      {
        cmd: '',
        output:
          '\n📊 VALUE ANALYSIS\n━━━━━━━━━━━━━\nImpact: HIGH (core functionality)\nEffort: 8 hours\nTiming: Start now\n\nROADMAP POSITION: Critical Path\nBLOCKS: None\nBLOCKED BY: None',
        delay: 1000,
      },
      {
        cmd: '',
        output:
          '\n📋 TASK BREAKDOWN\n━━━━━━━━━━━━━━━━\n  1. Design auth flow & database schema\n  2. Implement JWT token generation\n  3. Create login/signup endpoints\n  4. Add password hashing & validation\n  5. Write integration tests',
        delay: 900,
      },
      {
        cmd: '',
        output:
          '\n🚀 AUTO-STARTING TASK 1...\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 Task: Design auth flow & database schema\n⏱️  Started: 2:30 PM',
        delay: 700,
      },
      {
        cmd: '',
        output:
          '\n💡 Next steps:\n  • Work on task 1\n  • Say "p. I\'m done" when complete\n  • Tasks auto-progress',
        delay: 500,
      },
    ],
  },
  {
    name: 'Task Progression Flow',
    commands: [
      {
        cmd: '/p:done',
        output: '✅ Task complete: Design auth flow\n━━━━━━━━━━━━━━━━━━━━━━━━━━',
        delay: 600,
      },
      { cmd: '', output: '⏱️  Duration: 1h 25m\n📊 Progress: 20% (1/5)', delay: 500 },
      { cmd: '', output: '\n💡 AUTO-STARTING NEXT TASK...\n━━━━━━━━━━━━━━━━━━━━━━━━', delay: 600 },
      {
        cmd: '',
        output: '🎯 Task 2: Implement JWT token generation\n⏱️  Started: 3:55 PM',
        delay: 700,
      },
      {
        cmd: '',
        output:
          '\n🔄 Keep shipping!\n  • Current: Task 2/5\n  • Remaining: ~6h 35m\n  • Just say "p. done" when ready',
        delay: 500,
      },
    ],
  },
  {
    name: 'Complete & Ship Workflow',
    commands: [
      {
        cmd: '/p:done',
        output: '✅ Task complete: Write integration tests\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        delay: 600,
      },
      {
        cmd: '',
        output:
          '🎉 ALL TASKS COMPLETE!\n━━━━━━━━━━━━━━━━━━\n📊 Completed: 5/5 tasks\n⏱️  Total time: 7h 45m\n✨ Feature ready to ship!',
        delay: 1000,
      },
      { cmd: '', output: '\n💡 Next step: /p:ship "user authentication"', delay: 500 },
      {
        cmd: '/p:ship "user authentication"',
        output: '🚀 SHIPPING: User Authentication\n━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        delay: 700,
      },
      {
        cmd: '',
        output:
          '\nAutomated Workflow:\n  ✅ Lint checks: passed\n  ✅ Tests: 24 passing\n  ✅ Docs: updated\n  ✅ Version: 1.2.0 → 1.3.0\n  ✅ CHANGELOG: updated\n  ✅ Git commit: created\n  ✅ Git push: completed',
        delay: 1200,
      },
      {
        cmd: '',
        output:
          '\n🎊 SHIPPED!\n━━━━━━━━━━\n📦 Feature: User Authentication\n⏱️  Total: 7h 45m\n🏆 Impact: HIGH\n\n💡 Recommendation: Compact conversation',
        delay: 800,
      },
    ],
  },
]

export const WorkflowsGuide = () => {
  const [currentTerminalIndex, setCurrentTerminalIndex] = useState<number>(0)
  const [currentLine, setCurrentLine] = useState(0)
  const [displayedCommands, setDisplayedCommands] = useState<
    (typeof workflowTerminalConfigs)[0]['commands']
  >([])
  const [isTyping, setIsTyping] = useState(false)

  const currentTerminal = workflowTerminalConfigs[currentTerminalIndex]
  const commands = currentTerminal.commands

  useEffect(() => {
    if (currentLine < commands.length) {
      const timer = setTimeout(
        () => {
          setIsTyping(true)
          setTimeout(() => {
            setDisplayedCommands((prev) => [...prev, commands[currentLine]])
            setCurrentLine(currentLine + 1)
            setIsTyping(false)
          }, commands[currentLine].delay)
        },
        currentLine === 0 ? 1000 : 2000
      )

      return () => clearTimeout(timer)
    } else if (currentLine === commands.length) {
      setTimeout(() => {
        setDisplayedCommands([])
        setCurrentLine(0)
        setCurrentTerminalIndex((prev) => (prev + 1) % workflowTerminalConfigs.length)
      }, 15000)
    }
  }, [currentLine, commands])

  const workflowSteps = [
    {
      number: 1,
      icon: <Sparkles className="h-8 w-8" />,
      title: 'Create Feature',
      command: '/p:feature "description"',
      description: 'Value analysis + roadmap + task breakdown + auto-start',
      color: 'from-cat-mauve/20 to-cat-mauve/5',
      borderColor: 'border-cat-mauve/30',
      features: [
        'Value analysis (impact/effort/timing)',
        'Roadmap positioning',
        'Task breakdown (as many as needed)',
        'Auto-start first task',
      ],
    },
    {
      number: 2,
      icon: <Zap className="h-8 w-8" />,
      title: 'Complete Tasks',
      command: '/p:done',
      description: 'Mark complete, auto-start next task',
      color: 'from-cat-blue/20 to-cat-blue/5',
      borderColor: 'border-cat-blue/30',
      features: [
        'Tracks actual time spent',
        'Updates progress percentage',
        'Auto-starts next task',
        'No manual switching needed',
      ],
    },
    {
      number: 3,
      icon: <Rocket className="h-8 w-8" />,
      title: 'Ship Feature',
      command: '/p:ship "feature"',
      description: 'Complete automated workflow',
      color: 'from-cat-green/20 to-cat-green/5',
      borderColor: 'border-cat-green/30',
      features: [
        'Lint → Test → Docs',
        'Version bump + CHANGELOG',
        'Git commit + push',
        'Conversation compact recommendation',
      ],
    },
  ]

  const benefits = [
    {
      icon: <Target className="h-6 w-6" />,
      title: 'Value-Driven',
      description: 'Every feature starts with impact/effort analysis',
      stat: '3x better prioritization',
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: 'Auto-Progression',
      description: 'Tasks automatically move to next on completion',
      stat: 'Zero context switching',
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: 'Time Tracking',
      description: 'Automatic tracking of actual time spent',
      stat: 'Real velocity metrics',
    },
    {
      icon: <GitBranch className="h-6 w-6" />,
      title: 'Git Validation',
      description: 'Last commit as source of truth',
      stat: 'No fake progress',
    },
  ]

  return (
    <div className="min-h-screen px-4 py-20">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto mb-20 max-w-6xl text-center"
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Ship Fast</span>
        </div>

        <h1 className="mb-6 text-5xl font-bold md:text-6xl">Feature → Done → Ship</h1>

        <p className="mx-auto mb-8 max-w-3xl text-xl text-muted-foreground">
          The simplified 3-command workflow: create features with value analysis, complete tasks
          with auto-progression, ship with automated Git workflow.
        </p>
      </motion.div>

      {/* The Workflow */}
      <section className="mx-auto mb-20 max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-bold">The Complete Workflow</h2>

        <div className="grid gap-8 md:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div
                className={`h-full rounded-2xl border-2 p-6 ${step.borderColor} bg-gradient-to-br ${step.color}`}
              >
                {/* Step Number */}
                <div className="absolute -left-4 -top-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-lg">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="mb-4 text-primary">{step.icon}</div>

                {/* Title & Command */}
                <h3 className="mb-2 text-2xl font-bold">{step.title}</h3>
                <code className="mb-3 block rounded bg-black/20 px-3 py-2 font-mono text-sm text-primary">
                  {step.command}
                </code>

                {/* Description */}
                <p className="mb-4 text-sm text-muted-foreground">{step.description}</p>

                {/* Features */}
                <ul className="space-y-2">
                  {step.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-cat-green" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Arrow */}
              {index < workflowSteps.length - 1 && (
                <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                  <ArrowRight className="h-8 w-8 text-primary" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Interactive Terminal Demo */}
      <section className="mx-auto mb-20 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold">See It In Action</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Watch the complete workflow in action - from feature creation to shipping
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-gray-800 bg-black p-8 shadow-2xl"
        >
          <div className="mb-6 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-cat-maroon" />
            <div className="h-3 w-3 rounded-full bg-cat-yellow" />
            <div className="h-3 w-3 rounded-full bg-cat-green" />
            <span className="ml-4 font-mono text-sm text-gray-400">{currentTerminal.name}</span>
          </div>

          <div className="min-h-[400px] space-y-3 font-mono text-sm md:text-base">
            {displayedCommands.map((command, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                {command.cmd && (
                  <div className="text-gray-400">
                    <span className="text-cat-teal">$</span> {command.cmd}
                  </div>
                )}
                <div
                  className={`${command.cmd ? 'ml-4 mt-1' : ''} whitespace-pre-line text-gray-300`}
                >
                  {command.output}
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-400"
              >
                <span className="text-cat-teal">$</span>
                <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-cat-teal" />
              </motion.div>
            )}
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            💡 Demo cycles through different workflow stages automatically
          </p>
        </div>
      </section>

      {/* Key Features */}
      <section className="mx-auto mb-20 max-w-6xl">
        <h2 className="mb-8 text-center text-3xl font-bold">What Makes This Different</h2>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Value Analysis */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-background p-8">
            <div className="mb-4 flex items-start gap-4">
              <div className="rounded-lg bg-primary/20 p-3 text-primary">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold">Value Analysis</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Every feature starts with impact/effort/timing analysis. No more building the
                  wrong things.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div className="text-cat-green">📊 VALUE ANALYSIS</div>
              <div className="mt-2 text-gray-400">
                <div>Impact: HIGH (core feature)</div>
                <div>Effort: 8 hours</div>
                <div>Timing: Start now</div>
                <div className="mt-2 text-cat-mauve">→ Strategic prioritization</div>
              </div>
            </div>
          </div>

          {/* Smart Task Breakdown */}
          <div className="rounded-2xl border border-cat-blue/30 bg-gradient-to-br from-cat-blue/10 to-background p-8">
            <div className="mb-4 flex items-start gap-4">
              <div className="rounded-lg bg-cat-blue/20 p-3 text-cat-blue">
                <Code className="h-6 w-6" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold">Smart Task Breakdown</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Automatically breaks features into logical tasks. As many as needed.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div className="text-cat-blue">📋 TASKS</div>
              <div className="mt-2 text-gray-400">
                <div>1. Design architecture</div>
                <div>2. Implement core logic</div>
                <div>3. Add error handling</div>
                <div>4. Write tests</div>
                <div>5. Update docs</div>
                <div className="mt-1 text-gray-500">... (as many as needed)</div>
              </div>
            </div>
          </div>

          {/* Auto-Progression */}
          <div className="rounded-2xl border border-cat-green/30 bg-gradient-to-br from-cat-green/10 to-background p-8">
            <div className="mb-4 flex items-start gap-4">
              <div className="rounded-lg bg-cat-green/20 p-3 text-cat-green">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold">Auto-Progression</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Say "p. done" and the next task automatically starts. Zero context switching.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div className="text-cat-green">✅ Task complete</div>
              <div className="mt-2 text-gray-400">
                <div>⏱️ Duration: 1h 25m</div>
                <div>📊 Progress: 40% (2/5)</div>
                <div className="mt-2 text-cat-teal">🚀 Auto-starting next...</div>
              </div>
            </div>
          </div>

          {/* Automated Shipping */}
          <div className="rounded-2xl border border-cat-yellow/30 bg-gradient-to-br from-cat-yellow/10 to-background p-8">
            <div className="mb-4 flex items-start gap-4">
              <div className="rounded-lg bg-cat-yellow/20 p-3 text-cat-yellow">
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold">Automated Shipping</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  /p:ship runs the complete workflow: lint, test, docs, version, commit, push.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div className="text-cat-yellow">🚀 Shipping...</div>
              <div className="mt-2 text-gray-400">
                <div>✅ Lint: passed</div>
                <div>✅ Tests: 24 passing</div>
                <div>✅ Git: committed + pushed</div>
                <div className="mt-2 text-cat-green">🎊 SHIPPED!</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto mb-20 max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-bold">Why This Works</h2>

        <div className="grid gap-6 md:grid-cols-4">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="rounded-xl bg-muted/20 p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                {benefit.icon}
              </div>
              <h3 className="mb-2 font-bold">{benefit.title}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{benefit.description}</p>
              <div className="inline-block rounded-full bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
                {benefit.stat}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Natural Language */}
      <section className="mx-auto mb-20 max-w-6xl">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/20 to-primary/10 p-8">
          <h2 className="mb-4 text-center text-2xl font-bold">Talk Naturally with p. Trigger</h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
            You don't need to memorize commands. Just start with "p." and talk naturally.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-background/50 p-4">
              <div className="mb-2 font-mono text-sm text-gray-400">You:</div>
              <div className="font-mono text-cat-peach">"p. I want to build user auth"</div>
              <div className="mt-2 text-xs text-muted-foreground">→ Runs /p:feature</div>
            </div>
            <div className="rounded-lg bg-background/50 p-4">
              <div className="mb-2 font-mono text-sm text-gray-400">You:</div>
              <div className="font-mono text-cat-peach">"p. I'm done"</div>
              <div className="mt-2 text-xs text-muted-foreground">→ Runs /p:done</div>
            </div>
            <div className="rounded-lg bg-background/50 p-4">
              <div className="mb-2 font-mono text-sm text-gray-400">You:</div>
              <div className="font-mono text-cat-peach">"p. ship this feature"</div>
              <div className="mt-2 text-xs text-muted-foreground">→ Runs /p:ship</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="mx-auto max-w-4xl rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center"
      >
        <h2 className="mb-4 text-3xl font-bold">Ready to Ship Fast?</h2>
        <p className="mb-6 text-muted-foreground">
          Start with /p:feature and let the workflow guide you to shipping
        </p>

        <div className="mx-auto mb-6 max-w-2xl rounded-lg border-2 border-primary/30 bg-background/50 p-4">
          <p className="mb-2 text-sm text-muted-foreground">Try it:</p>
          <code className="font-mono text-lg text-primary">
            /p:feature "your feature description"
          </code>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/commands"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <TerminalIcon className="h-5 w-5" />
            View All Commands
          </Link>
          <Link
            to="/docs/quick-start"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 font-medium transition-colors hover:bg-muted"
          >
            <FileText className="h-5 w-5" />
            Quick Start Guide
          </Link>
          <a
            href="https://github.com/jlopezlira/prjct-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 font-medium transition-colors hover:bg-muted"
          >
            <GitBranch className="h-5 w-5" />
            View on GitHub
          </a>
        </div>
      </motion.div>
    </div>
  )
}
