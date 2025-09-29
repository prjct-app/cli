import { motion } from 'framer-motion'
import {
  Zap,
  Bot,
  Trophy,
  GitBranch,
  Shield,
  Rocket,
  Terminal,
  Brain,
  Sparkles
} from 'lucide-react'

const features = [
  {
    icon: Bot,
    title: 'AI Native',
    description: 'Your AI understands exactly what to build next. No context lost between sessions.'
  },
  {
    icon: Zap,
    title: 'Zero Friction',
    description: 'From idea to roadmap to shipped features. No project management BS, just pure execution.'
  },
  {
    icon: Brain,
    title: 'Context Memory',
    description: 'AI remembers your tech stack, architecture decisions, and progress across sessions.'
  },
  {
    icon: Terminal,
    title: 'Simple Commands',
    description: 'Just /p: commands in your AI chat. Turn ideas into actionable technical tasks instantly.'
  },
  {
    icon: Trophy,
    title: 'Ship & Celebrate',
    description: 'Track real progress. Celebrate wins and shipped features, not story points or velocity.'
  },
  {
    icon: Shield,
    title: 'Local First',
    description: 'Your ideas, your code, your machine. No cloud tracking, no data mining.'
  },
  {
    icon: GitBranch,
    title: 'Task Context',
    description: 'Each task maintains perfect context for AI agents. No more explaining what to do.'
  },
  {
    icon: Rocket,
    title: 'Instant Setup',
    description: 'One curl command. Start shipping in minutes. Works with any AI assistant.'
  },
  {
    icon: Sparkles,
    title: 'Made for Indies',
    description: 'Built for indie hackers, solopreneurs, and developers who ship fast and hate ceremonies.'
  }
]

export const Features = () => {
  return (
    <section id="features" className="py-20 px-4 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Built for{' '}
            <span className="hunt-glow">Shipping</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Convert ideas into technical roadmaps that AI agents can execute
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="h-full p-6 bg-card border border-border rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:bg-accent">
                <div className="inline-flex p-3 rounded-xl bg-muted mb-4 group-hover:bg-accent transition-colors">
                  <feature.icon className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}