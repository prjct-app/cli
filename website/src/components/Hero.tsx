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
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-6xl font-bold tracking-tight md:text-8xl"
        >
          prjct/<span className="hunt-glow">cli</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto max-w-3xl text-xl text-muted-foreground md:text-2xl"
        >
          Turn ideas into AI-ready roadmaps.
          <br />
          Ship faster with zero friction.
        </motion.p>

        {/* Agent Compatibility Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          <Badge variant="primary" size="sm">
            Claude Code
          </Badge>
          <Badge variant="primary" size="sm">
            Cursor
          </Badge>
          <Badge variant="success" size="sm">
            OpenAI Codex
          </Badge>
          <Badge variant="info" size="sm">
            Windsurf
          </Badge>
          <Badge variant="info" size="sm">
            Terminal
          </Badge>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
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
              <code className="font-mono text-sm">
                npm install -g prjct-cli
              </code>
            </Button>
          </div>
        </motion.div>

        {/* Interactive Workflows Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex justify-center"
        >
          <a
            href="/workflows-guide"
            className="group inline-flex items-center gap-2 rounded-full border-2 border-primary/40 bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-2.5 transition-all duration-300 hover:scale-105 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
            >
              <Sparkles className="h-4 w-4 text-primary" />
            </motion.div>
            <span className="text-base font-semibold text-foreground">
              New: Interactive Workflow System
            </span>
            <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
          </a>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-base text-muted-foreground"
        >
          From idea to technical tasks in minutes. Solo or with your team. Let AI handle the execution.
        </motion.p>
      </div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-4"
      >
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🤖</div>
          </div>
          <h3 className="mb-2 font-semibold">Smart Agent Detection</h3>
          <p className="text-sm text-muted-foreground">Auto-detects Claude, Codex, Cursor, Windsurf</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🌍</div>
          </div>
          <h3 className="mb-2 font-semibold">Global Architecture</h3>
          <p className="text-sm text-muted-foreground">Shared data across editors in ~/.prjct-cli/</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">✨</div>
          </div>
          <h3 className="mb-2 font-semibold">MCP Integration</h3>
          <p className="text-sm text-muted-foreground">Context7 docs, library patterns built-in</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">⚡</div>
          </div>
          <h3 className="mb-2 font-semibold">Zero Friction</h3>
          <p className="text-sm text-muted-foreground">No tickets, no sprints, just ship</p>
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
