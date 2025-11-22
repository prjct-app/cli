import { motion } from 'framer-motion'
import { useState } from 'react'
import { Play, Copy, RotateCw, Check } from 'lucide-react'

interface WorkflowStep {
  command: string
  description: string
  output: string
  tip?: string
}

interface Workflow {
  id: string
  title: string
  description: string
  emoji: string
  steps: WorkflowStep[]
}

const workflows: Workflow[] = [
  {
    id: 'first-day',
    title: 'My First Day with prjct',
    description: 'Initial setup and first feature',
    emoji: '🌟',
    steps: [
      {
        command: '/p:init',
        description: 'Initialize project structure (includes automatic analysis)',
        output:
          '✅ Project initialized in .prjct/\n📁 Created: core, progress, planning, analysis, memory\n🔍 Analyzing repository...\n• Language: JavaScript/Node.js\n• Tech: React, Express, MongoDB',
        tip: '/p:init automatically analyzes your project - no need to run /p:analyze separately',
      },
      {
        command: '/p:feature "setup development environment"',
        description: 'Add your first feature with value analysis',
        output:
          '✨ Value Analysis:\n• Impact: HIGH (foundation)\n• Effort: 2h\n• Tasks: 3\n  1. Install dependencies\n  2. Configure environment\n  3. Test setup\n\n🚀 Auto-starting task 1...',
        tip: 'Features automatically create and start tasks',
      },
      {
        command: '/p:done',
        description: 'Complete first task',
        output:
          '✅ Task complete: Install dependencies\n💡 Auto-starting next: Configure environment',
        tip: 'Tasks auto-progress to the next one',
      },
      {
        command: '/p:done',
        description: 'Complete remaining tasks',
        output: '✅ All tasks complete!\n🎉 Feature ready to ship!',
      },
      {
        command: '/p:ship "dev environment"',
        description: 'Ship your first feature',
        output:
          '🚀 SHIPPED: Development Environment!\n🎉 Your first WIN! Keep the momentum going!\n\n💡 Tip: Use /p:feature for your next addition',
        tip: 'Celebrate with /p:ship when a feature is complete',
      },
    ],
  },
  {
    id: 'daily-workflow',
    title: 'Daily Work Session',
    description: 'Typical productive day workflow',
    emoji: '💼',
    steps: [
      {
        command: '/p:dash',
        description: 'Check unified dashboard when starting',
        output:
          '📊 PROJECT DASHBOARD\n━━━━━━━━━━━━━\n🎯 Current: authentication feature (task 2/4)\n⏸️ Paused: 1 task\n📈 This week: 5 shipped\n📋 Next: 3 in queue\n🔥 Velocity: 1.2 features/day',
        tip: 'Start each day with /p:dash',
      },
      {
        command: '/p:done',
        description: 'Complete current task and auto-progress',
        output: '✅ Task complete: Build login UI\n💡 Auto-starting next: Add session management',
        tip: 'Tasks auto-progress within a feature',
      },
      {
        command: '/p:stuck "session not persisting"',
        description: 'Get help with a problem',
        output:
          '💡 Solutions for session issues:\n1. Check cookie settings (httpOnly, secure)\n2. Verify session store configuration\n3. Make sure secret key is set\n4. Try: app.use(session({ resave: false }))',
        tip: 'Describe your problem specifically for better help',
      },
      {
        command: '/p:done',
        description: 'Complete all remaining tasks',
        output:
          '✅ All tasks complete!\n⏱️ Feature duration: 4 hours 30 minutes\n\n🎉 Authentication feature ready to ship!',
      },
      {
        command: '/p:ship "authentication system"',
        description: 'Ship completed feature',
        output:
          '🚀 SHIPPED: Authentication System!\n📊 4 tasks completed\n✅ Lint: passed\n✅ Tests: 12 passing\n📝 Changelog updated\n\n💡 Next: /p:feature or /p:next',
        tip: '/p:ship runs complete workflow: lint, test, docs, version, commit, push',
      },
      {
        command: '/p:dash week',
        description: "View weekly progress",
        output:
          "📊 WEEKLY PROGRESS\n━━━━━━━━━━━━━━\n✅ Completed: 12 tasks\n🚀 Shipped: 6 features\n⏱️ Focus time: 28h 30m\n📈 Velocity: ↗️ improving\n⏸️ Interruptions: 3 pauses",
      },
    ],
  },
  {
    id: 'interruptions',
    title: 'Handle Interruptions (v0.9.0)',
    description: 'New pause/resume system for real-world workflow',
    emoji: '⏸️',
    steps: [
      {
        command: '/p:work "implement API endpoint"',
        description: 'Start working on a task',
        output:
          '🎯 Working on: implement API endpoint\nStarted: 2:30 PM\nAgent: backend-agent\n\nFocus on this task. Use /p:done when complete.',
        tip: 'v0.9.0: /p:work replaces /p:now and /p:build',
      },
      {
        command: '/p:pause "urgent meeting"',
        description: 'Handle an interruption without losing context',
        output:
          '⏸️ Task paused: implement API endpoint\nReason: urgent meeting\nDuration worked: 45 minutes\n\n✅ Context preserved for later resumption',
        tip: 'NEW in v0.9.0: Never lose context again',
      },
      {
        command: '/p:work "quick bug fix"',
        description: 'Start a different urgent task',
        output:
          '🎯 Working on: quick bug fix\nStarted: 3:15 PM\nAgent: qa-agent\n\n📋 Note: 1 task paused (implement API endpoint)',
      },
      {
        command: '/p:done',
        description: 'Complete the bug fix',
        output:
          '✅ Task complete: quick bug fix\nDuration: 20 minutes\n\n⏸️ You have 1 paused task. Use /p:resume to continue.',
      },
      {
        command: '/p:resume',
        description: 'Resume the paused task exactly where you left off',
        output:
          '▶️ Resumed: implement API endpoint\nPaused duration: 1 hour 5 minutes\nPrevious work: 45 minutes\n\n💡 Continuing from where you left off...',
        tip: 'Resume maintains full context and timing',
      },
      {
        command: '/p:done',
        description: 'Complete the original task',
        output:
          '✅ Task complete: implement API endpoint\nTotal time: 2 hours 15 minutes\nActive time: 1 hour 10 minutes\n\n🎯 Ready for next task. Use /p:next to see priorities.',
      },
    ],
  },
  {
    id: 'complex-feature',
    title: 'Complex Feature',
    description: 'Build large feature with automatic task breakdown',
    emoji: '🏗️',
    steps: [
      {
        command: '/p:feature "build notification system"',
        description: 'Add complex feature with value analysis',
        output:
          '✨ Value Analysis:\n• Impact: HIGH (user engagement)\n• Effort: 12h\n• Timing: Start now\n\nTasks (max 5):\n  1. Design notification architecture\n  2. Setup real-time messaging (WebSocket)\n  3. Create notification UI component\n  4. Add user notification settings\n  5. Test and optimize performance\n\n🚀 Auto-starting task 1...',
        tip: 'Features automatically break down into max 5 tasks',
      },
      {
        command: '/p:done',
        description: 'Complete task 1, auto-start task 2',
        output:
          '✅ Task complete: Design notification architecture\n📊 Progress: 20% (1/5)\n💡 Auto-starting next: Setup real-time messaging',
        tip: 'Tasks auto-progress - no manual switching needed',
      },
      {
        command: '/p:done',
        description: 'Complete task 2',
        output:
          '✅ Task complete: WebSocket messaging working\n📊 Progress: 40% (2/5)\n💡 Auto-starting next: Create notification UI',
      },
      {
        command: '/p:done',
        description: 'Complete remaining tasks',
        output:
          '✅ All 5 tasks complete!\n⏱️ Total time: 2 days\n📈 Impact: HIGH\n\n🎉 Notification System ready to ship!',
      },
      {
        command: '/p:ship "notification system"',
        description: 'Ship complete feature with automated workflow',
        output:
          '🚀 SHIPPED: Notification System!\n\nWorkflow completed:\n  ✅ Lint: passed\n  ✅ Tests: 24 passing\n  ✅ Docs: updated\n  ✅ Version: 1.2.0 → 1.3.0\n  ✅ CHANGELOG: updated\n  ✅ Git: committed + pushed\n\n🏆 5 tasks • 2 days • HIGH impact\n💡 Recommendation: Compact conversation now',
        tip: '/p:ship automates: lint → test → docs → version → changelog → commit → push',
      },
    ],
  },
]

export const InteractiveTerminal = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('first-day')
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [executedSteps, setExecutedSteps] = useState<number[]>([])
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const currentWorkflow = workflows.find((w) => w.id === selectedWorkflow)!

  const executeStep = (stepIndex: number) => {
    if (!executedSteps.includes(stepIndex)) {
      setExecutedSteps([...executedSteps, stepIndex])
    }
    setCurrentStep(stepIndex)
  }

  const playAll = async () => {
    setIsPlaying(true)
    setExecutedSteps([])
    setCurrentStep(0)

    for (let i = 0; i < currentWorkflow.steps.length; i++) {
      setCurrentStep(i)
      setExecutedSteps((prev) => [...prev, i])
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    setIsPlaying(false)
  }

  const reset = () => {
    setCurrentStep(0)
    setExecutedSteps([])
    setIsPlaying(false)
  }

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command)
    setCopiedCommand(command)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  return (
    <section className="bg-muted/20 px-4 py-20" id="workflows">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">Interactive Workflows</h2>
          <p className="text-xl text-muted-foreground">
            Learn by practicing with real step-by-step examples
          </p>
        </motion.div>

        {/* Workflow Selector */}
        <div className="mb-8 flex flex-wrap justify-center gap-4">
          {workflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => {
                setSelectedWorkflow(workflow.id)
                reset()
              }}
              className={`rounded-lg px-6 py-3 transition-all ${
                selectedWorkflow === workflow.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border bg-background hover:border-primary'
              }`}
            >
              <span className="mr-2">{workflow.emoji}</span>
              {workflow.title}
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Steps Panel */}
          <div className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{currentWorkflow.title}</h3>
              <div className="flex gap-2">
                <button
                  onClick={playAll}
                  disabled={isPlaying}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  Run All
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2 transition hover:bg-muted"
                >
                  <RotateCw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>

            <p className="mb-6 text-muted-foreground">{currentWorkflow.description}</p>

            {currentWorkflow.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  currentStep === index
                    ? 'border-primary bg-primary/5'
                    : executedSteps.includes(index)
                      ? 'border-cat-green/50 bg-cat-green/5'
                      : 'hover:border-primary/50'
                }`}
                onClick={() => executeStep(index)}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        executedSteps.includes(index)
                          ? 'bg-cat-green text-white'
                          : currentStep === index
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                      }`}
                    >
                      {executedSteps.includes(index) ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <code className="font-mono text-sm">{step.command}</code>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      copyCommand(step.command)
                    }}
                    className="rounded p-1 hover:bg-muted"
                  >
                    {copiedCommand === step.command ? (
                      <Check className="h-4 w-4 text-cat-green" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="ml-10 text-sm text-muted-foreground">{step.description}</p>
                {step.tip && currentStep === index && (
                  <div className="ml-10 mt-2 rounded border border-cat-sapphire/20 bg-cat-sapphire/10 p-2 text-xs text-cat-sapphire">
                    💡 {step.tip}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Terminal Output */}
          <div className="sticky top-4 h-fit rounded-2xl bg-black p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-cat-maroon" />
              <div className="h-3 w-3 rounded-full bg-cat-yellow" />
              <div className="h-3 w-3 rounded-full bg-cat-green" />
              <span className="ml-4 font-mono text-sm text-gray-400">Interactive Terminal</span>
            </div>

            <div className="space-y-3 font-mono text-sm">
              {executedSteps.map((stepIndex) => {
                const step = currentWorkflow.steps[stepIndex]
                return (
                  <motion.div
                    key={stepIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-gray-400">
                      <span className="text-cat-teal">$</span> {step.command}
                    </div>
                    <div className="ml-4 mt-1 whitespace-pre-line text-gray-300">{step.output}</div>
                  </motion.div>
                )
              })}
              {isPlaying && (
                <div className="text-gray-400">
                  <span className="text-cat-teal">$</span>
                  <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-cat-teal" />
                </div>
              )}
              {executedSteps.length === 0 && !isPlaying && (
                <div className="py-8 text-center text-gray-500">
                  Click the steps on the left to see the output
                  <br />
                  or press "Run All" to see the complete flow
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
