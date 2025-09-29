import { motion } from 'framer-motion'
import { Copy, Check, Terminal, Star } from 'lucide-react'
import { useState } from 'react'

export const Hero = () => {
  const [copied, setCopied] = useState(false)
  const installCommand = "curl -fsSL https://jlopezlira.github.io/prjct-cli/install.sh | bash"

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-background">

      <div className="max-w-6xl mx-auto text-center">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-6xl md:text-8xl font-bold mb-6 tracking-tight"
        >
          prjct/<span className="hunt-glow">cli</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto"
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
          className="flex items-center justify-center gap-3 mb-8"
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            Claude Code
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
            OpenAI Codex
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
            Terminal/CLI
          </span>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
        >
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-3 bg-card hover:bg-accent text-foreground px-8 py-4 rounded-xl font-medium border border-border transition-all duration-200 hover:scale-105"
          >
            <Terminal className="w-5 h-5" />
            <code className="font-mono text-sm">curl -fsSL https://jlopezlira.github.io/prjct-cli/install.sh | bash</code>
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
          <a
            href="https://github.com/jlopezlira/prjct-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-medium transition-all duration-200 hover:scale-105"
          >
            <Star className="w-5 h-5" />
            Start Using
          </a>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-muted-foreground"
        >
          From idea to technical tasks in minutes. Let AI handle the execution.
        </motion.p>
      </div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto mt-20"
      >
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🤖</div>
          </div>
          <h3 className="font-semibold mb-2">Smart Detection</h3>
          <p className="text-sm text-muted-foreground">Auto-adapts to your AI environment</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">📝</div>
          </div>
          <h3 className="font-semibold mb-2">Idea to Roadmap</h3>
          <p className="text-sm text-muted-foreground">Transform ideas into technical tasks</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">🚀</div>
          </div>
          <h3 className="font-semibold mb-2">AI-Ready Tasks</h3>
          <p className="text-sm text-muted-foreground">Perfect context for AI agents</p>
        </div>
        <div className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold">⚡</div>
          </div>
          <h3 className="font-semibold mb-2">Zero Friction</h3>
          <p className="text-sm text-muted-foreground">No tickets, no sprints, just ship</p>
        </div>
      </motion.div>
    </section>
  )
}