import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { BarChart3, Target, Bell, TrendingUp, Sparkles, Code2, Activity } from 'lucide-react'
import ProPreview from './ProPreview'
import EarlyAccessForm from './EarlyAccessForm'

const ProExtension = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], [100, -100])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8])

  const features = [
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'Real-time Metrics',
      description: 'Track your shipping velocity and project momentum live',
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: 'Focus Mode',
      description: 'Current task always visible in your status bar',
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: 'Velocity Tracking',
      description: 'Visualize your weekly shipping progress',
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: 'Smart Notifications',
      description: 'Celebrate wins and stay motivated',
    },
  ]

  const timeline = [
    { phase: 'Validation & Research', status: 'active', date: 'Oct 2025' },
    { phase: 'Concept & Design', status: 'upcoming', date: 'Nov 2025' },
    { phase: 'Development', status: 'upcoming', date: 'Dec 2025' },
    { phase: 'Beta Release', status: 'upcoming', date: 'Jan 2026' },
    { phase: 'Public Launch', status: 'upcoming', date: 'Feb 2026' },
  ]

  return (
    <section
      ref={containerRef}
      className="pro-extension-section relative overflow-hidden px-6 py-24"
    >
      {/* Background Gradient Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Hero Section */}
      <motion.div className="container mx-auto max-w-6xl" style={{ opacity }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-20 text-center"
        >
          {/* Phase Badge */}
          <div className="mb-6 flex items-center justify-center gap-3">
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

          {/* Main Title */}
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              prjct/pro
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            Extension + Cloud + Team features. Track progress, celebrate wins, and collaborate
            without meetings — right in your editor. Launching February 2026.
          </p>

          {/* Integration Badges */}
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              <span>VS Code Compatible</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>Real-time Sync</span>
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
          style={{ y }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="group relative rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-purple-500/50"
            >
              {/* Glow Effect on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 transition-transform duration-300 group-hover:scale-110">
                  <div className="text-purple-500">{feature.icon}</div>
                </div>

                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Preview Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <ProPreview />
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mx-auto mb-20 max-w-4xl rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 px-6 py-12"
        >
          <h2 className="mb-12 text-center text-3xl font-bold">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Development Timeline
            </span>
          </h2>

          <div className="space-y-6">
            {timeline.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="flex items-center gap-6">
                  {/* Timeline Connector */}
                  <div className="relative">
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${
                        item.status === 'completed'
                          ? 'border-green-500 bg-green-500'
                          : item.status === 'active'
                            ? 'border-purple-500 bg-purple-500 shadow-lg shadow-purple-500/50'
                            : 'border-muted-foreground/30 bg-background'
                      }`}
                    >
                      {item.status === 'active' && (
                        <div className="absolute inset-0 animate-ping rounded-full bg-purple-500" />
                      )}
                    </div>
                    {/* Vertical Line */}
                    {index < timeline.length - 1 && (
                      <div className="absolute left-1/2 top-4 h-12 w-0.5 -translate-x-1/2 transform bg-gradient-to-b from-purple-500/30 to-transparent" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 rounded-xl border border-border/50 bg-card/50 p-4 transition-all duration-300 hover:border-purple-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className={`mb-1 text-lg font-semibold ${
                            item.status === 'completed'
                              ? 'text-muted-foreground line-through'
                              : item.status === 'active'
                                ? 'text-purple-500'
                                : 'text-foreground'
                          }`}
                        >
                          {item.phase}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.status === 'active' && '🔄 In Progress - 10% Complete'}
                          {item.status === 'upcoming' && '📅 Scheduled'}
                          {item.status === 'completed' && '✅ Completed'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-medium text-purple-500">{item.date}</span>
                        {item.status === 'active' && (
                          <div className="mt-2 inline-block rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-500">
                            Active
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="mt-10 px-6">
            <div className="h-2 overflow-hidden rounded-full bg-muted-foreground/10">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: '10%' }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
              />
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              10% Complete • Validation Phase
            </p>
          </div>
        </motion.div>

        {/* Early Access Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mx-auto max-w-4xl"
        >
          <EarlyAccessForm />
        </motion.div>
      </motion.div>
    </section>
  )
}

export default ProExtension
