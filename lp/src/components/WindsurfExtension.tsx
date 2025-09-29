import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import {
  BarChart3,
  Target,
  Bell,
  Clock,
  TrendingUp,
  Sparkles,
  Code2,
  Activity
} from 'lucide-react'
import WindsurfPreview from './WindsurfPreview'
import EarlyAccessForm from './EarlyAccessForm'

const WindsurfExtension = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], [100, -100])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8])

  const features = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Real-time Metrics",
      description: "Track your shipping velocity and project momentum live"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Focus Mode",
      description: "Current task always visible in your status bar"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Velocity Tracking",
      description: "Visualize your weekly shipping progress"
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Smart Notifications",
      description: "Celebrate wins and stay motivated"
    }
  ]

  const timeline = [
    { phase: "Validation & Research", status: "active", date: "Oct 2025" },
    { phase: "Concept & Design", status: "upcoming", date: "Nov 2025" },
    { phase: "Development", status: "upcoming", date: "Dec 2025" },
    { phase: "Beta Release", status: "upcoming", date: "Jan 2026" },
    { phase: "Public Launch", status: "upcoming", date: "Feb 2026" }
  ]

  return (
    <section ref={containerRef} className="windsurf-extension-section py-24 px-6 relative overflow-hidden">
      {/* Background Gradient Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Hero Section */}
      <motion.div
        className="container mx-auto max-w-6xl"
        style={{ opacity }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          {/* Phase Badge */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: [0.9, 1, 0.9] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-purple-500/30"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Coming Soon
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20"
            >
              <Clock className="w-3 h-3 text-purple-500 animate-pulse" />
              <span className="text-xs font-medium text-purple-500">
                In Validation
              </span>
            </motion.div>
          </div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Windsurf Extension
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Visual metrics for your shipping momentum. Track progress, celebrate wins,
            and stay focused — right in your editor. Launching February 2026.
          </p>

          {/* Integration Badges */}
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              <span>VS Code Compatible</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>Real-time Sync</span>
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
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
              className="group relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-purple-500/50 transition-all duration-300"
            >
              {/* Glow Effect on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <div className="text-purple-500">
                    {feature.icon}
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
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
          <WindsurfPreview />
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-20 max-w-4xl mx-auto py-12 px-6 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-2xl border border-purple-500/20"
        >
          <h2 className="text-3xl font-bold text-center mb-12">
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
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      item.status === 'completed'
                        ? 'bg-green-500 border-green-500'
                        : item.status === 'active'
                        ? 'bg-purple-500 border-purple-500 shadow-lg shadow-purple-500/50'
                        : 'bg-background border-muted-foreground/30'
                    }`}>
                      {item.status === 'active' && (
                        <div className="absolute inset-0 rounded-full bg-purple-500 animate-ping" />
                      )}
                    </div>
                    {/* Vertical Line */}
                    {index < timeline.length - 1 && (
                      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-0.5 h-12 bg-gradient-to-b from-purple-500/30 to-transparent" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 bg-card/50 rounded-xl border border-border/50 hover:border-purple-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`text-lg font-semibold mb-1 ${
                          item.status === 'completed' ? 'text-muted-foreground line-through' :
                          item.status === 'active' ? 'text-purple-500' : 'text-foreground'
                        }`}>
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
                          <div className="mt-2 px-2 py-1 bg-purple-500/20 text-purple-500 rounded-full text-xs inline-block">
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
            <div className="h-2 bg-muted-foreground/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: "10%" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
              />
            </div>
            <p className="text-center mt-3 text-sm text-muted-foreground">
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
          className="max-w-4xl mx-auto"
        >
          <EarlyAccessForm />
        </motion.div>
      </motion.div>
    </section>
  )
}

export default WindsurfExtension