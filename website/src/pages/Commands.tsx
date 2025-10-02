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

const platforms = [
  { id: 'claude', label: 'Claude Code', icon: <Code2 className="h-4 w-4" /> },
  { id: 'terminal', label: 'Terminal (Limited)', icon: <Terminal className="h-4 w-4" /> },
] as const

type PlatformId = (typeof platforms)[number]['id']

const commandCategories = [
  {
    title: 'Work Commands',
    icon: <Target className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:now [task]',
        desc: 'Set or show current task',
        platforms: {
          claude: '/p:now "implement authentication system"',
          terminal: 'prjct now "implement authentication system"',
        },
      },
      {
        cmd: '/p:next',
        desc: 'Show priority queue',
        platforms: {
          claude: '/p:next',
          terminal: 'prjct next',
        },
      },
      {
        cmd: '/p:done',
        desc: 'Complete current task',
        platforms: {
          claude: '/p:done',
          terminal: 'prjct done',
        },
      },
      {
        cmd: '/p:ship <feature>',
        desc: 'Ship and celebrate a feature',
        platforms: {
          claude: '/p:ship "user authentication system"',
          terminal: 'prjct ship "user authentication system"',
        },
      },
    ],
  },
  {
    title: 'Planning Commands',
    icon: <Lightbulb className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:idea <text>',
        desc: 'Capture ideas quickly',
        platforms: {
          claude: '/p:idea "add dark mode"',
          terminal: 'prjct idea "add dark mode"',
        },
      },
      {
        cmd: '/p:roadmap',
        desc: 'Show or update strategic roadmap',
        platforms: {
          claude: '/p:roadmap',
          terminal: 'prjct roadmap',
        },
      },
      {
        cmd: '/p:task <description>',
        desc: 'Break down and execute complex tasks',
        platforms: {
          claude: '/p:task "implement authentication"',
          terminal: 'prjct task "implement authentication"',
        },
      },
    ],
  },
  {
    title: 'Design & Architecture',
    icon: <Palette className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:design [target] --type architecture|api|component|database|flow',
        desc: 'Design system architecture, APIs, and component interfaces',
        platforms: {
          claude: '/p:design authentication --type architecture',
          terminal: 'prjct design authentication --type architecture',
        },
      },
    ],
  },
  {
    title: 'Code Quality',
    icon: <Zap className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:cleanup',
        desc: 'Clean up temp files and old entries',
        platforms: {
          claude: '/p:cleanup',
          terminal: 'prjct cleanup',
        },
      },
      {
        cmd: '/p:cleanup --type code',
        desc: 'Remove dead code and unused imports',
        platforms: {
          claude: '/p:cleanup --type code',
          terminal: 'prjct cleanup --type code',
        },
      },
    ],
  },
  {
    title: 'Progress Commands',
    icon: <BarChart3 className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:recap',
        desc: 'Show project overview with progress',
        platforms: {
          claude: '/p:recap',
          terminal: 'prjct recap',
        },
      },
      {
        cmd: '/p:progress [period]',
        desc: 'Show progress metrics for specified period',
        platforms: {
          claude: '/p:progress week',
          terminal: 'prjct progress week',
        },
      },
      {
        cmd: '/p:context',
        desc: 'Show project context and recent activity',
        platforms: {
          claude: '/p:context',
          terminal: 'prjct context',
        },
      },
    ],
  },
  {
    title: 'Help Commands',
    icon: <HelpCircle className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:init',
        desc: 'Initialize prjct in current project',
        platforms: {
          claude: '/p:init',
          terminal: 'prjct init',
        },
      },
      {
        cmd: '/p:stuck <issue description>',
        desc: 'Get contextual help with problems',
        platforms: {
          claude: '/p:stuck "CORS error in API calls"',
          terminal: 'prjct stuck "CORS error in API calls"',
        },
      },
      {
        cmd: '/p:fix [error]',
        desc: 'Quick troubleshooting and automatic fixes',
        platforms: {
          claude: '/p:fix "undefined is not a function"',
          terminal: 'prjct fix "undefined is not a function"',
        },
      },
      {
        cmd: '/p:analyze',
        desc: 'Analyze repository and sync tasks',
        platforms: {
          claude: '/p:analyze',
          terminal: 'prjct analyze',
        },
      },
    ],
  },
  {
    title: 'Version Control',
    icon: <Github className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:git',
        desc: 'Smart git operations with context',
        platforms: {
          claude: '/p:git',
          terminal: 'prjct git',
        },
      },
    ],
  },
  {
    title: 'Testing',
    icon: <Rocket className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:test',
        desc: 'Run tests and auto-fix simple failures',
        platforms: {
          claude: '/p:test',
          terminal: 'prjct test',
        },
      },
    ],
  },
]

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
            18 commands, built for Claude Code
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
                    <span>Try <code className="rounded bg-muted px-1 py-0.5 text-primary">/p:help</code> for an interactive guide</span>
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
                  {category.commands.map((command) => (
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
