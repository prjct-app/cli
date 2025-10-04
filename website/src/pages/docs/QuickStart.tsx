import { motion } from 'framer-motion'
import { Zap, CheckCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const QuickStart = () => {
  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Back Button */}
        <BackToDocsButton />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">2 Minute Setup</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Quick Start</h1>
          <p className="text-xl text-muted-foreground">
            Get prjct running in your project in under 2 minutes. No complex configuration, no
            learning curve.
          </p>
        </motion.div>

        {/* Prerequisites */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12 rounded-2xl bg-muted/20 p-6"
        >
          <h2 className="mb-4 text-2xl font-bold">Prerequisites</h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Node.js 18+ installed</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>
                Claude Code (download at{' '}
                <a
                  href="https://claude.ai/download"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  claude.ai/download
                </a>
                )
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Git initialized in your project</span>
            </li>
          </ul>
        </motion.section>

        {/* Installation Steps */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12 space-y-8"
        >
          <h2 className="text-3xl font-bold">Installation</h2>

          {/* Step 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                1
              </div>
              <h3 className="text-xl font-semibold">Install prjct globally</h3>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div>
                <span className="text-cat-teal">$</span> npm install -g prjct-cli
              </div>
            </div>
            <p className="text-muted-foreground">
              Installs prjct globally on your system. Requires Node.js 18+.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                2
              </div>
              <h3 className="text-xl font-semibold">Setup Claude Code integration</h3>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div>
                <span className="text-cat-teal">$</span> prjct start
              </div>
            </div>
            <p className="text-muted-foreground">
              Installs all <code className="text-cat-mauve">/p:*</code> commands to Claude Code.
              One-time setup.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                3
              </div>
              <h3 className="text-xl font-semibold">Initialize your project</h3>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div className="text-gray-400">In Claude Code, say:</div>
              <div className="mt-1 text-cat-peach">"p. initialize this project"</div>
            </div>
            <div className="mt-3 rounded-lg bg-black p-4 font-mono text-sm">
              <div className="text-gray-400">Or use the command directly:</div>
              <div>
                <span className="text-cat-teal">$</span> /p:init
              </div>
            </div>
            <p className="text-muted-foreground">
              Creates project structure and analyzes your codebase automatically.
            </p>
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="mb-2 text-sm font-semibold">
                What gets created in <code>~/.prjct-cli/projects/&#123;id&#125;/</code>:
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  • <code>core/</code> - Current task and priorities
                </li>
                <li>
                  • <code>progress/</code> - Shipped features and metrics
                </li>
                <li>
                  • <code>planning/</code> - Ideas and roadmap
                </li>
                <li>
                  • <code>analysis/</code> - Technical insights
                </li>
                <li>
                  • <code>memory/</code> - Decision history
                </li>
              </ul>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                4
              </div>
              <h3 className="text-xl font-semibold">Add your first feature</h3>
            </div>
            <div className="mb-3 rounded-lg border-2 border-primary/30 bg-primary/10 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-primary" />
                💬 Talk Naturally (Recommended)
              </p>
              <div className="mb-2 rounded-lg bg-black p-3 font-mono text-sm">
                <div className="text-gray-400">Just talk to Claude:</div>
                <div className="mt-1 text-cat-peach">"p. I want to build user authentication"</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Natural language works in any language - Claude detects your intent automatically.
              </p>
            </div>
            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <div className="mb-1 text-gray-400">Or use the command:</div>
              <div>
                <span className="text-cat-teal">$</span> /p:feature "user authentication"
              </div>
              <div className="mt-2 text-gray-400">
                → ✨ Value analysis + task breakdown (max 5 tasks) + auto-start
              </div>
            </div>
            <p className="text-muted-foreground">
              You're shipping! Say "p. I'm done" when you complete tasks, or "p. ship this" when the
              feature is ready.
            </p>
          </div>
        </motion.section>

        {/* Your First Workflow */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 p-6"
        >
          <h2 className="mb-4 text-2xl font-bold">Your First Workflow</h2>
          <div className="space-y-3">
            <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
              <div className="text-gray-300"># Start your day</div>
              <div>
                <span className="text-cat-teal">$</span> /p:recap
              </div>
              <div className="text-gray-400">→ See where you left off</div>
            </div>
            <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
              <div className="text-gray-300"># Add a feature</div>
              <div>
                <span className="text-cat-teal">$</span> /p:feature "fix login bug"
              </div>
              <div className="text-gray-400">→ Value analysis + task breakdown (max 5 tasks)</div>
            </div>
            <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
              <div className="text-gray-300"># Complete and ship</div>
              <div>
                <span className="text-cat-teal">$</span> /p:done
              </div>
              <div>
                <span className="text-cat-teal">$</span> /p:ship "authentication system"
              </div>
              <div className="text-gray-400">→ Celebrate your wins! 🎉</div>
            </div>
          </div>
        </motion.section>

        {/* Next Steps */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <h2 className="mb-6 text-2xl font-bold">Next Steps</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/commands"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-all hover:opacity-90"
            >
              Learn All Commands
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/workflows-guide"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 transition-all hover:bg-muted"
            >
              See Workflows
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/docs/philosophy"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 transition-all hover:bg-muted"
            >
              Understand Philosophy
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
