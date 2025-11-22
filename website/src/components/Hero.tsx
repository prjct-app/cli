import { motion } from 'framer-motion'
import { Copy, Check, Terminal, Sparkles, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Button, Badge } from './ui'
import { typography, spacing } from '../lib/typography-system'
import { animationPresets } from '../lib/animation-variants'
import { cn } from '../lib/utils'

export const Hero = () => {
  const [copied, setCopied] = useState(false)
  const installCommand = 'npm install -g prjct-cli'

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-20">
      {/* Main Hero Content - 2 Column Layout on LG (60/40 split) */}
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-5 lg:gap-16 lg:items-center">
          {/* Left Column - Main Content (3/5 = 60%) */}
          <div className="space-y-8 text-center lg:col-span-3 lg:text-left">
            {/* Built for Claude Badge */}
            <motion.div {...animationPresets.hero} className="flex justify-center gap-2 lg:justify-start">
              <Badge
                variant="primary"
                size="md"
                className={cn(
                  typography.body,
                  'border-orange-500 bg-orange-500/10 px-4 py-2 text-orange-500'
                )}
              >
                <p className="flex items-center gap-2">
                  <img src="/claude.png" alt="Claude Code" className="size-6" />
                  Built for Claude Code
                </p>
              </Badge>
              <Badge
                variant="primary"
                size="md"
                className={cn(
                  typography.body,
                  'border-cat-green bg-cat-green/10 px-4 py-2 text-cat-green'
                )}
              >
                <p className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  v0.9.0
                </p>
              </Badge>
            </motion.div>

            {/* Title */}
            <motion.h1
              {...animationPresets.standardWithDelay(0.1)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={typography.hero}
            >
              prjct/<span className="hunt-glow">cli</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              {...animationPresets.standardWithDelay(0.2)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(typography.sectionSubtitle, 'md:text-2xl')}
            >
              Ship fast. Handle interruptions. Never lose context.
              <br />
              Just 13 commands for your entire workflow.
            </motion.p>

            {/* Tagline */}
            <motion.p
              {...animationPresets.standardWithDelay(0.25)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={typography.muted}
            >
              No extra costs • No BS • Just ship it
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              {...animationPresets.standardWithDelay(0.3)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 sm:flex-row lg:items-start"
            >
              <div className="relative isolate overflow-visible w-2/3">
                <div className="fancy-border pointer-events-none"></div>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={copyToClipboard}
                  leftIcon={<Terminal className="h-5 w-5" />}
                  rightIcon={
                    copied ? <Check className="h-5 w-5 text-cat-green" /> : <Copy className="h-5 w-5" />
                  }
                  className="relative z-10 w-full"
                >
                  <code className={typography.code}>npm install -g prjct-cli</code>
                </Button>
              </div>
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className={cn(typography.mutedLarge)}
            >
              Not a PM tool. Not Jira. Just talk:{' '}
              <code className={typography.codeInline}>"p. I want to add auth"</code> → Claude
              handles the rest → ship → celebrate.
            </motion.p>
          </div>

          {/* Right Column - Conversational Examples (2/5 = 40%) */}
          <motion.div
            {...animationPresets.standardWithDelay(0.4)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4 lg:col-span-2"
          >
            <p className={cn(typography.label, 'text-center text-cat-mauve lg:text-left')}>
              💬 How you actually use it:
            </p>

            <div className="space-y-3">
              <div className="rounded-2xl border border-cat-mauve/20 bg-gradient-to-br from-cat-mauve/5 to-transparent p-5">
                <p className={cn(typography.mutedSmall, 'mb-2')}>When interrupted:</p>
                <code className={cn(typography.code, 'block text-cat-teal')}>
                  p. meeting in 5, pause this
                </code>
                <p className={cn(typography.mutedSmall, 'mt-3 text-cat-overlay0')}>
                  <span className="text-cat-green font-semibold">NEW!</span> → Pauses task, preserves context
                </p>
              </div>

              <div className="rounded-2xl border border-cat-green/20 bg-gradient-to-br from-cat-green/5 to-transparent p-5">
                <p className={cn(typography.mutedSmall, 'mb-2')}>When you return:</p>
                <code className={cn(typography.code, 'block text-cat-teal')}>p. I'm back, continue</code>
                <p className={cn(typography.mutedSmall, 'mt-3 text-cat-overlay0')}>
                  <span className="text-cat-green font-semibold">NEW!</span> → Resume exactly where you left off
                </p>
              </div>

              <div className="rounded-2xl border border-cat-peach/20 bg-gradient-to-br from-cat-peach/5 to-transparent p-5">
                <p className={cn(typography.mutedSmall, 'mb-2')}>Turn idea into architecture:</p>
                <code className={cn(typography.code, 'block text-cat-teal')}>p. build a SaaS dashboard</code>
                <p className={cn(typography.mutedSmall, 'mt-3 text-cat-overlay0')}>
                  <span className="text-cat-green font-semibold">NEW!</span> → Full tech stack, APIs, roadmap
                </p>
              </div>
            </div>

            <p className={cn(typography.mutedSmall, 'text-center lg:text-left')}>
              No commands to memorize. Just talk naturally.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Features Grid - Separated below main hero */}
      <motion.div
        {...animationPresets.standardWithDelay(0.5)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-20 w-full max-w-6xl"
      >
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl font-bold">⏸️</div>
            </div>
            <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
              Pause/Resume
            </h3>
            <p className={typography.muted}>Handle interruptions without losing context</p>
          </div>
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl font-bold">🧠</div>
            </div>
            <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
              Intelligent Ideas
            </h3>
            <p className={typography.muted}>Ideas → Complete architectures</p>
          </div>
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl font-bold">🤖</div>
            </div>
            <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
              Dynamic Agents
            </h3>
            <p className={typography.muted}>Auto-generates for your stack</p>
          </div>
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl font-bold">💬</div>
            </div>
            <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
              Natural Language
            </h3>
            <p className={typography.muted}>Just talk, works in any language</p>
          </div>
        </div>
      </motion.div>

      {/* Windsurf Extension CTA */}
      <motion.div
        {...animationPresets.standardWithDelay(0.6)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 flex justify-center"
      >
        <a
          href="/windsurf-extension"
          className="group inline-flex items-center gap-2 rounded-full border-2 border-cat-mauve/40 bg-gradient-to-r from-purple-500/15 to-blue-500/15 px-6 py-2.5 transition-all duration-300 hover:scale-105 hover:border-cat-mauve/60 hover:shadow-lg hover:shadow-purple-500/20"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          >
            <Sparkles className="h-4 w-4 text-cat-mauve" />
          </motion.div>
          <span
            className={cn(
              'bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent',
              typography.label
            )}
          >
            Windsurf Extension Coming Soon
          </span>
          <ArrowRight className="h-4 w-4 text-cat-mauve transition-transform group-hover:translate-x-1" />
        </a>
      </motion.div>
    </section>
  )
}
