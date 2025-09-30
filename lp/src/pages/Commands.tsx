import { CommandGuide } from '../components/CommandGuide'
import { motion } from 'framer-motion'
import { Terminal, Zap, GitBranch, Target, Lightbulb, BarChart3, Palette, Code2 } from 'lucide-react'

const commandCategories = [
  {
    title: 'Work Commands',
    icon: <Target className="h-5 w-5" />,
    commands: [
      { cmd: '/p:now [task]', desc: 'Set or show current task' },
      { cmd: '/p:next', desc: 'Show priority queue' },
      { cmd: '/p:done', desc: 'Complete current task' },
      { cmd: '/p:ship <feature>', desc: 'Ship and celebrate a feature' },
    ],
  },
  {
    title: 'Planning Commands',
    icon: <Lightbulb className="h-5 w-5" />,
    commands: [
      { cmd: '/p:idea <text>', desc: 'Capture ideas quickly' },
      { cmd: '/p:roadmap', desc: 'View strategic roadmap' },
      { cmd: '/p:roadmap add', desc: 'Add feature to roadmap' },
      { cmd: '/p:task <feature>', desc: 'Break down complex tasks' },
    ],
  },
  {
    title: 'Design & Architecture',
    icon: <Palette className="h-5 w-5" />,
    commands: [
      { cmd: '/p:design <target> --type', desc: 'Create system designs with diagrams' },
      { cmd: '/p:design --architecture', desc: 'Design system architecture' },
      { cmd: '/p:design --api', desc: 'Design REST/GraphQL APIs' },
      { cmd: '/p:design --database', desc: 'Design database schemas' },
    ],
  },
  {
    title: 'Code Quality',
    icon: <Code2 className="h-5 w-5" />,
    commands: [
      { cmd: '/p:cleanup', desc: 'Clean temporary files and old entries' },
      { cmd: '/p:cleanup-advanced --type', desc: 'Remove dead code by type' },
      { cmd: '/p:cleanup-advanced --aggressive', desc: 'Deep clean with analysis' },
      { cmd: '/p:cleanup-advanced --imports', desc: 'Optimize and clean imports' },
    ],
  },
  {
    title: 'Progress Commands',
    icon: <BarChart3 className="h-5 w-5" />,
    commands: [
      { cmd: '/p:recap', desc: 'Overview of progress' },
      { cmd: '/p:progress [period]', desc: 'Show progress metrics' },
      { cmd: '/p:context', desc: 'Show project context' },
    ],
  },
  {
    title: 'Git Integration',
    icon: <GitBranch className="h-5 w-5" />,
    commands: [
      { cmd: '/p:git', desc: 'Commit with smart message' },
      { cmd: '/p:git push', desc: 'Commit and push' },
      { cmd: '/p:git sync', desc: 'Pull, commit, and push' },
    ],
  },
  {
    title: 'Help Commands',
    icon: <Zap className="h-5 w-5" />,
    commands: [
      { cmd: '/p:stuck <issue>', desc: 'Get help with problems' },
      { cmd: '/p:fix <error>', desc: 'Auto-diagnose errors' },
      { cmd: '/p:analyze', desc: 'Analyze repository' },
      { cmd: '/p:init', desc: 'Initialize project' },
    ],
  },
]

export const Commands = () => {
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
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Master every command to maximize your productivity
          </p>
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
                <div className="space-y-3">
                  {category.commands.map((command) => (
                    <div key={command.cmd} className="flex flex-col">
                      <code className="mb-1 font-mono text-sm text-primary">{command.cmd}</code>
                      <span className="text-sm text-muted-foreground">{command.desc}</span>
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
