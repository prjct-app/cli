import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  Check,
  X,
  Zap,
  Cloud,
  Users,
  BarChart3,
  Shield,
  Sparkles,
  Code2,
  Activity,
  Target,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { FeatureCard } from '../components/ui/FeatureCard'
import { PricingCard } from '../components/PricingCard'
import { SectionHeader } from '../components/SectionHeader'
import { Badge } from '../components/ui/Badge'

const getTiers = (isAnnual: boolean) => [
  {
    name: 'Free',
    subtitle: 'Terminal Only',
    price: '$0',
    period: 'forever',
    description: 'CLI commands. Local tracking. No limits.',
    features: [
      { text: 'All /p:* commands', included: true },
      { text: 'Local tracking (~/.prjct-cli/)', included: true },
      { text: 'Basic sidebar (local only)', included: true },
      { text: 'Status bar (local only)', included: true },
      { text: 'Open source', included: true },
      { text: 'Cloud sync & backup', included: false },
      { text: 'Team realtime', included: false },
    ],
    highlighted: false,
  },
  {
    name: 'prjct/pro',
    subtitle: 'Extension + Cloud',
    price: isAnnual ? '$120' : '$12',
    period: isAnnual ? 'per year' : 'per month',
    savings: isAnnual ? 'Save $24/year' : null,
    description: 'Everything Free has + Cloud sync + Team features',
    features: [
      { text: 'Everything in Free, plus:', included: true, bold: true },
      { text: 'Cloud sync (auto-backup)', included: true },
      { text: 'Multi-device sync', included: true },
      { text: 'Team realtime updates', included: true },
      { text: 'Conflict awareness', included: true },
      { text: 'Encrypted storage', included: true },
      { text: 'Priority support', included: true },
    ],
    highlighted: true,
  },
]

// Main 3 features - used in both sections
const coreFeatures = [
  {
    icon: <Zap className="h-8 w-8" />,
    title: 'What Shipped',
    description: 'Features you deployed today, this week, this month. Always visible in sidebar.',
  },
  {
    icon: <Target className="h-8 w-8" />,
    title: 'Current Focus',
    description: "The one thing you're working on right now. Status bar timer.",
  },
  {
    icon: <TrendingUp className="h-8 w-8" />,
    title: 'Your Momentum',
    description: 'Streak counter showing consistent shipping. Keep the fire alive.',
  },
]

// Extension implementation details
const extensionFeatures = [
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Sidebar Dashboard',
    description: 'Shipped Today, Working Now, This Week - always visible',
  },
  {
    icon: <Activity className="h-6 w-6" />,
    title: 'Status Bar',
    description: 'Streak, ships today, current task timer in bottom bar',
  },
  {
    icon: <Cloud className="h-6 w-6" />,
    title: 'Cloud Sync (Pro)',
    description: 'Auto-backup, multi-device, encrypted storage',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Team Realtime (Pro)',
    description: 'See teammate ships. No meetings. Just async awareness.',
  },
]

// Declare Tally type for TypeScript
declare global {
  interface Window {
    Tally?: {
      openPopup: (formId: string, options?: Record<string, unknown>) => void
    }
  }
}

export const WindsurfExtensionPage = () => {
  const [isAnnual, setIsAnnual] = useState(false)
  const tiers = getTiers(isAnnual)

  // Ensure Tally is loaded
  useEffect(() => {
    // Check if Tally script is loaded
    const checkTally = setInterval(() => {
      if (window.Tally) {
        clearInterval(checkTally)
      }
    }, 100)

    return () => clearInterval(checkTally)
  }, [])

  const handleTallyClick = () => {
    if (window.Tally) {
      window.Tally.openPopup('wgK0L4', {
        layout: 'modal',
        width: 700,
        emoji: {
          text: '✨',
          animation: 'wave',
        },
        // Remove autoClose - let user close manually or after submission
        // autoClose: 3000,
      })
    } else {
      console.error('Tally is not loaded yet')
    }
  }

  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-7xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mb-20 overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5 px-8 py-16 text-center md:py-20"
        >
          {/* Background decoration */}
          <div className="bg-grid-white/5 absolute inset-0 [mask-image:radial-gradient(white,transparent_70%)]" />
          <div className="absolute left-1/2 top-0 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

          {/* Content */}
          <div className="relative">
            {/* Phase Badges */}
            <div className="mb-8 flex items-center justify-center gap-3">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: [0.9, 1, 0.9] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-4 py-2 backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-sm font-medium text-transparent">
                  Coming Soon
                </span>
              </motion.div>
            </div>

            <h1 className="mb-6 text-5xl font-bold md:text-7xl">
              <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Windsurf Extension
              </span>
            </h1>

            <p className="mx-auto mb-4 max-w-3xl text-2xl font-bold text-foreground md:text-3xl">
              See your ships. Track momentum. Stay focused.
            </p>

            <p className="mx-auto mb-6 max-w-3xl text-base text-muted-foreground md:text-lg">
              VS Code/Windsurf extension that shows what matters: what shipped today, what you're
              working on, your streak. No kanban BS. No task cards. No meetings. Just ship.
            </p>

            {/* Why Windsurf Extension */}
            <p className="mx-auto mb-10 max-w-2xl text-sm text-muted-foreground/80">
              Why "Windsurf Extension"? Because we love{' '}
              <a
                href="https://windsurf.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 underline decoration-purple-500/30 underline-offset-2 transition-colors hover:text-purple-400 hover:decoration-purple-400/50"
              >
                Windsurf
              </a>
              . Works with VS Code too.
            </p>

            {/* Integration Badges */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Badge variant="default" size="md" icon={<Code2 className="h-4 w-4" />}>
                Windsurf & VS Code
              </Badge>
              <Badge variant="success" size="md" icon={<Check className="h-4 w-4" />}>
                Requires prjct/cli
              </Badge>
              <Badge variant="info" size="md" icon={<Activity className="h-4 w-4" />}>
                Real-time Sync
              </Badge>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm">
              <Target className="h-4 w-4" />
              Target Launch: Q4 2025 (8 weeks)
            </div>
          </div>
        </motion.div>

        {/* Features Section */}
        <div className="mb-24">
          <SectionHeader
            title="Everything in Your Editor"
            subtitle="Track ships and momentum without leaving VS Code or Windsurf"
            gradient
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {extensionFeatures.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>

        {/* Pricing Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-20"
        >
          <h2 className="mb-4 text-center text-3xl font-bold">Free vs Pro</h2>
          <p className="mb-8 text-center text-muted-foreground">
            CLI is free forever. Extension adds visual tracking in your editor.
          </p>

          {/* Billing Toggle */}
          <div className="mb-12 flex justify-center">
            <div className="inline-flex rounded-lg border border-purple-500/20 bg-muted/50 p-1">
              <button
                onClick={() => setIsAnnual(false)}
                className={`rounded-md px-6 py-2 text-sm font-medium transition-all ${
                  !isAnnual
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`rounded-md px-6 py-2 text-sm font-medium transition-all ${
                  isAnnual
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
                <span className="ml-2 text-xs">Save $24</span>
              </button>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {tiers.map((tier, index) => (
              <PricingCard
                key={tier.name}
                name={tier.name}
                subtitle={tier.subtitle}
                price={tier.price}
                period={tier.period}
                savings={tier.savings}
                description={tier.description}
                features={tier.features}
                highlighted={tier.highlighted}
                index={index}
              />
            ))}
          </div>

          {/* Early Access Form */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12"
          >
            <div className="mx-auto max-w-2xl">
              <div className="relative">
                {/* Background Decoration */}
                <div className="absolute inset-0 -z-10">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500/5 to-blue-500/5 blur-xl" />
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-md md:p-12"
                >
                  {/* Header */}
                  <div className="mb-8 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                      className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20"
                    >
                      <Sparkles className="h-7 w-7 text-purple-500" />
                    </motion.div>

                    <h3 className="mb-3 text-3xl font-bold">
                      <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        Join the Waitlist
                      </span>
                    </h3>

                    <p className="mx-auto mb-6 max-w-md text-muted-foreground">
                      Get early access to the extension. Track ships, focus, and momentum directly
                      in VS Code/Windsurf.
                    </p>

                    {/* Tally Button */}
                    <motion.button
                      onClick={handleTallyClick}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-8 py-4 font-medium text-white transition-all duration-300"
                    >
                      <Sparkles className="h-5 w-5" />
                      <span>Join the Waitlist</span>
                      <ArrowRight className="h-4 w-4" />
                    </motion.button>

                    {/* Note */}
                    <p className="mt-4 text-xs text-muted-foreground">
                      Quick form - takes 30 seconds
                    </p>
                  </div>

                  {/* Features Preview */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 border-t border-border/50 pt-8"
                  >
                    <p className="mb-4 text-center text-sm text-muted-foreground">
                      What you'll get with early access:
                    </p>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {[
                        { title: 'Beta Access', desc: 'Try before public launch' },
                        { title: 'Shape Features', desc: 'Your feedback matters' },
                        { title: 'Lifetime Updates', desc: 'All future improvements' },
                      ].map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 + index * 0.1 }}
                          className="text-center"
                        >
                          <div className="mb-1 text-sm font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Pricing Note */}
                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    Solo & Team: {isAnnual ? '$120/year per dev (save $24)' : '$12/month per dev'} •
                    No minimums
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* What's NOT Included */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-20 overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-background via-muted/30 to-background"
        >
          {/* Header with gradient background */}
          <div className="relative bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 px-8 py-12 text-center">
            <div className="bg-grid-white/5 absolute inset-0 [mask-image:radial-gradient(white,transparent_85%)]" />
            <h2 className="relative mb-4 text-3xl font-bold md:text-4xl">What We Don't Do</h2>
            <div className="relative mx-auto max-w-4xl">
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground md:grid-cols-4 md:gap-4 md:text-base">
                {[
                  'Kanban boards',
                  'Task assignment',
                  'Due dates',
                  'Story points',
                  'Sprint planning',
                  'Burndown charts',
                  'Time estimates',
                  'Ceremonies',
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center gap-2 rounded-lg bg-background/50 px-3 py-2 backdrop-blur-sm"
                  >
                    <X className="h-4 w-4 flex-shrink-0 text-red-500/70" />
                    <span className="line-through">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What we focus on */}
          <div className="px-8 py-12">
            <p className="mb-8 text-center text-2xl font-bold text-foreground">
              We only track 3 things:
            </p>
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
              {coreFeatures.map((feature, index) => (
                <FeatureCard
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  index={index}
                  variant="large"
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Privacy Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-20 rounded-2xl border border-border bg-card p-8"
        >
          <h2 className="mb-6 text-2xl font-bold">Privacy & Team Sharing</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-primary">
                <Users className="h-5 w-5" /> Shared with Team
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
                  <span>shipped.md (celebrate wins together)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
                  <span>now.md (see current focus)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
                  <span>ideas.md (brainstorm together)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
                  <span>roadmap.md (align on direction)</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                User configurable - choose what to share
              </p>
            </div>
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-muted-foreground">
                <Shield className="h-5 w-5" /> Always Private
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <X className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>next.md (your personal queue)</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>metrics.md (individual stats)</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>context.jsonl (decision history)</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Never shared, encrypted in cloud</p>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 p-12 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold">Stop Managing. Start Shipping.</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            CLI is free. Extension launches Q1 2026. No ceremonies, no BS, just momentum.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/jlopezlira/prjct-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary px-8 py-3 text-primary-foreground transition-all hover:opacity-90"
            >
              Get prjct-cli Free →
            </a>
            <Link
              to="/docs"
              className="rounded-lg border border-border px-8 py-3 transition-all hover:bg-muted"
            >
              Read Documentation
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
