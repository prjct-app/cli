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
      'Full emoji support'
    ],
    detection: [
      'CLAUDE_AGENT environment',
      'CLAUDE.md configuration',
      'MCP availability check',
      '/.claude/ directory'
    ]
  },
  {
    name: 'OpenAI Codex',
    icon: Cpu,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    features: [
      'Sandboxed environment',
      'Structured output',
      'GitHub integration',
      'Container support'
    ],
    detection: [
      'CODEX_AGENT environment',
      'AGENTS.md configuration',
      'Codespaces detection',
      '/sandbox/ paths'
    ]
  },
  {
    name: 'Terminal/CLI',
    icon: Terminal,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    features: [
      'ANSI colors via chalk',
      'Progress spinners',
      'Interactive prompts',
      'Native CLI experience'
    ],
    detection: [
      'Direct execution',
      'TTY detection',
      'Shell environment',
      'Command line args'
    ]
  }
]

export const Compatibility = () => {
  return (
    <section id="compatibility" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Works <span className="hunt-glow">Everywhere</span> You Code
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Intelligent agent detection adapts output for your environment.
            No configuration needed - it just works.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {agents.map((agent, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className={`h-full p-6 bg-card border ${agent.borderColor} rounded-2xl`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-xl ${agent.bgColor}`}>
                    <agent.icon className={`w-6 h-6 ${agent.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold">{agent.name}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Features</h4>
                    <ul className="space-y-2">
                      {agent.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Auto-Detection</h4>
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
          className="bg-card border border-border rounded-2xl p-8 text-center"
        >
          <h3 className="text-2xl font-bold mb-4">How Agent Detection Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">1</div>
              <p className="text-sm text-muted-foreground">Environment variables checked</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">2</div>
              <p className="text-sm text-muted-foreground">Configuration files scanned</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">3</div>
              <p className="text-sm text-muted-foreground">Runtime capabilities tested</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">4</div>
              <p className="text-sm text-muted-foreground">Optimal output delivered</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-6">
            Each agent receives perfectly formatted output for their environment. Zero config, maximum productivity.
          </p>
        </motion.div>
      </div>
    </section>
  )
}