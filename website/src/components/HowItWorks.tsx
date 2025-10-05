import { motion } from 'framer-motion'
import { MessageCircle, Brain, Rocket, ArrowRight } from 'lucide-react'
import { typography, spacing } from '../lib/typography-system'
import { animationPresets } from '../lib/animation-variants'
import { cn } from '../lib/utils'

export const HowItWorks = () => {
  const steps = [
    {
      icon: MessageCircle,
      title: 'Talk Naturally',
      description: 'Just tell Claude what you want',
      example: '"p. I want to add dark mode"',
      color: 'cat-mauve',
    },
    {
      icon: Brain,
      title: 'Claude Understands',
      description: 'Analyzes intent & recommends flow',
      example: 'Value analysis → Task breakdown → Auto-start',
      color: 'cat-green',
    },
    {
      icon: Rocket,
      title: 'You Ship',
      description: 'Confirm & execute → celebrate',
      example: 'Track progress → Ship → Repeat',
      color: 'cat-peach',
    },
  ]

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div {...animationPresets.standard} className={cn('text-center', spacing.headerMargin)}>
          <h2 className={cn(typography.sectionTitle, spacing.elementMargin)}>
            How It <span className="hunt-glow">Actually</span> Works
          </h2>
          <p className={typography.sectionSubtitle}>No commands to memorize. Just conversation.</p>
        </motion.div>

        {/* Visual Flow */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          {/* Connection Lines */}
          <div className="absolute left-0 right-0 top-1/2 hidden h-0.5 -translate-y-1/2 bg-gradient-to-r from-cat-mauve/50 via-cat-green/50 to-cat-peach/50 md:block" />

          {/* Steps */}
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                {...animationPresets.stagger(index)}
                className="relative z-10"
              >
                <div className="rounded-3xl border-2 border-border bg-background p-8 transition-all hover:border-primary/50 hover:shadow-xl">
                  {/* Icon */}
                  <div
                    className={cn(
                      'mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl',
                      `bg-${step.color}/10`
                    )}
                  >
                    <step.icon className={cn('h-10 w-10', `text-${step.color}`)} />
                  </div>

                  {/* Step Number */}
                  <div
                    className={cn(
                      'mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full',
                      `bg-${step.color}/20 text-${step.color}`,
                      typography.label
                    )}
                  >
                    {index + 1}
                  </div>

                  {/* Content */}
                  <h3 className={cn(typography.cardTitle, 'mb-3 text-center')}>{step.title}</h3>
                  <p className={cn(typography.muted, 'mb-4 text-center')}>{step.description}</p>

                  {/* Example */}
                  <div className="rounded-xl bg-muted/50 p-4">
                    <code className={cn(typography.codeSmall, 'block text-center text-cat-teal')}>
                      {step.example}
                    </code>
                  </div>

                  {/* Arrow for desktop */}
                  {index < steps.length - 1 && (
                    <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 md:block">
                      <ArrowRight className="h-6 w-6 text-primary" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div {...animationPresets.standardWithDelay(0.5)} className="mt-12 text-center">
          <p className={cn(typography.mutedLarge, 'mb-6')}>
            That's it. No commands to memorize. Just talk.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/commands"
              className="rounded-xl border-2 border-primary bg-primary px-8 py-3 text-primary-foreground transition-all hover:opacity-90"
            >
              See All Commands
            </a>
            <a
              href="/workflows"
              className="rounded-xl border-2 border-border px-8 py-3 transition-all hover:border-primary/50 hover:bg-muted/50"
            >
              View Workflows
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
