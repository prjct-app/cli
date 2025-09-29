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
    description: 'Initial setup and first task',
    emoji: '🌟',
    steps: [
      {
        command: '/p:init',
        description: 'Initialize project structure',
        output:
          '✅ Project initialized in .prjct/\n📁 Created: core, progress, planning, analysis, memory',
        tip: 'You only need to do this ONCE per project',
      },
      {
        command: '/p:analyze',
        description: 'Automatically analyze the repository',
        output:
          '🔍 Repository Analysis:\n• Language: JavaScript/Node.js\n• Files: 45 total\n• Tech: React, Express, MongoDB\n• Architecture: MVC pattern detected',
        tip: 'Automatically detects your tech stack',
      },
      {
        command: '/p:roadmap',
        description: 'View the roadmap (empty at start)',
        output: '📋 Roadmap empty\nUse /p:roadmap add "feature" to start planning',
        tip: 'You can add features with /p:roadmap add',
      },
      {
        command: '/p:now "setup development environment"',
        description: 'Set your first task',
        output:
          '🎯 Current task set: setup development environment\n⏱️ Started: 2024-01-15 09:00 AM',
        tip: 'You can only have ONE active task at a time',
      },
      {
        command: '/p:done',
        description: 'Complete the task',
        output: "✅ Task completed in 45 minutes!\nGreat start! What's next?",
      },
      {
        command: '/p:ship "dev environment ready"',
        description: 'Celebrate your first achievement',
        output: '🚀 SHIPPED: dev environment ready!\n🎉 Your first WIN! Keep the momentum going!',
        tip: 'Use /p:ship for important features',
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
        command: '/p:recap',
        description: 'Check overall status when starting',
        output:
          '📊 PROJECT RECAP\n━━━━━━━━━━━━━\n🎯 Current: implement user auth\n📈 This week: 5 shipped\n📋 Queue: 3 tasks\n🔥 Velocity: 1.2 features/day',
        tip: 'Start each day with /p:recap',
      },
      {
        command: '/p:now',
        description: 'Confirm current task',
        output: '🎯 Current task: implement user authentication\n⏱️ Active for: 2 hours 15 minutes',
      },
      {
        command: '/p:stuck "JWT token not validating"',
        description: 'Get help with a problem',
        output:
          '💡 Solutions for JWT validation:\n1. Check token expiration settings\n2. Verify secret key matches\n3. Ensure proper middleware order\n4. Try: console.log(decoded) to debug',
        tip: 'Describe your problem specifically',
      },
      {
        command: '/p:idea "add OAuth providers"',
        description: 'Capture idea without losing focus',
        output: '💡 Idea captured: add OAuth providers\n📝 Saved to ideas.md for later review',
      },
      {
        command: '/p:done',
        description: "Complete today's task",
        output:
          '✅ Task completed: implement user authentication\n⏱️ Duration: 4 hours 30 minutes\n\nSuggested next: API rate limiting',
      },
      {
        command: '/p:git',
        description: 'Commit with smart message',
        output:
          '📝 Analyzing changes...\n✅ Committed: feat: add JWT authentication system\n📊 Files: 8 changed, +342 lines',
        tip: 'Generates commit messages automatically',
      },
      {
        command: '/p:progress',
        description: "View today's progress",
        output:
          "📈 Today's Progress:\n• Completed: 1 major feature\n• Time focused: 4h 30m\n• Velocity trend: ↗️ improving\n• Week total: 6 features shipped",
      },
    ],
  },
  {
    id: 'complex-feature',
    title: 'Complex Feature',
    description: 'Break down and execute a large feature',
    emoji: '🏗️',
    steps: [
      {
        command: '/p:task "build notification system"',
        description: 'Break down into manageable subtasks',
        output:
          '📋 Task breakdown:\n[1/5] Design notification architecture\n[2/5] Setup WebSocket server\n[3/5] Create notification UI components\n[4/5] Implement user preferences\n[5/5] Add tests and documentation\n\n🚀 Ready to execute step by step',
        tip: 'Automatically divides complex tasks',
      },
      {
        command: '/p:now "design notification architecture"',
        description: 'Work on first subtask',
        output:
          '🎯 Current: design notification architecture\n📍 Step 1 of 5 in notification system',
      },
      {
        command: '/p:done',
        description: 'Complete subtask 1',
        output:
          '✅ Subtask 1 complete!\n📊 Progress: 20% of notification system\n\n💡 Next: Setup WebSocket server',
      },
      {
        command: '/p:now "setup WebSocket server"',
        description: 'Next subtask',
        output: '🎯 Current: setup WebSocket server\n📍 Step 2 of 5',
      },
      {
        command: '/p:test',
        description: 'Run tests',
        output:
          '🧪 Running tests...\n✅ Unit tests: 24 passing\n✅ Integration: 5 passing\n🔧 Auto-fixed: 2 linting errors\n\nAll tests green!',
      },
      {
        command: '/p:ship "notification system complete"',
        description: 'Celebrate complete feature',
        output:
          '🚀 MEGA SHIP: Notification System!\n🎉🎊 5 subtasks completed\n⏱️ Total time: 2 days\n📈 Impact: High\n\n🏆 This is a HUGE win! Take a moment to celebrate!',
        tip: 'Celebrate important achievements',
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
