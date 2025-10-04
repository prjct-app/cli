import { useState } from 'react'
import { CommandGuide } from '../components/CommandGuide'
import { motion } from 'framer-motion'
import {
  Terminal,
  Zap,
  Target,
  Lightbulb,
  BarChart3,
  Palette,
  HelpCircle,
  Code2,
  Sparkles,
  Rocket,
  Github,
} from 'lucide-react'

// Import command registry - SINGLE SOURCE OF TRUTH
import registry from '../data/command-registry'

// Types for command registry
interface CommandUsage {
  claude: string | null
  terminal: string | null
}

interface Command {
  name: string
  category: string
  description: string
  usage: CommandUsage
  params: string | null
  implemented: boolean
  hasTemplate: boolean
  icon: string
}

interface CategoryInfo {
  title: string
  icon: string
  description: string
}

interface CategoryCommand {
  cmd: string
  desc: string
  platforms: {
    claude: string
    terminal: string
  }
  implemented: boolean
}

const platforms = [
  { id: 'claude', label: 'Claude Code', icon: <Code2 className="h-4 w-4" /> },
  { id: 'terminal', label: 'Terminal (Limited)', icon: <Terminal className="h-4 w-4" /> },
] as const

type PlatformId = (typeof platforms)[number]['id']

// Icon mapping
const iconComponents = {
  Target: Target,
  Lightbulb: Lightbulb,
  Palette: Palette,
  Zap: Zap,
  BarChart3: BarChart3,
  HelpCircle: HelpCircle,
  Github: Github,
  Rocket: Rocket,
  Terminal: Terminal,
}

// Generate command categories from registry
const commandCategories = (Object.entries(registry.getCategories()) as [string, CategoryInfo][])
  .filter(([categoryKey]) => {
    // Filter categories that have Claude commands
    const cmds = registry.getByCategory(categoryKey)
    return cmds.some((cmd: Command) => cmd.usage.claude !== null)
  })
  .map(([categoryKey, categoryInfo]) => {
    const IconComponent =
      iconComponents[categoryInfo.icon as keyof typeof iconComponents] || HelpCircle
    const categoryCommands = registry
      .getByCategory(categoryKey)
      .filter((cmd: Command) => cmd.usage.claude !== null) // Only show Claude-available commands

    return {
      title: categoryInfo.title,
      icon: <IconComponent className="h-5 w-5" />,
      commands: categoryCommands.map((cmd: Command) => ({
        cmd: `/p:${cmd.name}${cmd.params ? ` ${cmd.params}` : ''}`,
        desc: cmd.description,
        platforms: {
          claude: cmd.usage.claude || `Not available in Claude`,
          terminal: cmd.usage.terminal || `Not available in terminal`,
        },
        implemented: cmd.implemented,
      })),
    }
  })
  .filter((category) => category.commands.length > 0)

export const Commands = () => {
  const [activePlatform, setActivePlatform] = useState<PlatformId>('claude')

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-7xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Complete Command Reference</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">All prjct Commands</h1>
          <p className="mx-auto mb-4 max-w-2xl text-xl text-muted-foreground">
            {registry.getStats().implemented} implemented / {registry.getStats().total} total
            commands, built for Claude Code
          </p>

          {/* Natural Language Callout */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mb-8 max-w-3xl rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-6"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/20 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  💬 Don't Memorize - Just Talk!
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  You don't need to memorize these commands. Just talk naturally in Claude Code:
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-primary">→</span>
                    <span>"p. I want to start building the login page"</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-primary">→</span>
                    <span>"p. I'm done" or "p. ship this feature"</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-primary">→</span>
                    <span>
                      Try <code className="rounded bg-muted px-1 py-0.5 text-primary">/p:help</code>{' '}
                      for an interactive guide
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Global Platform Selector */}
          <div className="mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-lg border border-border bg-background/50 p-1">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setActivePlatform(platform.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  activePlatform === platform.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {platform.icon}
                <span className="whitespace-nowrap">{platform.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Command Categories */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {commandCategories.map((category, index) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-2xl border border-border p-6 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">{category.icon}</div>
                  <h2 className="text-xl font-semibold">{category.title}</h2>
                </div>
                <div className="space-y-4">
                  {category.commands.map((command: CategoryCommand) => (
                    <div key={command.cmd} className="flex flex-col gap-2">
                      <span className="text-sm text-muted-foreground">{command.desc}</span>
                      <motion.code
                        key={activePlatform}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="block rounded-md bg-muted/50 px-3 py-2 font-mono text-sm text-primary"
                      >
                        {command.platforms[activePlatform]}
                      </motion.code>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Command Guide Component */}
      <CommandGuide />
    </div>
  )
}
