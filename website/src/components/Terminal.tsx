import { motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'

const terminalConfigs = [
  {
    name: 'Complete Flow - From Install to Ship',
    commands: [
      {
        cmd: 'npm install -g prjct-cli',
        output:
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 Setting up prjct-cli...\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n[1/5] Detecting Claude Code...\n✓ Claude Code found\n\n[2/5] Installing commands to ~/.claude...\n✓ 25 commands installed\n\n[3/5] Installing global configuration...\n✓ Created ~/.claude/CLAUDE.md\n\n[4/5] Checking for legacy projects...\nNo legacy projects found\n\n[5/5] Installation complete!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n   ██████╗ ██████╗      ██╗ ██████╗████████╗\n   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝\n   ██████╔╝██████╔╝     ██║██║        ██║\n   ██╔═══╝ ██╔══██╗██   ██║██║        ██║\n   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║\n   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝\n\n   prjct/cli  v0.8.2 installed\n\n   ⚡ Ship faster with zero friction\n   📝 From idea to technical tasks in minutes\n   🤖 Perfect context for AI agents\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🚀 Quick Start\n─────────────────────────────────────────────────\n\n  1. Initialize your project:\n     cd your-project && prjct init\n\n  2. Set your current focus:\n     prjct now "build auth"\n\n  3. Ship & celebrate:\n     prjct ship "user login"\n\n─────────────────────────────────────────────────\n\nHappy shipping! 🚀',
        delay: 2000,
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

// Extracted terminal content without section wrapper
export const TerminalContent = () => {
  const [currentLine, setCurrentLine] = useState(0)
  const [displayedCommands, setDisplayedCommands] = useState<
    (typeof terminalConfigs)[0]['commands']
  >([])
  const [isTyping, setIsTyping] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const currentTerminal = terminalConfigs[0]
  const commands = currentTerminal.commands

  // Auto-scroll to bottom when new command is added
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [displayedCommands])

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
    <div className="rounded-2xl border border-gray-800 bg-black shadow-2xl">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-8 py-4">
        <div className="h-3 w-3 rounded-full bg-cat-maroon" />
        <div className="h-3 w-3 rounded-full bg-cat-yellow" />
        <div className="h-3 w-3 rounded-full bg-cat-green" />
        <span className="ml-4 font-mono text-sm text-gray-400">{currentTerminal.name}</span>
      </div>

      {/* Terminal content with scroll */}
      <div
        ref={scrollContainerRef}
        className="max-h-[65vh] space-y-3 overflow-y-auto p-8 font-mono text-sm md:text-base"
      >
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
            <div className="ml-4 mt-1 whitespace-pre-wrap text-gray-300">{command.output}</div>
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
    </div>
  )
}

// Original Terminal component (kept for backward compatibility)
export const Terminal = () => {
  return <TerminalContent />
}
