import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Lightbulb,
  CheckCircle,
  HelpCircle,
  BarChart3,
  GitBranch,
  AlertCircle,
  Zap,
  BookOpen,
  Terminal,
  LucideIcon,
} from 'lucide-react'
import { typography, spacing, borders } from '../lib/typography-system'
import { animationPresets } from '../lib/animation-variants'
import { cn } from '../lib/utils'

interface Scenario {
  id: string
  title: string
  icon: LucideIcon
  description: string
  commands: {
    command: string
    description: string
    output: string
    preferred?: boolean
  }[]
}

const scenarios: Scenario[] = [
  {
    id: 'new-lost',
    title: "I'm new / lost / don't know what to do",
    icon: HelpCircle,
    description: 'First time using prjct or feeling confused',
    commands: [
      {
        command: 'p. help',
        description: 'Natural language - Contextual guide adapts to your state',
        output: '🎯 Analyzed your project → Showing relevant options',
        preferred: true,
      },
      {
        command: '/p:help',
        description: 'Direct command - Interactive contextual help',
        output: '💡 Here\'s what you can do based on your current state...',
      },
      {
        command: '/p:suggest',
        description: 'Smart recommendations based on momentum',
        output: '📊 Analysis: 5 tasks waiting → Suggests: /p:next',
      },
    ],
  },
  {
    id: 'know-what-not-how',
    title: 'I know what I want but not how to do it',
    icon: Lightbulb,
    description: 'Have an idea but unsure which commands to use',
    commands: [
      {
        command: 'p. I want to optimize performance',
        description: 'Natural language - Claude understands intent',
        output: '💡 Analyzing → /p:feature → Breakdown tasks → Auto-start',
        preferred: true,
      },
      {
        command: '/p:ask "improve performance"',
        description: 'Intent to action translator with explanations',
        output: '🎯 Recommended flow: /p:feature → /p:build → /p:done',
      },
      {
        command: '/p:suggest',
        description: 'If you\'re completely lost',
        output: '📊 Personalized next steps based on your context',
      },
    ],
  },
  {
    id: 'new-idea',
    title: 'I have a new feature to build',
    icon: Zap,
    description: 'Want to add value analysis, roadmap, and task breakdown',
    commands: [
      {
        command: 'p. add dark mode support',
        description: 'Natural language (full feature workflow)',
        output: '✨ Value: high | Tasks: 5 | Estimated: 4h',
        preferred: true,
      },
      {
        command: '/p:feature "add dark mode"',
        description: 'Direct command for feature workflow',
        output: '✨ Value: high | Tasks: 5 | Estimated: 4h',
      },
      {
        command: '/p:now "implement dark mode"',
        description: 'Start working without analysis',
        output: '🎯 Current task set',
      },
    ],
  },
  {
    id: 'task-complete',
    title: "I'm done with what I was doing",
    icon: CheckCircle,
    description: 'How do I mark it complete and what comes next?',
    commands: [
      {
        command: "p. I'm done",
        description: 'Natural language (zero memorization)',
        output: '✅ Complete! Next: API integration',
        preferred: true,
      },
      {
        command: '/p:done',
        description: 'Direct slash command',
        output: '✅ Complete! Next: API integration',
      },
      {
        command: '/p:ship "authentication system"',
        description: 'If it is an important feature',
        output: '🚀 SHIPPED! Authentication system 🎉',
      },
    ],
  },
  {
    id: 'stuck-problem',
    title: "I'm stuck with a problem",
    icon: AlertCircle,
    description: "Have an error or don't know how to solve something",
    commands: [
      {
        command: 'p. stuck on CORS error',
        description: 'Natural language',
        output: '💡 Solution: Add cors middleware\nnpm install cors',
        preferred: true,
      },
      {
        command: '/p:stuck "CORS error in API"',
        description: 'Direct command',
        output: '💡 Solution: Add cors middleware\nnpm install cors',
      },
      {
        command: '/p:fix "undefined is not a function"',
        description: 'Auto-diagnose errors',
        output: '🔧 Check: null/undefined before calling',
      },
    ],
  },
  {
    id: 'check-progress',
    title: 'I want to see my progress',
    icon: BarChart3,
    description: 'How am I doing? What have I achieved?',
    commands: [
      {
        command: 'p. show me my progress this week',
        description: 'Natural language (any timeframe)',
        output: '📈 Shipped: 7 | Velocity: 1.4/day | Trend: ↗️',
        preferred: true,
      },
      {
        command: '/p:progress week',
        description: 'Weekly metrics',
        output: '📈 Shipped: 7 | Velocity: 1.4/day | Trend: ↗️',
      },
      {
        command: '/p:progress month',
        description: 'Complete monthly view',
        output: '📊 Features: 23 | Tasks: 87 | Ideas: 42',
      },
    ],
  },
  {
    id: 'git-commit',
    title: 'I need to commit changes',
    icon: GitBranch,
    description: 'Save changes to git quickly',
    commands: [
      {
        command: 'p. commit these changes',
        description: 'Natural language (smart context)',
        output: '✅ feat: add payment system\n📝 3 files changed\n🌿 Ready for push',
        preferred: true,
      },
      {
        command: '/p:git',
        description: 'Direct slash command',
        output: '✅ feat: add payment system\n📝 3 files changed\n🌿 Ready for push',
      },
    ],
  },
]

export const CommandGuide = () => {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command)
    setCopiedCommand(command)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div
          {...animationPresets.standard}
          className={cn('text-center', spacing.headerMargin)}
        >
          <h2 className={cn(typography.sectionTitle, spacing.elementMargin)}>
            Which Command Should I Use When...?
          </h2>
          <p className={typography.sectionSubtitle}>Find the perfect command for every situation</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((scenario, index) => (
            <motion.div
              key={scenario.id}
              {...animationPresets.stagger(index)}
              className={cn(
                'cursor-pointer transition-all hover:shadow-lg',
                borders.rounded,
                spacing.cardPadding,
                selectedScenario === scenario.id
                  ? 'border-primary bg-primary/5'
                  : cn(borders.default, 'hover:border-primary/50')
              )}
              onClick={() =>
                setSelectedScenario(selectedScenario === scenario.id ? null : scenario.id)
              }
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <scenario.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
                    {scenario.title}
                  </h3>
                  <p className={cn(typography.muted, spacing.elementMargin)}>
                    {scenario.description}
                  </p>

                  {selectedScenario === scenario.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 space-y-3 border-t pt-4"
                    >
                      {scenario.commands.map((cmd, cmdIndex) => (
                        <div
                          key={cmdIndex}
                          className={`rounded-lg p-3 ${
                            cmd.preferred ? 'border border-primary/20 bg-primary/10' : 'bg-muted/50'
                          }`}
                        >
                          {cmd.preferred && (
                            <div
                              className={cn(
                                'flex items-center gap-1',
                                typography.mutedSmall,
                                'text-primary',
                                spacing.elementMarginSmall
                              )}
                            >
                              <Zap className="h-3 w-3" />
                              <span>Recommended</span>
                            </div>
                          )}
                          <div
                            className={cn(
                              'flex items-center justify-between',
                              spacing.elementMarginSmall
                            )}
                          >
                            <code
                              className={cn(typography.code, 'cursor-pointer hover:text-primary')}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyCommand(cmd.command)
                              }}
                            >
                              {cmd.command}
                            </code>
                            {copiedCommand === cmd.command && (
                              <span className={cn(typography.mutedSmall, 'text-cat-green')}>
                                Copied!
                              </span>
                            )}
                          </div>
                          <p className={cn(typography.mutedSmall, spacing.elementMarginSmall)}>
                            {cmd.description}
                          </p>
                          <div
                            className={cn(
                              'rounded bg-black/50 p-2 text-cat-teal',
                              typography.codeSmall
                            )}
                          >
                            → {cmd.output}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick Reference Matrix */}
        <motion.div
          {...animationPresets.standard}
          className={cn('mt-16 bg-muted/20', borders.rounded, spacing.cardPaddingLarge)}
        >
          <h3
            className={cn(
              typography.subsectionTitle,
              'flex items-center gap-2',
              spacing.elementMarginLarge
            )}
          >
            <Terminal className="h-6 w-6" />
            Quick Decision Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className={cn('w-full', typography.bodySmall)}>
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 text-left">Situation</th>
                  <th className="py-2 pr-4 text-left">Main Command</th>
                  <th className="py-2 text-left">Alternatives</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-primary/5">
                  <td className="py-3 pr-4 font-semibold">I'm new/lost</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>p. help</td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>
                    /p:help | /p:suggest
                  </td>
                </tr>
                <tr className="border-b bg-primary/5">
                  <td className="py-3 pr-4 font-semibold">I want to... (but don't know how)</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>
                    p. I want [intent]
                  </td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>
                    /p:ask "[intent]"
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">I have a new feature</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>
                    p. add [feature]
                  </td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>
                    /p:feature | /p:now
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Finished my task</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>p. I'm done</td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>
                    /p:done | /p:ship
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Don't know what to do next</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>p. what next</td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>
                    /p:suggest | /p:next
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Have an error</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>
                    p. stuck on [error]
                  </td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>/p:stuck</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Ready to ship</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>p. ship this</td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>
                    /p:ship [feature]
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Need metrics</td>
                  <td className={cn('py-3 pr-4 text-primary', typography.code)}>
                    p. show progress
                  </td>
                  <td className={cn('py-3 text-muted-foreground', typography.code)}>
                    /p:progress | /p:recap
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Workflow Examples */}
        <motion.div {...animationPresets.standard} className="mt-12 text-center">
          <Link
            to="/workflows"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground transition hover:opacity-90"
          >
            <BookOpen className="h-5 w-5" />
            See Complete Workflows
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
