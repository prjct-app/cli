import { motion } from 'framer-motion'
import { Users, Code2, Briefcase, Cpu } from 'lucide-react'

const audiences = [
  {
    icon: Users,
    title: 'Indie Hackers',
    description: 'Ship MVPs faster. Turn your idea into a clear roadmap in minutes, not days.'
  },
  {
    icon: Code2,
    title: 'Solo Developers',
    description: 'Hate micromanagement? Just code. Let AI handle the project tracking overhead.'
  },
  {
    icon: Briefcase,
    title: 'Solopreneurs',
    description: 'Keep context between coding sessions. Never lose momentum on your side projects.'
  },
  {
    icon: Cpu,
    title: 'AI Power Users',
    description: 'Make your AI agents 10x more effective with perfectly scoped technical tasks.'
  }
]

export const ForIndies = () => {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            For Creators Who{' '}
            <span className="hunt-glow">Ship</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            No project managers. No scrum masters. No ceremonies.
            <br />
            Just you, your AI, and shipping features that matter.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {audiences.map((audience, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="flex gap-4"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center">
                  <audience.icon className="w-6 h-6 text-foreground" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{audience.title}</h3>
                <p className="text-muted-foreground">{audience.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 p-8 bg-card border border-border rounded-2xl max-w-4xl mx-auto"
        >
          <h3 className="text-2xl font-bold mb-4 text-center">
            The Problem We Solve
          </h3>
          <p className="text-muted-foreground text-center text-lg">
            You have an idea. You need a roadmap. Traditional tools want you to create epics,
            stories, and sprints. Your AI assistant loses context after 10 messages.
          </p>
          <p className="text-foreground text-center text-lg mt-4 font-medium">
            prjct/cli bridges this gap. One command captures your idea.
            AI generates the roadmap. You ship features. No BS.
          </p>
        </motion.div>
      </div>
    </section>
  )
}