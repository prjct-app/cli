import { motion } from 'framer-motion'
import {
  Bot,
  FileText,
  Database,
  Brain,
  CheckCircle,
  Sparkles,
  Zap,
  Code2,
  Settings,
} from 'lucide-react'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const MCPIntegration = () => {
  const mcpServers = [
    {
      name: 'Context7 MCP',
      icon: <Brain className="h-5 w-5" />,
      status: 'ALWAYS ENABLED',
      statusColor: 'text-cat-green',
      purpose: 'Official library documentation',
      usage: 'Automatic docs for React, Vue, Next.js, Express, any npm package',
      features: [
        'Auto-activates when importing libraries',
        'Version-specific documentation',
        'Code examples included',
        'Framework-specific patterns',
      ],
    },
    {
      name: 'Filesystem MCP',
      icon: <FileText className="h-5 w-5" />,
      status: 'ALWAYS ENABLED',
      statusColor: 'text-cat-green',
      purpose: 'Direct file manipulation',
      usage: 'Read, write, and manage project files',
      features: [
        'Global data in ~/.prjct-cli/',
        'Local config in .prjct/',
        'Atomic file operations',
        'Automatic backups',
      ],
    },
    {
      name: 'Memory MCP',
      icon: <Database className="h-5 w-5" />,
      status: 'ALWAYS ENABLED',
      statusColor: 'text-cat-green',
      purpose: 'Persistent decision storage',
      usage: 'Track decisions, context, and history',
      features: [
        'Decision logging',
        'Context preservation',
        'History tracking',
        'Author attribution',
      ],
    },
    {
      name: 'Sequential MCP',
      icon: <Settings className="h-5 w-5" />,
      status: 'ALWAYS ENABLED',
      statusColor: 'text-cat-green',
      purpose: 'Deep reasoning for complex problems',
      usage: 'Multi-step analysis and problem solving',
      features: [
        'Complex problem breakdown',
        'Step-by-step reasoning',
        'Architecture planning',
        'Design decisions',
      ],
    },
  ]

  const benefits = [
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: 'Zero Configuration',
      description: 'All MCP servers work out of the box - no setup required',
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Context7 Integration',
      description: 'Official library docs available automatically when you code',
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: 'Deep Integration',
      description: 'Claude-native protocol enables features impossible with other platforms',
    },
    {
      icon: <Code2 className="h-6 w-6" />,
      title: 'Natural Language',
      description: 'p. trigger works seamlessly thanks to MCP infrastructure',
    },
  ]

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
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Claude Code Integration</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">MCP Integration</h1>
          <p className="text-xl text-muted-foreground">
            prjct leverages Claude's Model Context Protocol (MCP) for deep integration. All servers
            work automatically - zero configuration required.
          </p>
        </motion.div>

        {/* Claude Code Only Notice */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16 rounded-2xl border-2 border-primary/30 bg-primary/10 p-6"
        >
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
            <CheckCircle className="h-6 w-6 text-primary" />
            Built for Claude Code
          </h2>
          <p className="mb-4 text-muted-foreground">
            prjct is designed exclusively for Claude Code to deliver features that would be
            impossible with multi-platform support. MCP integration is a key part of this strategy.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Works with your existing Claude subscription (free or Pro)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>No extra costs, tokens, or API keys required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>All MCP servers enabled automatically</span>
            </div>
          </div>
        </motion.section>

        {/* What is MCP */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16 rounded-2xl bg-muted/20 p-8"
        >
          <h2 className="mb-4 text-2xl font-bold">What is MCP?</h2>
          <p className="mb-4 text-muted-foreground">
            Model Context Protocol (MCP) is Claude's native protocol for AI-tool integration. prjct
            uses MCP to enable deep, Claude-native features:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Execute /p:* commands seamlessly</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Access official library documentation (Context7)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Persistent memory and decision tracking</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Deep reasoning for complex problems (Sequential)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cat-green" />
              <span>Natural language (p. trigger) support</span>
            </li>
          </ul>
        </motion.section>

        {/* MCP Servers */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16"
        >
          <h2 className="mb-4 text-3xl font-bold">MCP Servers</h2>
          <p className="mb-6 text-muted-foreground">
            All servers work automatically - no configuration needed:
          </p>
          <div className="space-y-4">
            {mcpServers.map((server, index) => (
              <motion.div
                key={server.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-2xl border border-border p-6 transition-colors hover:border-primary/50"
              >
                <div className="mb-4 flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-3 text-primary">{server.icon}</div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xl font-semibold">{server.name}</h3>
                      <span className={`text-sm font-bold ${server.statusColor}`}>
                        {server.status}
                      </span>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{server.purpose}</p>
                    <p className="mb-4 text-sm text-primary/80">{server.usage}</p>
                    <div className="space-y-1">
                      {server.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <span className="text-primary">•</span> {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Context7 Highlight */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16 rounded-2xl bg-gradient-to-r from-primary/20 to-primary/10 p-8"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/20 p-3 text-primary">
              <Brain className="h-8 w-8" />
            </div>
            <div>
              <h2 className="mb-3 text-2xl font-bold">Context7: Game Changer</h2>
              <p className="mb-4 text-muted-foreground">
                Context7 MCP provides official library documentation automatically when you code. No
                searching, no outdated docs, no context switching.
              </p>
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-cat-green" />
                  <span className="text-sm">Auto-activates when importing libraries</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-cat-green" />
                  <span className="text-sm">
                    Works with React, Vue, Next.js, Express, any npm package
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-cat-green" />
                  <span className="text-sm">Version-specific docs and code examples</span>
                </div>
              </div>
              <div className="rounded-lg bg-black p-4 font-mono text-sm">
                <div className="text-gray-400">// You're coding with React hooks</div>
                <div className="mt-1 text-cat-teal">import &#123; useState &#125; from 'react'</div>
                <div className="mt-2 text-gray-400">
                  → Context7 automatically provides official React docs
                </div>
                <div className="text-gray-400">→ No manual searching required</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Usage Examples */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">Usage Examples</h2>
          <div className="space-y-4">
            <div className="rounded-xl bg-black p-6">
              <div className="mb-3 font-semibold text-gray-300">Natural Language (p. trigger)</div>
              <div className="space-y-2 font-mono text-sm">
                <div className="text-gray-400">You: "p. I want to build user authentication"</div>
                <div className="text-cat-teal">
                  Claude: Running /p:feature "user authentication"...
                </div>
                <div className="text-gray-400">→ ✨ Value analysis complete</div>
                <div className="text-gray-400">→ 📋 5 tasks created</div>
                <div className="text-gray-400">→ 🚀 Auto-starting task 1</div>
              </div>
            </div>

            <div className="rounded-xl bg-black p-6">
              <div className="mb-3 font-semibold text-gray-300">Direct Commands</div>
              <div className="space-y-2 font-mono text-sm">
                <div className="text-gray-400">You: /p:init</div>
                <div className="text-cat-teal">Claude: Initializing project...</div>
                <div className="text-gray-400">
                  → ✅ Created ~/.prjct-cli/projects/&#123;id&#125;/
                </div>
                <div className="text-gray-400">→ 🔍 Analyzing codebase (Context7 active)</div>
                <div className="text-gray-400">→ 📁 Structure ready</div>
              </div>
            </div>

            <div className="rounded-xl bg-black p-6">
              <div className="mb-3 font-semibold text-gray-300">Complete Workflow</div>
              <div className="space-y-2 font-mono text-sm">
                <div className="text-gray-400">You: /p:ship "payment processing"</div>
                <div className="text-cat-teal">Claude: Running complete workflow...</div>
                <div className="text-gray-400">→ ✅ Lint: passed</div>
                <div className="text-gray-400">→ ✅ Tests: 18 passing</div>
                <div className="text-gray-400">→ ✅ Docs: updated</div>
                <div className="text-gray-400">→ ✅ Version: 1.3.0 → 1.4.0</div>
                <div className="text-gray-400">→ ✅ Git: committed + pushed</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Setup */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">Setup</h2>
          <div className="space-y-4">
            <div className="flex gap-4 rounded-xl bg-muted/20 p-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                1
              </div>
              <div>
                <p className="mb-1 font-semibold">Install prjct globally</p>
                <code className="rounded bg-black px-3 py-1.5 text-sm text-cat-teal">
                  npm install -g prjct-cli
                </code>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl bg-muted/20 p-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                2
              </div>
              <div>
                <p className="mb-1 font-semibold">Setup Claude Code integration</p>
                <code className="rounded bg-black px-3 py-1.5 text-sm text-cat-teal">
                  prjct start
                </code>
                <p className="mt-2 text-sm text-muted-foreground">
                  Installs all /p:* commands (one-time setup)
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl bg-muted/20 p-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                3
              </div>
              <div>
                <p className="mb-1 font-semibold">Initialize your project</p>
                <code className="rounded bg-black px-3 py-1.5 text-sm text-cat-teal">/p:init</code>
                <p className="mt-2 text-sm text-muted-foreground">
                  Run in Claude Code - MCP servers activate automatically
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cat-green text-white">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="mb-1 font-semibold">You're ready!</p>
                <p className="text-sm text-muted-foreground">
                  All MCP servers work automatically. Start using p. trigger or /p:* commands.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Benefits */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">Why MCP Matters</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-xl bg-muted/20 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">{benefit.icon}</div>
                  <div>
                    <h3 className="mb-2 font-semibold">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Final Note */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="rounded-2xl bg-gradient-to-r from-primary/20 to-primary/10 p-8 text-center"
        >
          <h2 className="mb-4 text-2xl font-bold">Claude-Native = Better Experience</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            By focusing 100% on Claude Code, prjct delivers MCP integration that would be impossible
            with multi-platform support. Every feature is optimized for one thing: helping you ship
            fast with Claude.
          </p>
        </motion.section>
      </div>
    </div>
  )
}
