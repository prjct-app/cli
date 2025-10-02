import { motion } from 'framer-motion'
import { Copy, Check, Terminal, Sparkles, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Button, Badge } from './ui'

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
      <div className="mx-auto max-w-6xl text-center space-y-8">
        {/* Built for Claude Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center"
        >
          <Badge variant="primary" size="md" className="text-base px-4 py-2 text-orange-500 border-orange-500 bg-orange-500/10">
            <p className="flex items-center gap-2">
              <img src="/claude.png" alt="Claude Code - Claude Desktop" className="size-6" />
              Built for Claude Code - Claude Desktop
            </p>
          </Badge>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-6xl font-bold tracking-tight md:text-8xl"
        >
          prjct/<span className="hunt-glow">cli</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto max-w-3xl text-xl text-muted-foreground md:text-2xl"
        >
          Ship fast, track progress, stay focused.
          <br />
          Developer momentum tool for indie hackers and small teams.
        </motion.p>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-muted-foreground"
        >
          No extra costs • No BS • Just ship it
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <div className="relative isolate overflow-visible ">
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
              <code className="font-mono text-sm">
                npm install -g prjct-cli
              </code>
            </Button>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-base text-muted-foreground max-w-2xl mx-auto"
        >
          Not a PM tool. Not Jira. Just <code className="px-1.5 py-0.5 bg-primary/10 rounded text-primary">/p:now</code> → work → <code className="px-1.5 py-0.5 bg-primary/10 rounded text-primary">/p:done</code> → <code className="px-1.5 py-0.5 bg-primary/10 rounded text-primary">/p:ship</code> → celebrate.
        </motion.p>
      </div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-4"
      >
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🤖</div>
          </div>
          <h3 className="mb-2 font-semibold">Dynamic AI Agents</h3>
          <p className="text-sm text-muted-foreground">PM, Frontend, Backend, UX, QA, Scribe+</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🔗</div>
          </div>
          <h3 className="mb-2 font-semibold">Native MCP</h3>
          <p className="text-sm text-muted-foreground">Context7, Sequential, Magic, Playwright</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">✅</div>
          </div>
          <h3 className="mb-2 font-semibold">Git Validation</h3>
          <p className="text-sm text-muted-foreground">Last commit = source of truth</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">💬</div>
          </div>
          <h3 className="mb-2 font-semibold">p. Trigger</h3>
          <p className="text-sm text-muted-foreground">"p. I'm done" → /p:done (zero memorization)</p>
        </div>
      </motion.div>

      {/* Windsurf Extension CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="mt-12 flex justify-center"
      >
        <a
          href="#windsurf-extension"
          onClick={(e) => {
            e.preventDefault()
            document.querySelector('.windsurf-extension-section')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }}
          className="group inline-flex items-center gap-2 rounded-full border-2 border-cat-mauve/40 bg-gradient-to-r from-purple-500/15 to-blue-500/15 px-6 py-2.5 transition-all duration-300 hover:scale-105 hover:border-cat-mauve/60 hover:shadow-lg hover:shadow-purple-500/20"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          >
            <Sparkles className="h-4 w-4 text-cat-mauve" />
          </motion.div>
          <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-base font-semibold text-transparent">
            Windsurf Extension Coming Soon
          </span>
          <ArrowRight className="h-4 w-4 text-cat-mauve transition-transform group-hover:translate-x-1" />
        </a>
      </motion.div>
    </section>
  )
}
