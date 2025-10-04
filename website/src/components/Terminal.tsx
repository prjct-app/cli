import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import WorkflowMap from './WorkflowMap'

const terminalConfigs = [
  {
    name: 'Claude Code - SaaS MVP',
    commands: [
      { cmd: '/p:init', output: '✅ Project initialized in .prjct/', delay: 500 },
      {
        cmd: '/p:feature "AI-powered code review tool"',
        output:
          '✨ Value Analysis:\n• Impact: HIGH\n• Effort: 12h\n• Tasks: 5\n• Timing: Start now',
        delay: 900,
      },
      {
        cmd: '/p:done',
        output: '✅ Task complete: Setup Next.js + TypeScript\n💡 Next: GitHub OAuth integration',
        delay: 800,
      },
      {
        cmd: '/p:done',
        output: '✅ Task complete: GitHub OAuth\n💡 Next: AI review engine',
        delay: 700,
      },
      {
        cmd: '/p:ship "AI code review platform"',
        output: '🚀 SHIPPED: AI Code Review Platform!\n🎉 Feature complete with 5 tasks',
        delay: 900,
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
    name: 'Claude Code - Mobile App',
    commands: [
      {
        cmd: '/p:init',
        output:
          '✅ Project initialized in .prjct/\n🔍 Analyzing...\n• Stack: React Native + Expo\n• Components: 12 created',
        delay: 900,
      },
      {
        cmd: '/p:feature "implement navigation system"',
        output:
          '✨ Value Analysis:\n• Impact: HIGH\n• Effort: 4h\n• Tasks: 3\n  1. Install React Navigation\n  2. Create tab navigator\n  3. Setup deep linking',
        delay: 1000,
      },
      {
        cmd: '/p:done',
        output: '✅ Task complete: React Navigation installed\n💡 Next: Create tab navigator',
        delay: 700,
      },
      {
        cmd: '/p:ship "navigation system"',
        output: '🚀 SHIPPED: Complete navigation with deep linking!\n🎉 All 3 tasks complete',
        delay: 800,
      },
      {
        cmd: '/p:next',
        output: '📋 Priority Queue:\n  1. Push notifications\n  2. Offline mode\n  3. Dark theme',
        delay: 600,
      },
    ],
  },
  {
    name: 'Claude Code - API Service',
    commands: [
      {
        cmd: '/p:feature "serverless API with rate limiting"',
        output: '✨ Value Analysis:\n• Impact: HIGH\n• Effort: 8h\n• Tasks: 4\n• Timing: Start now',
        delay: 700,
      },
      {
        cmd: '/p:done',
        output: '✅ Task complete: Core API structure\n💡 Next: Implement rate limiting',
        delay: 600,
      },
      {
        cmd: '/p:stuck "Redis connection timeout"',
        output:
          '💡 Solution:\n• Check Redis URL format\n• Add connection pooling\n• Set timeout to 5000ms\n• Use connection retry logic',
        delay: 900,
      },
      {
        cmd: '/p:done',
        output: '🔧 Fixed: Added connection pool with retry\n✅ Redis rate limiting working',
        delay: 700,
      },
      {
        cmd: '/p:ship "rate limiting system"',
        output:
          '🚀 SHIPPED: Serverless API with Rate Limiting!\n🎉 4 tasks complete\n📊 Ready for production',
        delay: 900,
      },
      {
        cmd: '/p:recap',
        output:
          '📊 Project Overview:\n🚀 Shipped: 9 features\n🎯 Current: None (ready for next)\n📈 Velocity: 2.1 features/week\n✨ Momentum: High',
        delay: 1000,
      },
    ],
  },
  {
    name: 'Claude Code - CLI Tool',
    commands: [
      {
        cmd: '/p:recap',
        output:
          '📊 PROJECT RECAP\n━━━━━━━━━━━━━\n🎯 Current: None (ready for next feature)\n📈 This week: 8 shipped\n🔥 Velocity: 1.6 features/day',
        delay: 700,
      },
      {
        cmd: '/p:feature "comprehensive documentation"',
        output:
          '✨ Value Analysis:\n• Impact: HIGH (adoption)\n• Effort: 6h\n• Tasks: 5\n  1. Command reference\n  2. Installation guide\n  3. API examples\n  4. Video tutorials\n  5. FAQ section',
        delay: 1000,
      },
      {
        cmd: '/p:progress month',
        output:
          '📊 Monthly Stats:\n• Features shipped: 24\n• Tasks completed: 92\n• Features added: 18\n• Velocity trend: ↗️ +15%',
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
