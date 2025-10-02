import { motion } from 'framer-motion'
import {
  Sparkles,
  Zap,
  ArrowRight,
  CheckCircle,
  Settings,
  Code,
  TestTube,
  FileText,
  Layers,
  GitBranch,
  AlertTriangle,
  Clock,
  XCircle,
  Terminal as TerminalIcon,
  Lightbulb
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

// Terminal configurations for workflow demos
const workflowTerminalConfigs = [
  {
    name: 'Workflow: Create Login Form (No Tests)',
    commands: [
      { cmd: '/p:task build login form component', output: '🔍 Analyzing task...', delay: 500 },
      { cmd: '', output: '📋 Detected: UI Component workflow\n🔧 Stack: React + TypeScript', delay: 700 },
      { cmd: '', output: '⚠️  Missing capability: Test framework', delay: 600 },
      { cmd: '', output: '💡 Recommended: Vitest + Testing Library\n📖 Reason: Fast, modern, works great with Vite\n\nWhat would you like to do?\n  1. Install Vitest + Testing Library (~1 min)\n  2. Skip tests for now\n  3. Let me install manually later\n  4. Pause workflow\n\nChoose [1-4]:', delay: 1000 },
      { cmd: '1', output: '📦 Installing dependencies...', delay: 800 },
      { cmd: '', output: '⏳ npm install -D vitest @testing-library/react\n✅ Installed in 1.2 minutes', delay: 1200 },
      { cmd: '', output: '⚙️  Configuring Vitest for React + TypeScript...', delay: 600 },
      { cmd: '', output: '✅ Configuration complete!\n\n🚀 Executing workflow steps:', delay: 700 },
      { cmd: '', output: '  [1/4] Design ⏭️  (optional, skipped)\n  [2/4] Development 🔄', delay: 500 },
      { cmd: '', output: '  ✅ Created: LoginForm.tsx\n  ✅ Added: Form validation\n  ✅ Added: Error handling', delay: 1000 },
      { cmd: '', output: '  [3/4] Testing 🔄', delay: 500 },
      { cmd: '', output: '  ✅ Created: LoginForm.test.tsx\n  ✅ Tests: 8 passing\n  ✅ Coverage: 95%', delay: 1000 },
      { cmd: '', output: '  [4/4] Documentation 🔄', delay: 500 },
      { cmd: '', output: '  ✅ Created: LoginForm.md\n  ✅ Added: Props documentation\n  ✅ Added: Usage examples', delay: 900 },
      { cmd: '', output: '\n✨ Workflow complete!\n📦 Created: LoginForm.tsx + tests + docs\n⏱️  Total time: 3.2 minutes', delay: 800 },
    ],
  },
  {
    name: 'Workflow: API Endpoint (Tests Ready)',
    commands: [
      { cmd: '/p:task add user authentication endpoint', output: '🔍 Analyzing task...', delay: 500 },
      { cmd: '', output: '📋 Detected: API Endpoint workflow\n🔧 Stack: Node.js + Express + Jest', delay: 700 },
      { cmd: '', output: '✅ All capabilities present\n  ✓ Test framework (Jest)\n  ✓ Documentation tools', delay: 800 },
      { cmd: '', output: '🚀 Executing workflow steps:', delay: 600 },
      { cmd: '', output: '  [1/3] Development 🔄', delay: 500 },
      { cmd: '', output: '  ✅ Created: /api/auth/login endpoint\n  ✅ Added: JWT token generation\n  ✅ Added: Password validation\n  ✅ Added: Rate limiting', delay: 1200 },
      { cmd: '', output: '  [2/3] Testing 🔄', delay: 500 },
      { cmd: '', output: '  ✅ Created: auth.test.js\n  ✅ Integration tests: 12 passing\n  ✅ Security tests: 5 passing\n  ✅ Coverage: 98%', delay: 1100 },
      { cmd: '', output: '  [3/3] Documentation 🔄', delay: 500 },
      { cmd: '', output: '  ✅ Created: API documentation\n  ✅ Added: Request/response examples\n  ✅ Added: Error codes reference', delay: 900 },
      { cmd: '', output: '\n✨ Workflow complete!\n📦 Created: /auth endpoint + tests + docs\n⏱️  Total time: 2.1 minutes', delay: 700 },
    ],
  },
  {
    name: 'Workflow: Fix Performance Bug',
    commands: [
      { cmd: '/p:task fix slow dashboard loading', output: '🔍 Analyzing task...', delay: 500 },
      { cmd: '', output: '📋 Detected: Bug Fix workflow\n🔧 Stack: React + Vite', delay: 700 },
      { cmd: '', output: '🚀 Executing workflow steps:', delay: 600 },
      { cmd: '', output: '  [1/3] Analysis 🔄', delay: 500 },
      { cmd: '', output: '  🔍 Profiling dashboard component...\n  ⚠️  Found: Unnecessary re-renders (47 per second)\n  ⚠️  Found: Non-memoized expensive calculations\n  ⚠️  Found: Missing React.memo on child components', delay: 1200 },
      { cmd: '', output: '  [2/3] Fix Implementation 🔄', delay: 500 },
      { cmd: '', output: '  ✅ Added: React.memo to Dashboard\n  ✅ Added: useMemo for data processing\n  ✅ Added: useCallback for event handlers\n  ✅ Optimized: Child component renders', delay: 1100 },
      { cmd: '', output: '  [3/3] Testing 🔄', delay: 500 },
      { cmd: '', output: '  ✅ All tests passing\n  ✅ Performance: 3.2x faster load time\n  ✅ Re-renders: Reduced from 47/s to 2/s\n  ⚡ Dashboard now loads in 180ms (was 580ms)', delay: 1000 },
      { cmd: '', output: '\n✨ Workflow complete!\n🐛 Bug fixed with performance validation\n⏱️  Total time: 1.8 minutes', delay: 700 },
    ],
  },
]

export const WorkflowsGuide = () => {
  const [activeWorkflow, setActiveWorkflow] = useState<string>('ui')
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
      }, 15000) // Wait 15 seconds before cycling to next terminal
    }
  }, [currentLine, commands])

  const workflowTypes = {
    ui: {
      name: 'UI Component',
      icon: <Layers className="w-5 h-5" />,
      color: 'text-cat-mauve',
      steps: [
        { name: 'Design', agent: 'frontend', optional: true, needs: 'design' },
        { name: 'Dev', agent: 'frontend', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' },
        { name: 'Docs', agent: 'scribe', optional: true, needs: 'docs' }
      ],
      example: 'Create user login form'
    },
    api: {
      name: 'API Endpoint',
      icon: <Code className="w-5 h-5" />,
      color: 'text-cat-blue',
      steps: [
        { name: 'Dev', agent: 'backend', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' },
        { name: 'Docs', agent: 'scribe', optional: true, needs: 'docs' }
      ],
      example: 'Add authentication endpoint'
    },
    bug: {
      name: 'Bug Fix',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-cat-red',
      steps: [
        { name: 'Analyze', agent: 'analyzer', optional: false },
        { name: 'Fix', agent: 'auto', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' }
      ],
      example: 'Fix slow dashboard rendering'
    },
    refactor: {
      name: 'Refactor',
      icon: <GitBranch className="w-5 h-5" />,
      color: 'text-cat-yellow',
      steps: [
        { name: 'Refactor', agent: 'refactorer', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' }
      ],
      example: 'Optimize data fetching logic'
    },
    feature: {
      name: 'Feature',
      icon: <Sparkles className="w-5 h-5" />,
      color: 'text-cat-green',
      steps: [
        { name: 'Design', agent: 'architect', optional: true, needs: 'design' },
        { name: 'Dev', agent: 'auto', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' },
        { name: 'Docs', agent: 'scribe', optional: true, needs: 'docs' }
      ],
      example: 'Build notification system'
    }
  }

  const stackRecommendations = [
    {
      framework: 'React + TypeScript',
      test: 'Vitest + Testing Library',
      why: 'Fast, modern, works great with Vite',
      install: 'npm install -D vitest @testing-library/react'
    },
    {
      framework: 'Vue 3',
      test: 'Vitest + Vue Test Utils',
      why: 'Official Vue testing library',
      install: 'npm install -D vitest @vue/test-utils'
    },
    {
      framework: 'Angular',
      test: 'Jest + Angular Testing',
      why: 'Best integration with Angular',
      install: 'npm install -D jest @types/jest ts-jest'
    },
    {
      framework: 'Next.js',
      test: 'Vitest + Testing Library',
      why: 'Recommended by Next.js team',
      install: 'npm install -D vitest @testing-library/react'
    },
    {
      framework: 'Node.js / Express',
      test: 'Jest or Vitest',
      why: 'Industry standard for Node.js',
      install: 'npm install -D jest'
    }
  ]

  return (
    <div className="min-h-screen py-20 px-4">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto text-center mb-20"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">v0.4.0 Feature</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Interactive Workflow System
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Your AI assistant that knows when you're missing tools and helps you install them—
          no more skipped tests or missing documentation.
        </p>
      </motion.div>

      {/* What Are Workflows - New Section */}
      <section className="max-w-6xl mx-auto mb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">What Are Workflows?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Think of workflows as smart checklists that adapt to your project.
            They guide you through best practices while checking if you have the right tools.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Without Workflows */}
          <div className="p-6 bg-cat-red/10 border-2 border-cat-red/30 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-6 h-6 text-cat-red" />
              <h3 className="text-xl font-bold">Without Workflows</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-cat-red mt-1">✗</span>
                <p className="text-muted-foreground">You: "Build a login form"</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cat-red mt-1">✗</span>
                <p className="text-muted-foreground">AI creates component... no tests (you don't have a test framework)</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cat-red mt-1">✗</span>
                <p className="text-muted-foreground">Silently skipped documentation</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cat-red mt-1">✗</span>
                <p className="text-muted-foreground">You discover the gaps later</p>
              </div>
            </div>
          </div>

          {/* With Workflows */}
          <div className="p-6 bg-cat-green/10 border-2 border-cat-green/30 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-cat-green" />
              <h3 className="text-xl font-bold">With Workflows</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-cat-green mt-1">✓</span>
                <p className="text-muted-foreground">You: "Build a login form"</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cat-green mt-1">✓</span>
                <p className="text-muted-foreground">AI: "I noticed you don't have tests. Want to add Vitest?"</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cat-green mt-1">✓</span>
                <p className="text-muted-foreground">You choose → AI installs and configures it</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cat-green mt-1">✓</span>
                <p className="text-muted-foreground">Creates component + tests + docs ✨</p>
              </div>
            </div>
          </div>
        </div>

        {/* Key Concepts */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-muted/20 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold mb-2">Smart Detection</h3>
            <p className="text-sm text-muted-foreground">
              Scans your project to find what tools you have (tests, docs, design) and what's missing
            </p>
          </div>

          <div className="p-6 bg-muted/20 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Lightbulb className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold mb-2">Interactive Prompts</h3>
            <p className="text-sm text-muted-foreground">
              Asks you before skipping steps or installing new tools. You're always in control.
            </p>
          </div>

          <div className="p-6 bg-muted/20 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Code className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold mb-2">Specialized Agents</h3>
            <p className="text-sm text-muted-foreground">
              Different AI experts for different tasks: frontend, backend, QA, documentation
            </p>
          </div>
        </div>
      </section>

      {/* How It Works - Improved */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">How It Works in 5 Steps</h2>

        <div className="grid md:grid-cols-5 gap-4">
          {[
            {
              icon: <TerminalIcon />,
              title: 'You Type a Command',
              desc: 'Like "/p:task build login form"',
              example: 'Natural language, no complex syntax'
            },
            {
              icon: <GitBranch />,
              title: 'System Figures Out the Type',
              desc: 'Is it UI? API? Bug fix? Feature?',
              example: 'Auto-detects from your description'
            },
            {
              icon: <Settings />,
              title: 'Checks Your Project',
              desc: 'Do you have test framework? Docs tools?',
              example: 'Scans package.json and config files'
            },
            {
              icon: <AlertTriangle />,
              title: 'Asks If Needed',
              desc: 'Missing something? Get options to install',
              example: 'You choose: install, skip, or pause'
            },
            {
              icon: <Sparkles />,
              title: 'Builds Everything',
              desc: 'Code + tests + docs, all tracked',
              example: 'Complete solution, production-ready'
            }
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="p-6 bg-muted/20 rounded-xl relative"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                {step.icon}
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                {i + 1}
              </div>
              <h3 className="font-bold mb-2 text-center">{step.title}</h3>
              <p className="text-sm text-muted-foreground text-center mb-3">{step.desc}</p>
              <div className="text-xs text-primary/70 text-center italic">
                {step.example}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflow Types */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Choose Your Workflow Type</h2>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {Object.entries(workflowTypes).map(([key, workflow]) => (
            <button
              key={key}
              onClick={() => setActiveWorkflow(key)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                activeWorkflow === key
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={workflow.color}>{workflow.icon}</span>
                <span className="font-medium">{workflow.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Active Workflow Details */}
        <div className="relative isolate overflow-visible">
          <div className="fancy-border pointer-events-none"></div>
          <div className="relative z-10 p-10 bg-gradient-to-br from-background to-muted/20 rounded-2xl border border-border">
            {/* Example Badge */}
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full border border-primary/30">
                <Code className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">
                  Example: {workflowTypes[activeWorkflow as keyof typeof workflowTypes].example}
                </span>
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {workflowTypes[activeWorkflow as keyof typeof workflowTypes].steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="relative"
                >
                  {/* Step Card */}
                  <div className={`relative p-5 rounded-2xl h-full transition-all duration-300 ${
                    step.optional
                      ? 'bg-muted/30 border-2 border-dashed border-muted-foreground/40 hover:border-muted-foreground/60'
                      : 'bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/50 hover:border-primary/70 shadow-lg shadow-primary/10'
                  }`}>

                    {/* Step Number Badge */}
                    <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-lg z-10">
                      {i + 1}
                    </div>

                    {/* Icon and Title */}
                    <div className="text-center mb-4 pt-2">
                      <div className={`w-16 h-16 mx-auto rounded-xl mb-3 flex items-center justify-center ${
                        step.optional ? 'bg-muted/50' : 'bg-primary/20'
                      } shadow-md`}>
                        {step.name === 'Design' && <Sparkles className="w-8 h-8 text-cat-mauve" />}
                        {step.name === 'Dev' && <Code className="w-8 h-8 text-cat-blue" />}
                        {step.name === 'Test' && <TestTube className="w-8 h-8 text-cat-green" />}
                        {step.name === 'Docs' && <FileText className="w-8 h-8 text-cat-yellow" />}
                        {step.name === 'Analyze' && <Settings className="w-8 h-8 text-cat-sapphire" />}
                        {step.name === 'Fix' && <CheckCircle className="w-8 h-8 text-cat-green" />}
                        {step.name === 'Refactor' && <GitBranch className="w-8 h-8 text-cat-peach" />}
                      </div>
                      <h4 className="font-bold text-xl mb-2">{step.name}</h4>
                      {step.optional && (
                        <span className="inline-block text-xs px-3 py-1 bg-muted rounded-full text-muted-foreground">
                          Optional
                        </span>
                      )}
                    </div>

                    {/* Agent Info */}
                    <div className="space-y-2">
                      <div className="px-3 py-2 bg-background/50 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">AI Agent</p>
                        <p className="font-semibold text-primary">{step.agent}</p>
                      </div>

                      {step.needs && (
                        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-cat-yellow/10 rounded-lg border border-cat-yellow/30">
                          <AlertTriangle className="w-4 h-4 text-cat-yellow flex-shrink-0" />
                          <span className="text-sm text-cat-yellow font-medium">
                            Needs {step.needs}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Arrow indicator */}
                    {i < workflowTypes[activeWorkflow as keyof typeof workflowTypes].steps.length - 1 && (
                      <div className="hidden lg:block absolute -right-8 top-1/2 -translate-y-1/2 z-20">
                        <ArrowRight className="w-6 h-6 text-primary/60" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Terminal Demo */}
      <section className="max-w-6xl mx-auto mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold mb-4">See It In Action</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch a live terminal demo showing exactly how workflows handle real scenarios.
            This is what you'll see in your CLI—interactive prompts, progress updates, and all.
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

          <div className="space-y-3 font-mono text-sm md:text-base">
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
                <div className={`${command.cmd ? 'ml-4 mt-1' : ''} text-gray-300 whitespace-pre-line`}>
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
            💡 The terminal cycles through different workflow scenarios automatically
          </p>
        </div>
      </section>

      {/* Smart Prompting - Simplified */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Interactive Decision Making</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Workflows never guess or skip things silently. When something's missing, you get clear options.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Scenario 1: Missing Tests */}
          <div className="p-6 bg-gradient-to-br from-cat-yellow/10 to-background rounded-xl border-2 border-cat-yellow/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-cat-yellow/20 flex items-center justify-center">
                <TestTube className="w-5 h-5 text-cat-yellow" />
              </div>
              <h3 className="text-xl font-bold">Scenario: You Want Tests</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-background/80 rounded-lg">
                <p className="text-sm mb-2"><strong>System detected:</strong></p>
                <p className="text-muted-foreground text-sm">You're using React but don't have a test framework installed.</p>
              </div>

              <div className="p-4 bg-cat-yellow/20 rounded-lg border border-cat-yellow/30">
                <p className="text-sm font-semibold mb-3">You'll see this prompt:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-primary">1.</span>
                    <p><strong>Install Vitest + Testing Library</strong> (recommended, ~1 min)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-muted-foreground">2.</span>
                    <p className="text-muted-foreground">Skip tests for now</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-muted-foreground">3.</span>
                    <p className="text-muted-foreground">Let me install it myself later</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-muted-foreground">4.</span>
                    <p className="text-muted-foreground">Pause workflow, I'll decide</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-cat-green/20 rounded-lg">
                <p className="text-sm"><strong>You pick option 1 →</strong> System installs, configures, and creates your component with tests ✨</p>
              </div>
            </div>
          </div>

          {/* Scenario 2: Everything Ready */}
          <div className="p-6 bg-gradient-to-br from-cat-green/10 to-background rounded-xl border-2 border-cat-green/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-cat-green/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-cat-green" />
              </div>
              <h3 className="text-xl font-bold">Scenario: All Set</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-background/80 rounded-lg">
                <p className="text-sm mb-2"><strong>System detected:</strong></p>
                <p className="text-muted-foreground text-sm">You have Jest, ESLint, and TypeScript configured. Everything's ready!</p>
              </div>

              <div className="p-4 bg-cat-green/20 rounded-lg border border-cat-green/30">
                <p className="text-sm font-semibold mb-3">No prompts needed!</p>
                <p className="text-sm text-muted-foreground">The workflow proceeds directly to building your code with all the best practices.</p>
              </div>

              <div className="p-3 bg-primary/20 rounded-lg">
                <p className="text-sm"><strong>Result →</strong> Fast, smooth execution with production-quality output ⚡</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stack Recommendations - Improved */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Smart Tool Recommendations</h2>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          The system knows which testing tools work best with your framework
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left p-4 font-bold">Your Framework</th>
                <th className="text-left p-4 font-bold">Recommended Testing</th>
                <th className="text-left p-4 font-bold">Why This One?</th>
                <th className="text-left p-4 font-bold">Install Command</th>
              </tr>
            </thead>
            <tbody>
              {stackRecommendations.map((rec, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-primary" />
                      <span className="font-medium">{rec.framework}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-primary font-medium">{rec.test}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{rec.why}</span>
                  </td>
                  <td className="p-4">
                    <code className="text-xs bg-background px-3 py-1.5 rounded border border-border">
                      {rec.install}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-12 text-center">Why Use Workflows?</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-gradient-to-br from-cat-green/10 to-background rounded-xl border border-cat-green/30">
            <div className="w-12 h-12 rounded-full bg-cat-green/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-cat-green" />
            </div>
            <h3 className="text-xl font-bold mb-3">Never Skip Quality</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Old way: AI skips tests because you don't have the tools.<br/>
              Workflow way: AI asks if you want to add them.
            </p>
            <div className="text-xs text-cat-green font-mono">
              → 100% test coverage possible
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-cat-blue/10 to-background rounded-xl border border-cat-blue/30">
            <div className="w-12 h-12 rounded-full bg-cat-blue/20 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-cat-blue" />
            </div>
            <h3 className="text-xl font-bold mb-3">Save Time</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Auto-installation and configuration in ~1-2 minutes instead of manual setup.
            </p>
            <div className="text-xs text-cat-blue font-mono">
              → 10-30 min saved per task
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-cat-mauve/10 to-background rounded-xl border border-cat-mauve/30">
            <div className="w-12 h-12 rounded-full bg-cat-mauve/20 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-cat-mauve" />
            </div>
            <h3 className="text-xl font-bold mb-3">Production-Ready</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Every workflow step follows best practices for your specific stack.
            </p>
            <div className="text-xs text-cat-mauve font-mono">
              → Code + Tests + Docs ✨
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Advanced Features</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-muted/20 rounded-xl">
            <FileText className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-3">State Persistence</h3>
            <p className="text-muted-foreground text-sm">
              All workflows are saved to state.json with complete history, so you can resume or review later.
            </p>
          </div>

          <div className="p-6 bg-muted/20 rounded-xl">
            <Settings className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-3">Smart Configuration</h3>
            <p className="text-muted-foreground text-sm">
              Installed tools are automatically configured for your framework—no manual setup needed.
            </p>
          </div>

          <div className="p-6 bg-muted/20 rounded-xl">
            <TestTube className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-3">Installation Tracking</h3>
            <p className="text-muted-foreground text-sm">
              Every tool installation becomes a visible task with duration tracking in your project timeline.
            </p>
          </div>
        </div>
      </section>

      {/* CTA - Enhanced */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto text-center p-8 bg-gradient-to-r from-primary/10 to-transparent rounded-2xl border border-primary/20"
      >
        <h2 className="text-3xl font-bold mb-4">Ready to Try Workflows?</h2>
        <p className="text-muted-foreground mb-6">
          Start with a simple task and let the workflow system guide you
        </p>

        {/* Quick Start Command */}
        <div className="mb-6 p-4 bg-background/50 rounded-lg border-2 border-primary/30 max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground mb-2">Try this command first:</p>
          <code className="text-lg font-mono text-primary">
            /p:task build a simple button component
          </code>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/commands"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <TerminalIcon className="w-5 h-5" />
            View All Commands
          </Link>
          <Link
            to="/docs/quick-start"
            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors inline-flex items-center gap-2"
          >
            <FileText className="w-5 h-5" />
            Quick Start Guide
          </Link>
          <a
            href="https://github.com/jlopezlira/prjct-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors inline-flex items-center gap-2"
          >
            <GitBranch className="w-5 h-5" />
            View on GitHub
          </a>
        </div>
      </motion.div>
    </div>
  )
}
