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
  Cpu,
  Wind,
  Sparkles,
  Rocket,
  Github,
} from 'lucide-react'

const platforms = [
  { id: 'claude', label: 'Claude Code', icon: <Code2 className="h-4 w-4" /> },
  { id: 'codex', label: 'OpenAI Codex', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'windsurf', label: 'Windsurf', icon: <Wind className="h-4 w-4" /> },
  { id: 'cursor', label: 'Cursor', icon: <Cpu className="h-4 w-4" /> },
  { id: 'terminal', label: 'Terminal', icon: <Terminal className="h-4 w-4" /> },
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
          claude: '/p:now "your task"',
          codex: 'prjct now "your task"',
          windsurf: 'p:now "your task"',
          cursor: '/p:now "your task"',
          terminal: 'prjct now "your task"',
        },
      },
      {
        cmd: '/p:next',
        desc: 'Show priority queue',
        platforms: {
          claude: '/p:next',
          codex: 'prjct next',
          windsurf: 'p:next',
          cursor: '/p:next',
          terminal: 'prjct next',
        },
      },
      {
        cmd: '/p:done',
        desc: 'Complete current task',
        platforms: {
          claude: '/p:done',
          codex: 'prjct done',
          windsurf: 'p:done',
          cursor: '/p:done',
          terminal: 'prjct done',
        },
      },
      {
        cmd: '/p:ship <feature>',
        desc: 'Ship and celebrate a feature',
        platforms: {
          claude: '/p:ship "authentication"',
          codex: 'prjct ship "authentication"',
          windsurf: 'p:ship "authentication"',
          cursor: '/p:ship "authentication"',
          terminal: 'prjct ship "authentication"',
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
          codex: 'prjct idea "add dark mode"',
          windsurf: 'p:idea "add dark mode"',
          cursor: '/p:idea "add dark mode"',
          terminal: 'prjct idea "add dark mode"',
        },
      },
    ],
  },
  {
    title: 'Design & Architecture',
    icon: <Palette className="h-5 w-5" />,
    commands: [
      {
        cmd: '/p:design <target> --type',
        desc: 'Create system designs with diagrams',
        platforms: {
          claude: '/p:design "auth system" --type architecture',
          codex: 'prjct design "auth system" --type architecture',
          windsurf: 'p:design "auth system" --type architecture',
          cursor: '/p:design "auth system" --type architecture',
          terminal: 'prjct design "auth system" --type architecture',
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
        desc: 'Basic cleanup of temp files',
        platforms: {
          claude: '/p:cleanup',
          codex: 'prjct cleanup',
          windsurf: 'p:cleanup',
          cursor: '/p:cleanup',
          terminal: 'prjct cleanup',
        },
      },
      {
        cmd: '/p:cleanup-advanced --type',
        desc: 'Advanced code cleanup and optimization',
        platforms: {
          claude: '/p:cleanup-advanced --type code',
          codex: 'prjct cleanup-advanced --type code',
          windsurf: 'p:cleanup-advanced --type code',
          cursor: '/p:cleanup-advanced --type code',
          terminal: 'prjct cleanup-advanced --type code',
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
        desc: 'Overview of progress',
        platforms: {
          claude: '/p:recap',
          codex: 'prjct recap',
          windsurf: 'p:recap',
          cursor: '/p:recap',
          terminal: 'prjct recap',
        },
      },
      {
        cmd: '/p:progress [period]',
        desc: 'Show progress metrics',
        platforms: {
          claude: '/p:progress week',
          codex: 'prjct progress week',
          windsurf: 'p:progress week',
          cursor: '/p:progress week',
          terminal: 'prjct progress week',
        },
      },
      {
        cmd: '/p:context',
        desc: 'Show project context',
        platforms: {
          claude: '/p:context',
          codex: 'prjct context',
          windsurf: 'p:context',
          cursor: '/p:context',
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
        cmd: '/p:stuck <issue>',
        desc: 'Get help with problems',
        platforms: {
          claude: '/p:stuck "CORS error in API"',
          codex: 'prjct stuck "CORS error in API"',
          windsurf: 'p:stuck "CORS error in API"',
          cursor: '/p:stuck "CORS error in API"',
          terminal: 'prjct stuck "CORS error in API"',
        },
      },
      {
        cmd: '/p:analyze',
        desc: 'Analyze repository',
        platforms: {
          claude: '/p:analyze',
          codex: 'prjct analyze',
          windsurf: 'p:analyze',
          cursor: '/p:analyze',
          terminal: 'prjct analyze',
        },
      },
      {
        cmd: '/p:init',
        desc: 'Initialize project',
        platforms: {
          claude: '/p:init',
          codex: 'prjct init',
          windsurf: 'p:init',
          cursor: '/p:init',
          terminal: 'prjct init',
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
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            19 commands, unified across 5 platforms
          </p>

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
