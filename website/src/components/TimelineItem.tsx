import { motion } from 'framer-motion'

interface TimelineItemProps {
  phase: string
  status: 'completed' | 'active' | 'upcoming'
  date: string
  weeks?: string
  progress?: number
  index: number
  isLast: boolean
}

export const TimelineItem = ({
  phase,
  status,
  date,
  progress,
  index,
  isLast,
}: TimelineItemProps) => {
  return (
    <motion.div
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
              status === 'completed'
                ? 'border-green-500 bg-green-500'
                : status === 'active'
                  ? 'border-purple-500 bg-purple-500 shadow-lg shadow-purple-500/50'
                  : 'border-muted-foreground/30 bg-background'
            }`}
          >
            {status === 'active' && (
              <div className="absolute inset-0 animate-ping rounded-full bg-purple-500" />
            )}
          </div>
          {/* Vertical Line */}
          {!isLast && (
            <div className="absolute left-1/2 top-4 h-12 w-0.5 -translate-x-1/2 transform bg-gradient-to-b from-purple-500/30 to-transparent" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-border/50 bg-card/50 p-4 transition-all duration-300 hover:border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h3
                className={`mb-1 text-lg font-semibold ${
                  status === 'completed'
                    ? 'text-muted-foreground line-through'
                    : status === 'active'
                      ? 'text-purple-500'
                      : 'text-foreground'
                }`}
              >
                {phase}
              </h3>
              <p className="text-sm text-muted-foreground">
                {status === 'active' && progress && `🔄 In Progress - ${progress}% Complete`}
                {status === 'upcoming' && '📅 Scheduled'}
                {status === 'completed' && '✅ Completed'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-medium text-purple-500">{date}</span>
              {status === 'active' && (
                <div className="mt-2 inline-block rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-500">
                  Active
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
