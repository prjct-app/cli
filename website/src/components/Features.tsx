import {
  Zap,
  Bot,
  Trophy,
  GitBranch,
  Shield,
  Rocket,
  Terminal,
  Brain,
  Sparkles,
  Cpu,
} from 'lucide-react'
import { Section, Card, IconBox, Badge } from './ui'

const features = [
  {
    icon: Cpu,
    title: 'Smart Agent Detection',
    description:
      'Automatically detects Claude Code, OpenAI Codex, or Terminal. Zero config, perfect output every time.',
    highlight: true,
  },
  {
    icon: Bot,
    title: 'AI Native',
    description:
      'Your AI understands exactly what to build next. No context lost between sessions.',
  },
  {
    icon: Zap,
    title: 'Zero Friction',
    description:
      'From idea to roadmap to shipped features. No project management BS, just pure execution.',
  },
  {
    icon: Brain,
    title: 'Context Memory',
    description:
      'AI remembers your tech stack, architecture decisions, and progress across sessions.',
  },
  {
    icon: Sparkles,
    title: 'MCP Integration',
    description:
      'Built-in Model Context Protocol support. Context7 for docs, automatic library patterns, framework integration.',
  },
  {
    icon: Terminal,
    title: 'Simple Commands',
    description:
      'Just /p: commands in your AI chat. Turn ideas into actionable technical tasks instantly.',
  },
  {
    icon: Trophy,
    title: 'Ship & Celebrate',
    description:
      'Track real progress. Celebrate wins and shipped features, not story points or velocity.',
  },
  {
    icon: Shield,
    title: 'Local First',
    description: 'Your ideas, your code, your machine. No cloud tracking, no data mining.',
  },
  {
    icon: GitBranch,
    title: 'Global Architecture',
    description:
      'Data stored globally in ~/.prjct-cli/projects/ - switch between editors seamlessly with shared context.',
  },
  {
    icon: Rocket,
    title: 'Instant Setup',
    description: 'One curl command. Start shipping in minutes. Works with any AI assistant.',
  },
  {
    icon: Sparkles,
    title: 'Solo to Team',
    description:
      'Perfect for indie hackers and small teams (2-5 people). Global architecture enables seamless collaboration.',
  },
]

export const Features = () => {
  return (
    <Section
      id="features"
      className="bg-muted/30"
      title={
        <>
          Built for <span className="hunt-glow">Shipping</span>
        </>
      }
      subtitle="Convert ideas into technical roadmaps that AI agents can execute"
      centered
      maxWidth="7xl"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <Card
            key={index}
            variant={feature.highlight ? 'highlight' : 'feature'}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="group h-full"
          >
            <IconBox
              variant={feature.highlight ? 'primary' : 'muted'}
              size="md"
              className="mb-4 transition-colors group-hover:bg-accent"
            >
              <feature.icon
                className={`h-6 w-6 ${feature.highlight ? 'text-primary' : 'text-foreground'}`}
              />
            </IconBox>
            <h3 className="mb-2 text-xl font-semibold">
              {feature.title}
              {feature.highlight && (
                <Badge variant="primary" size="sm" className="ml-2">
                  NEW
                </Badge>
              )}
            </h3>
            <p className="text-muted-foreground">{feature.description}</p>
          </Card>
        ))}
      </div>
    </Section>
  )
}
