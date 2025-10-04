import { motion } from 'framer-motion'
import { Users, Code2, Briefcase, Cpu } from 'lucide-react'
import { Section, Card, IconBox } from './ui'

const audiences = [
  {
    icon: Users,
    title: 'Indie Hackers',
    description: 'Ship MVPs faster. Turn your idea into a clear roadmap in minutes, not days.',
  },
  {
    icon: Code2,
    title: 'Solo Developers',
    description: 'Hate micromanagement? Just code. Let AI handle the project tracking overhead.',
  },
  {
    icon: Briefcase,
    title: 'Small Teams',
    description:
      'Share global context across 2-5 developers. Everyone sees progress, each uses their preferred editor.',
  },
  {
    icon: Cpu,
    title: 'AI Power Users',
    description: 'Make your AI agents 10x more effective with perfectly scoped technical tasks.',
  },
]

export const ForIndies = () => {
  return (
    <Section
      className="bg-background"
      title={
        <>
          For Creators Who <span className="hunt-glow">Ship</span>
        </>
      }
      subtitle={
        <>
          No project managers. No scrum masters. No ceremonies.
          <br />
          Solo or with your team, just you, your AI, and shipping features that matter.
        </>
      }
      centered
      maxWidth="6xl"
    >
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
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
              <IconBox variant="default" size="md">
                <audience.icon className="h-6 w-6 text-foreground" />
              </IconBox>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">{audience.title}</h3>
              <p className="text-muted-foreground">{audience.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <Card
        variant="default"
        className="mx-auto mt-16 max-w-4xl p-8"
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h3 className="mb-4 text-center text-2xl font-bold">The Problem We Solve</h3>
        <p className="text-center text-lg text-muted-foreground">
          You have an idea. You need a roadmap. Traditional tools want you to create epics, stories,
          and sprints. Your AI assistant loses context after 10 messages.
        </p>
        <p className="mt-4 text-center text-lg font-medium text-foreground">
          prjct/cli bridges this gap. One command captures your idea. AI generates the roadmap. You
          ship features. No BS.
        </p>
      </Card>
    </Section>
  )
}
