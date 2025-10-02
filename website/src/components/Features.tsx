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
    icon: Bot,
    title: 'Dynamic AI Agents',
    description:
      'Auto-generated specialists (PM, Frontend, Backend, UX, QA, Scribe+) that understand your project context.',
    highlight: true,
  },
  {
    icon: Sparkles,
    title: 'Native MCP',
    description:
      'Context7, Sequential, Magic, Playwright integration. Claude-native protocol for real-time context.',
  },
  {
    icon: GitBranch,
    title: 'Git Validation',
    description:
      'Last commit = source of truth. No empty claims, just real work validated against actual changes.',
  },
  {
    icon: Terminal,
    title: 'p. Trigger - Zero Memorization',
    description:
      '"p. I\'m done" → /p:done | "p. start building auth" → /p:now | "p. ship this" → /p:ship. Works in any language.',
  },
  {
    icon: Zap,
    title: 'Ship Fast',
    description:
      '/p:now → work → /p:done → /p:ship → celebrate. No ceremonies, no meetings, just execution.',
  },
  {
    icon: Trophy,
    title: 'Developer Momentum',
    description:
      'NOT a PM tool. Track real progress and celebrate shipped features, not story points.',
  },
  {
    icon: Brain,
    title: 'Focus Mode',
    description:
      'One task at a time. Stay focused on what matters: shipping features that work.',
  },
  {
    icon: Shield,
    title: 'Local First',
    description: 'Your code, your machine. No cloud tracking, no data mining, no BS.',
  },
  {
    icon: Rocket,
    title: 'Instant Setup',
    description: 'npm install -g prjct-cli. Start shipping in 60 seconds with Claude.',
  },
]

export const Features = () => {
  return (
    <Section
      id="features"
      className="bg-muted/30"
      title={
        <>
          Developer <span className="hunt-glow">Superpowers</span>
        </>
      }
      subtitle="Built for Claude - Ship fast, stay focused, no BS"
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
