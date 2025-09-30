import { motion } from 'framer-motion'
import { Check, Cpu, Bot, Terminal } from 'lucide-react'

const agents = [
  {
    name: 'Claude Code',
    icon: Bot,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
    features: [
      'Rich markdown formatting',
      'MCP server integration',
      'Interactive features',
      'Full emoji support',
    ],
    detection: [
      'CLAUDE_AGENT environment',
      'CLAUDE.md configuration',
      'MCP availability check',
      '/.claude/ directory',
    ],
  },
  {
    name: 'OpenAI Codex',
    icon: Cpu,
    color: 'text-cat-green',
    bgColor: 'bg-cat-green/10',
    borderColor: 'border-cat-green/20',
    features: [
      'Sandboxed environment',
      'Structured output',
      'GitHub integration',
      'Container support',
    ],
    detection: [
      'CODEX_AGENT environment',
      'AGENTS.md configuration',
      'Codespaces detection',
      '/sandbox/ paths',
    ],
  },
  {
    name: 'Terminal/CLI',
    icon: Terminal,
    color: 'text-cat-sapphire',
    bgColor: 'bg-cat-sapphire/10',
    borderColor: 'border-cat-sapphire/20',
    features: [
      'ANSI colors via chalk',
      'Progress spinners',
      'Interactive prompts',
      'Native CLI experience',
    ],
    detection: ['Direct execution', 'TTY detection', 'Shell environment', 'Command line args'],
  },
]

export const Compatibility = () => {
  return (
    <section id="compatibility" className="px-4 py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            <span className="hunt-glow">Works</span> <span className="hunt-glow">Everywhere</span> You Code
          </h2>
          <p className="mx-auto max-w-3xl text-xl text-muted-foreground">
            Intelligent agent detection adapts output for your environment. No configuration needed
            - it just works.
          </p>
        </motion.div>

        <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {agents.map((agent, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className={`h-full border bg-card p-6 ${agent.borderColor} rounded-2xl`}>
                <div className="mb-6 flex items-center gap-3">
                  <div className={`rounded-xl p-3 ${agent.bgColor}`}>
                    <agent.icon className={`h-6 w-6 ${agent.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold">{agent.name}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">Features</h4>
                    <ul className="space-y-2">
                      {agent.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-cat-green" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      Auto-Detection
                    </h4>
                    <ul className="space-y-1">
                      {agent.detection.map((method, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          • {method}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-border bg-card p-8 text-center"
        >
          <h3 className="mb-4 text-2xl font-bold">How Agent Detection Works</h3>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold">1</div>
              <p className="text-sm text-muted-foreground">Environment variables checked</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold">2</div>
              <p className="text-sm text-muted-foreground">Configuration files scanned</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold">3</div>
              <p className="text-sm text-muted-foreground">Runtime capabilities tested</p>
            </div>
            <div className="text-center">
              <div className="mb-2 text-3xl font-bold">4</div>
              <p className="text-sm text-muted-foreground">Optimal output delivered</p>
            </div>
          </div>
          <p className="mt-6 text-muted-foreground">
            Each agent receives perfectly formatted output for their environment. Zero config,
            maximum productivity.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
