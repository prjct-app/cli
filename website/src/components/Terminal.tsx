import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import WorkflowMap from './WorkflowMap'

const terminalConfigs = [
  {
    name: 'Complete Flow - From Install to Ship',
    commands: [
      {
        cmd: 'npm install -g prjct-cli',
        output: '📦 Installing prjct-cli...\n✅ Installed successfully!',
        delay: 800,
      },
      {
        cmd: 'cd my-saas-app',
        output: '',
        delay: 300,
      },
      {
        cmd: 'prjct init',
        output:
          '✅ prjct initialized!\n📁 Data: ~/.prjct-cli/projects/abc123\n📊 Analyzing stack...\n🤖 Agents: 6 generated',
        delay: 1000,
      },
      {
        cmd: '',
        output: '\n💬 Talk to Claude Code in your editor...',
        delay: 500,
      },
      {
        cmd: '# In Claude Code:',
        output: '',
        delay: 400,
      },
      {
        cmd: 'p. I want to add user authentication',
        output:
          '💡 I understand: Implementing authentication\n📊 Analyzing value...\n\n✨ Value Analysis:\n  • Impact: HIGH (core feature)\n  • Effort: 8h\n  • Timing: Start now\n\n📋 Tasks created:\n  1. Setup auth provider (Clerk/Auth0)\n  2. Implement login/signup UI\n  3. Add protected routes\n  4. Session management\n  5. Testing\n\n🎯 Started: Task 1 - Setup auth provider\n⏱️  Time tracking: ON',
        delay: 1500,
      },
      {
        cmd: '# ...work on tasks...',
        output: '',
        delay: 400,
      },
      {
        cmd: 'p. I\'m done',
        output:
          '✅ Task complete: Setup auth provider (2h 15m)\n💡 Auto-starting next: Implement login/signup UI\n🎯 Progress: 20% (1/5 tasks)',
        delay: 900,
      },
      {
        cmd: '# ...complete remaining tasks...',
        output: '',
        delay: 400,
      },
      {
        cmd: 'p. ship this',
        output:
          '🚀 SHIPPING: User Authentication\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Lint: Passed\n✅ Tests: Passed\n📝 Updating CHANGELOG...\n🌿 Git: Committed & pushed\n\n🎉 SHIPPED: User Authentication!\n📊 5 tasks complete | 7h 45m total\n\nMomentum: Keep shipping! 🔥',
        delay: 1200,
      },
    ],
  },
]

export const Terminal = () => {
  const [currentLine, setCurrentLine] = useState(0)
  const [displayedCommands, setDisplayedCommands] = useState<
    (typeof terminalConfigs)[0]['commands']
  >([])
  const [isTyping, setIsTyping] = useState(false)

  const currentTerminal = terminalConfigs[0]
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
        currentLine === 0 ? 1000 : 3500 // More time between steps
      )

      return () => clearTimeout(timer)
    } else if (currentLine === commands.length) {
      setTimeout(() => {
        setDisplayedCommands([])
        setCurrentLine(0)
      }, 12000) // Wait 12 seconds before restarting
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
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">See It In Action</h2>
          <p className="text-lg text-muted-foreground">
            From installation to shipping - the complete flow
          </p>
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
