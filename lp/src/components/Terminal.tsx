import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import WorkflowMap from './WorkflowMap'

const terminalConfigs = [
  {
    name: 'Claude Code - SaaS MVP',
    commands: [
      { cmd: '/p:init', output: '✅ Project initialized in .prjct/', delay: 500 },
      {
        cmd: '/p:idea "AI-powered code review tool"',
        output: '💡 Idea captured: AI code review platform',
        delay: 700,
      },
      {
        cmd: '/p:roadmap',
        output:
          '📋 Generated roadmap:\n  1. Setup Next.js + TypeScript + Tailwind\n  2. GitHub OAuth integration\n  3. AI review engine with GPT-4\n  4. PR webhook processing\n  5. Dashboard & analytics\n  6. Deploy to Vercel',
        delay: 1200,
      },
      {
        cmd: '/p:task "implement GitHub OAuth"',
        output:
          '📋 Breaking down task:\n  [1/4] Create OAuth app settings\n  [2/4] Setup NextAuth.js\n  [3/4] Add callback handlers\n  [4/4] Test auth flow\n🚀 Executing...',
        delay: 1000,
      },
      {
        cmd: '/p:done && /p:ship "GitHub authentication"',
        output: '✅ Task complete!\n🚀 SHIPPED: GitHub OAuth integration!',
        delay: 800,
      },
      {
        cmd: '/p:progress week',
        output:
          '📊 This Week:\n• Shipped: 3 features\n• Velocity: 1.2 features/day\n• On track: Yes ✅',
        delay: 600,
      },
    ],
  },
  {
    name: 'Cursor - Mobile App',
    commands: [
      {
        cmd: '/p:now "setup React Native"',
        output: '🎯 Current task: setup React Native with Expo',
        delay: 600,
      },
      {
        cmd: '/p:analyze',
        output:
          '🔍 Codebase Analysis:\n• Components: 12 created\n• Coverage: 78%\n• Tech debt: Low\n• Next priority: Navigation',
        delay: 900,
      },
      {
        cmd: '/p:task "implement navigation"',
        output:
          '📋 Task breakdown:\n  [1/3] Install React Navigation\n  [2/3] Create tab navigator\n  [3/3] Setup deep linking\n🚀 Starting execution...',
        delay: 1000,
      },
      {
        cmd: '/p:test',
        output:
          '🧪 Running tests:\n  ✅ Unit tests: 42 passing\n  ✅ Integration: 8 passing\n  ✅ E2E: 3 passing\nAll tests passed!',
        delay: 800,
      },
      {
        cmd: '/p:ship "navigation system"',
        output: '🚀 SHIPPED: Complete navigation with deep linking!',
        delay: 700,
      },
      {
        cmd: '/p:next',
        output: '📋 Priority Queue:\n  1. Push notifications\n  2. Offline mode\n  3. Dark theme',
        delay: 600,
      },
    ],
  },
  {
    name: 'Warp - API Service',
    commands: [
      {
        cmd: '/p:idea "serverless API with rate limiting"',
        output: '💡 Captured: Scalable API service idea',
        delay: 600,
      },
      {
        cmd: '/p:roadmap add "monitoring dashboard"',
        output: '✅ Added to roadmap\n📍 Priority: High\n⚡ Effort: 2-3 days',
        delay: 700,
      },
      {
        cmd: '/p:now "implement rate limiting"',
        output: '🎯 Current: Redis-based rate limiting',
        delay: 600,
      },
      {
        cmd: '/p:stuck "Redis connection timeout"',
        output:
          '💡 Solution:\n• Check Redis URL format\n• Add connection pooling\n• Set timeout to 5000ms\n• Use connection retry logic',
        delay: 900,
      },
      {
        cmd: '/p:fix',
        output: '🔧 Fixed: Added connection pool with retry\n✅ Redis connected successfully',
        delay: 700,
      },
      {
        cmd: '/p:git commit "rate limiting"',
        output:
          '📝 Commit: feat: add Redis rate limiting\n🌿 Branch: feature/rate-limit\n✅ 5 files changed',
        delay: 800,
      },
      {
        cmd: '/p:recap',
        output:
          '📊 Project Overview:\n🚀 Shipped: 8 features\n🎯 Current: Monitoring setup\n📈 Velocity: 2.1 features/week\n✨ Momentum: High',
        delay: 1000,
      },
    ],
  },
  {
    name: 'AI Assistant - CLI Tool',
    commands: [
      {
        cmd: '/p:context',
        output:
          '📚 Project: prjct-cli\n🛠 Stack: Node.js, TypeScript\n🎯 Phase: Beta testing\n👥 Users: 127 active',
        delay: 700,
      },
      {
        cmd: '/p:roadmap show',
        output:
          '🚀 Current Sprint (67% done):\n  ✅ Core commands\n  ✅ AI integrations\n  🔄 Documentation\n  ⏳ Package publishing',
        delay: 900,
      },
      {
        cmd: '/p:task "write comprehensive docs"',
        output:
          '📋 Documentation tasks:\n  [1/5] Command reference\n  [2/5] Installation guide\n  [3/5] API examples\n  [4/5] Video tutorials\n  [5/5] FAQ section\n🚀 Generating...',
        delay: 1000,
      },
      {
        cmd: '/p:progress month',
        output:
          '📊 Monthly Stats:\n• Features shipped: 23\n• Tasks completed: 87\n• Ideas captured: 42\n• Velocity trend: ↗️ +15%',
        delay: 800,
      },
      {
        cmd: '/p:ship "beta version"',
        output:
          '🚀 SHIPPED: prjct-cli v0.9.0-beta!\n🎉 Celebration mode activated!\n📈 127 developers using it!',
        delay: 900,
      },
    ],
  },
]

export const Terminal = () => {
  const [currentLine, setCurrentLine] = useState(0)
  const [currentTerminalIndex, setCurrentTerminalIndex] = useState(0)
  const [displayedCommands, setDisplayedCommands] = useState<
    (typeof terminalConfigs)[0]['commands']
  >([])
  const [isTyping, setIsTyping] = useState(false)

  const currentTerminal = terminalConfigs[currentTerminalIndex]
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
        setCurrentTerminalIndex((prev) => (prev + 1) % terminalConfigs.length)
      }, 15000) // Wait 15 seconds before cycling to next terminal
    }
  }, [currentLine, commands])

  return (
    <section className="bg-muted/20 px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">How It Works</h2>
        </motion.div>

        {/* Workflow Map - Mind Map Visualization */}
        <WorkflowMap />

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
                <div className="text-gray-400">
                  <span className="text-cat-teal">$</span> {command.cmd}
                </div>
                <div className="ml-4 mt-1 text-gray-300">{command.output}</div>
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

        <div className="mt-12 text-center">
          <a
            href="https://github.com/jlopezlira/prjct-cli"
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>See Projects in Action</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
