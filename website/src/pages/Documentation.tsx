import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Book, GitBranch, Zap, Shield, Cloud, Code2 } from 'lucide-react'

const docSections = [
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Quick Start',
    description: 'Get up and running in under 2 minutes',
    link: '/docs/quick-start',
    internal: true,
  },
  {
    icon: <Code2 className="h-6 w-6" />,
    title: 'Command Reference',
    description: 'Complete list of all prjct commands',
    link: '/commands',
    internal: true,
  },
  {
    icon: <Book className="h-6 w-6" />,
    title: 'Philosophy',
    description: 'Understand the prjct mindset',
    link: '/docs/philosophy',
    internal: true,
  },
  {
    icon: <GitBranch className="h-6 w-6" />,
    title: 'Git Integration',
    description: 'Smart commits and version control',
    link: '/docs/git-integration',
    internal: true,
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Best Practices',
    description: 'Tips for maximum productivity',
    link: '/docs/best-practices',
    internal: true,
  },
  {
    icon: <Cloud className="h-6 w-6" />,
    title: 'MCP Integration',
    description: 'AI assistant configuration',
    link: '/docs/mcp-integration',
    internal: true,
  },
]

export const Documentation = () => {
  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
            Documentation
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Everything you need to master prjct and ship features faster than ever
          </p>
        </motion.div>

        {/* Documentation Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {docSections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                to={section.link}
                className="group block rounded-2xl border border-border p-6 transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110">
                    {section.icon}
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold transition-colors group-hover:text-primary">
                      {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Getting Started Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 rounded-2xl bg-muted/20 p-8"
        >
          <h2 className="mb-6 text-3xl font-bold">Getting Started</h2>
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-xl font-semibold">1. Install prjct globally</h3>
              <div className="rounded-lg bg-black p-4 font-mono text-sm">
                <span className="text-cat-teal">$</span> npm install -g prjct-cli
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xl font-semibold">2. Setup Claude Code integration</h3>
              <div className="rounded-lg bg-black p-4 font-mono text-sm">
                <span className="text-cat-teal">$</span> prjct start
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This installs all /p:* commands in Claude Code (one-time setup)
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-xl font-semibold">3. Initialize your project</h3>
              <div className="rounded-lg bg-black p-4 font-mono text-sm">
                <span className="text-cat-teal">/p:init</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Run this in Claude Code, or just say: "p. initialize this project"
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-xl font-semibold">4. Start shipping</h3>
              <div className="rounded-lg bg-black p-4 font-mono text-sm">
                <span className="text-cat-teal">/p:feature</span> "build awesome feature"
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Or just say: "p. I want to build an awesome feature"
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">
              💬 <strong>Natural language works too!</strong> Just start your message with "p." and
              describe what you want to do. No need to memorize commands.
            </p>
          </div>
        </motion.div>

        {/* Contact & Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <h2 className="mb-6 text-2xl font-bold">Need Help?</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:jlopezlira@gmail.com"
              className="rounded-lg border border-border px-6 py-3 transition-all hover:bg-muted"
            >
              Email Support →
            </a>
            <a
              href="https://jlopezlira.dev"
              className="rounded-lg border border-border px-6 py-3 transition-all hover:bg-muted"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contact Developer →
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
