import { motion } from 'framer-motion'
import { Check, Bot, Zap, GitBranch, MessageSquare, Sparkles, Shield, Rocket } from 'lucide-react'

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
    impossible: 'Requires Claude\'s agent system - impossible to replicate with multi-platform support',
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
    impossible: 'MCP is Claude-native - can\'t replicate with other platforms',
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
      '"p. start building auth" → /p:now',
      '"p. ship this feature" → /p:ship',
      'Works in English, Spanish, any language',
      'Intent detection, not pattern matching',
      'No commands to memorize',
    ],
    impossible: 'Leverages Claude\'s language understanding - not possible elsewhere',
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
    <section id="superpowers" className="px-4 py-20 bg-surface">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            <span className="hunt-glow">Superpowers</span> Unlocked by Claude
          </h2>
          <p className="mx-auto max-w-3xl text-xl text-muted-foreground">
            By focusing 100% on Claude, we deliver features that would be{' '}
            <span className="text-primary font-semibold">impossible</span> with multi-platform
            support.
          </p>
        </motion.div>

        {/* Main Superpowers Grid */}
        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
          {superpowers.map((superpower, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div
                className={`h-full border bg-card p-8 ${superpower.borderColor} rounded-2xl hover:shadow-lg transition-shadow`}
              >
                {/* Header */}
                <div className="mb-6 flex items-start gap-4">
                  <div className={`rounded-xl p-3 ${superpower.bgColor}`}>
                    <superpower.icon className={`h-8 w-8 ${superpower.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-2">{superpower.name}</h3>
                    <p className="text-sm text-muted-foreground">{superpower.description}</p>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-6">
                  <ul className="space-y-2">
                    {superpower.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-cat-green" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Why Impossible Without Claude */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground italic">
                    💡 <span className="font-medium">Why Claude-only:</span> {superpower.impossible}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Technical Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-border bg-card p-8 mb-16"
        >
          <h3 className="mb-8 text-center text-2xl font-bold">Technical Benefits</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {technicalBenefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h4 className="mb-2 font-semibold">{benefit.title}</h4>
                <p className="mb-1 text-sm text-muted-foreground">{benefit.description}</p>
                <p className="text-xs text-primary font-mono">{benefit.detail}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Philosophy Statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center"
        >
          <h3 className="mb-4 text-2xl font-bold">
            This Isn't a Limitation — It's a <span className="hunt-glow">Strategic Decision</span>
          </h3>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground mb-6">
            By specializing in Claude, we can build features that would be impossible with
            multi-platform support. Every line of code is optimized for one thing:{' '}
            <span className="text-primary font-semibold">
              helping you ship fast with Claude
            </span>
            .
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="rounded-full bg-background px-4 py-2">
              🚀 Ship faster
            </div>
            <div className="rounded-full bg-background px-4 py-2">
              🎯 Deeper integrations
            </div>
            <div className="rounded-full bg-background px-4 py-2">
              💯 Better quality
            </div>
            <div className="rounded-full bg-background px-4 py-2">
              🤝 Honest compatibility
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
