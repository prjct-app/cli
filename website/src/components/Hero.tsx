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
    <section className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto max-w-6xl space-y-8 text-center">
        {/* Built for Claude Badge */}
        <motion.div {...animationPresets.hero} className="flex justify-center">
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
          className={cn(typography.sectionSubtitle, 'mx-auto max-w-3xl md:text-2xl')}
        >
          Ship fast, track progress, stay focused.
          <br />
          Developer momentum tool for indie hackers and small teams.
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
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <div className="relative isolate overflow-visible">
            <div className="fancy-border pointer-events-none"></div>
            <Button
              variant="secondary"
              size="lg"
              onClick={copyToClipboard}
              leftIcon={<Terminal className="h-5 w-5" />}
              rightIcon={
                copied ? <Check className="h-5 w-5 text-cat-green" /> : <Copy className="h-5 w-5" />
              }
              className="relative z-10"
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
          className={cn(typography.mutedLarge, 'mx-auto max-w-2xl')}
        >
          Not a PM tool. Not Jira. Just <code className={typography.codeInline}>/p:feature</code> →
          work → <code className={typography.codeInline}>/p:done</code> →{' '}
          <code className={typography.codeInline}>/p:ship</code> → celebrate.
        </motion.p>
      </div>

      {/* Features Grid */}
      <motion.div
        {...animationPresets.standardWithDelay(0.4)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-4"
      >
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🤖</div>
          </div>
          <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
            Dynamic AI Agents
          </h3>
          <p className={typography.muted}>Coordinator, Frontend, Backend, UX, QA, Scribe+</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🔗</div>
          </div>
          <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>Native MCP</h3>
          <p className={typography.muted}>Context7, Sequential, Magic, Playwright</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">✅</div>
          </div>
          <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>
            Git Validation
          </h3>
          <p className={typography.muted}>Last commit = source of truth</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">💬</div>
          </div>
          <h3 className={cn(typography.cardTitleSmall, spacing.elementMarginSmall)}>p. Trigger</h3>
          <p className={typography.muted}>"p. I'm done" → /p:done (zero memorization)</p>
        </div>
      </motion.div>

      {/* Windsurf Extension CTA */}
      <motion.div
        {...animationPresets.standardWithDelay(0.5)}
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
