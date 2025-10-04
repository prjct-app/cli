import { motion } from 'framer-motion'
import { Check, Bot, Zap, GitBranch, MessageSquare, Sparkles, Shield, Rocket } from 'lucide-react'
import { typography, spacing, borders } from '../lib/typography-system'
import { animationPresets } from '../lib/animation-variants'
import { cn } from '../lib/utils'

const superpowers = [
  {
    name: 'Dynamic AI Agents',
    icon: Bot,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
    description: 'Auto-generated specialists that understand your project',
    features: [
      'Coordinator - Progress tracking & shipping',
      'Frontend Agent - UI/UX implementation',
      'Backend Agent - API & infrastructure',
      'QA Agent - Testing & validation',
      'Scribe Agent - Documentation',
      'Security, DevOps, Mobile, Data specialists',
    ],
    impossible:
      "Requires Claude's agent system - impossible to replicate with multi-platform support",
  },
  {
    name: 'Native MCP Integration',
    icon: Sparkles,
    color: 'text-cat-mauve',
    bgColor: 'bg-cat-mauve/10',
    borderColor: 'border-cat-mauve/20',
    description: 'Deep Claude-native protocol integration',
    features: [
      'Context7 - Official library docs',
      'Sequential - Multi-step reasoning',
      'Magic - UI component generation',
      'Playwright - Browser automation',
      'Real-time context sharing',
      'Zero-config activation',
    ],
    impossible: "MCP is Claude-native - can't replicate with other platforms",
  },
  {
    name: 'Git Validation',
    icon: GitBranch,
    color: 'text-cat-green',
    bgColor: 'bg-cat-green/10',
    borderColor: 'border-cat-green/20',
    description: 'Last commit as source of truth',
    features: [
      'Validates work against actual changes',
      'No empty claims or false progress',
      'Links tasks to real commits',
      'Automatic diff analysis',
      'Branch-aware context',
      'Commit message integration',
    ],
    impossible: 'Requires tight Claude integration for semantic git analysis',
  },
  {
    name: 'p. Trigger - Zero Memorization',
    icon: MessageSquare,
    color: 'text-cat-sapphire',
    bgColor: 'bg-cat-sapphire/10',
    borderColor: 'border-cat-sapphire/20',
    description: 'Talk naturally with p. prefix',
    features: [
      '"p. I\'m done" → /p:done',
      '"p. add auth feature" → /p:feature',
      '"p. ship this" → /p:ship',
      'Works in English, Spanish, any language',
      'Intent detection, not pattern matching',
      'No commands to memorize',
    ],
    impossible: "Leverages Claude's language understanding - not possible elsewhere",
  },
]

const technicalBenefits = [
  {
    icon: Zap,
    title: '50-60% Less Code',
    description: 'Eliminated multi-platform complexity',
    detail: '800+ lines → 228 lines in command installer',
  },
  {
    icon: Rocket,
    title: 'Faster Features',
    description: 'Focus = Speed',
    detail: 'Ship new features 2-3x faster',
  },
  {
    icon: Shield,
    title: 'Proper Testing',
    description: 'Only claim what we validate',
    detail: 'Test everything with real Claude integration',
  },
  {
    icon: Check,
    title: 'Honest Compatibility',
    description: 'No false promises',
    detail: 'If it says "works", it actually works',
  },
]

export const ClaudeSuperpowers = () => {
  return (
    <section id="superpowers" className="bg-surface px-4 py-20">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          {...animationPresets.standard}
          className={cn('text-center', spacing.headerMarginLarge)}
        >
          <h2 className={cn(typography.sectionTitle, spacing.elementMargin)}>
            <span className="hunt-glow">Superpowers</span> Unlocked by Claude
          </h2>
          <p className={cn(typography.sectionSubtitle, 'mx-auto max-w-3xl')}>
            By focusing 100% on Claude, we deliver features that would be{' '}
            <span className="font-semibold text-primary">impossible</span> with multi-platform
            support.
          </p>
        </motion.div>

        {/* Main Superpowers Grid */}
        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
          {superpowers.map((superpower, index) => (
            <motion.div key={index} {...animationPresets.stagger(index)}>
              <div
                className={`h-full border bg-card p-8 ${superpower.borderColor} rounded-2xl transition-shadow hover:shadow-lg`}
              >
                {/* Header */}
                <div className="mb-6 flex items-start gap-4">
                  <div className={`rounded-xl p-3 ${superpower.bgColor}`}>
                    <superpower.icon className={`h-8 w-8 ${superpower.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn(typography.cardTitleLarge, spacing.elementMarginSmall)}>
                      {superpower.name}
                    </h3>
                    <p className={typography.muted}>{superpower.description}</p>
                  </div>
                </div>

                {/* Features */}
                <div className={spacing.elementMarginLarge}>
                  <ul className={spacing.stackTight}>
                    {superpower.features.map((feature, i) => (
                      <li key={i} className={cn('flex items-start gap-2', typography.bodySmall)}>
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-cat-green" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Why Impossible Without Claude */}
                <div className={cn(borders.default, 'border-t pt-4')}>
                  <p className={cn(typography.mutedSmall, 'italic')}>
                    💡 <span className="font-medium">Why Claude-only:</span> {superpower.impossible}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Technical Benefits */}
        <motion.div
          {...animationPresets.standardWithDelay(0.3)}
          className={cn(
            borders.rounded,
            borders.default,
            'mb-16 bg-card',
            spacing.cardPaddingLarge
          )}
        >
          <h3 className={cn(typography.subsectionTitle, 'text-center', spacing.elementMarginLarge)}>
            Technical Benefits
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {technicalBenefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h4 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
                  {benefit.title}
                </h4>
                <p className={cn(typography.muted, spacing.elementMarginSmall)}>
                  {benefit.description}
                </p>
                <p className={cn(typography.codeSmall, 'text-primary')}>{benefit.detail}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Philosophy Statement */}
        <motion.div
          {...animationPresets.standardWithDelay(0.4)}
          className={cn(
            borders.rounded,
            borders.primary,
            'bg-gradient-to-br from-primary/5 to-primary/10 text-center',
            spacing.cardPaddingLarge
          )}
        >
          <h3 className={cn(typography.subsectionTitle, spacing.elementMargin)}>
            This Isn't a Limitation — It's a <span className="hunt-glow">Strategic Decision</span>
          </h3>
          <p
            className={cn(
              typography.sectionSubtitleSmall,
              'mx-auto max-w-3xl',
              spacing.elementMarginLarge
            )}
          >
            By specializing in Claude, we can build features that would be impossible with
            multi-platform support. Every line of code is optimized for one thing:{' '}
            <span className="font-semibold text-primary">helping you ship fast with Claude</span>.
          </p>
          <div className={cn('flex flex-wrap justify-center gap-4', typography.bodySmall)}>
            <div className="rounded-full bg-background px-4 py-2">🚀 Ship faster</div>
            <div className="rounded-full bg-background px-4 py-2">🎯 Deeper integrations</div>
            <div className="rounded-full bg-background px-4 py-2">💯 Better quality</div>
            <div className="rounded-full bg-background px-4 py-2">🤝 Honest compatibility</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
