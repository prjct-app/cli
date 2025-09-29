import { motion } from 'framer-motion'
import { Copy, Check, Terminal, Star, Sparkles, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Button, Badge } from './ui'

export const Hero = () => {
 const [copied, setCopied] = useState(false)
 const installCommand = "curl -fsSL https://www.prjct.app/install.sh | bash"

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
     <Badge variant="primary" size="sm">Claude Code</Badge>
     <Badge variant="success" size="sm">OpenAI Codex</Badge>
     <Badge variant="info" size="sm">Terminal/CLI</Badge>
    </motion.div>

    {/* CTA Buttons */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.3 }}
     className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
    >
     <Button
      variant="secondary"
      size="lg"
      onClick={copyToClipboard}
      leftIcon={<Terminal className="w-5 h-5" />}
      rightIcon={copied ? <Check className="w-5 h-5 text-cat-green" /> : <Copy className="w-5 h-5" />}
     >
      <code className="font-mono text-sm">curl -fsSL https://www.prjct.app/install.sh | bash</code>
     </Button>
     <Button
      variant="primary"
      size="lg"
      as="a"
      href="https://github.com/jlopezlira/prjct-cli"
      target="_blank"
      rel="noopener noreferrer"
      leftIcon={<Star className="w-5 h-5" />}
     >
      Start Using
     </Button>
    </motion.div>

    {/* Windsurf Extension CTA */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.35 }}
     className="flex justify-center mb-16"
    >
     <a
      href="#windsurf-extension"
      onClick={(e) => {
       e.preventDefault()
       document.querySelector('.windsurf-extension-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
       })
      }}
      className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cat-light-mauve/20 from-purple-500/10 to-cat-light-sapphire/20 to-blue-500/10 border-2 border-cat-mauve/30 hover:border-cat-light-mauve/80 hover:border-cat-mauve/50 transition-all duration-300 hover:scale-105"
     >
      <motion.div
       animate={{ rotate: [0, 10, -10, 0] }}
       transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
      >
       <Sparkles className="w-5 h-5 text-cat-mauve" />
      </motion.div>
      <span className="font-medium bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
       Windsurf Extension Coming Soon
      </span>
      <ArrowRight className="w-4 h-4 text-cat-mauve group-hover:translate-x-1 transition-transform" />
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