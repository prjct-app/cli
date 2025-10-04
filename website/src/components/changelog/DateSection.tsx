import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'

interface DateSectionProps {
  id: string
  date: string
  releaseCount: number
  children: React.ReactNode
}

export const DateSection = ({ id, date, releaseCount, children }: DateSectionProps) => {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-20"
    >
      {/* Date Header */}
      <div className="sticky top-4 z-10 mb-8 border-b border-border bg-background/95 pb-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{date}</h2>
              <p className="text-sm text-muted-foreground">
                {releaseCount} {releaseCount === 1 ? 'release' : 'releases'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Versions for this date */}
      <div className="space-y-16">{children}</div>
    </motion.section>
  )
}
