import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

interface Feature {
  text: string
  included: boolean
  bold?: boolean
}

interface PricingCardProps {
  name: string
  subtitle: string
  price: string
  period: string
  savings?: string | null
  description: string
  features: Feature[]
  highlighted: boolean
  index: number
}

export const PricingCard = ({
  name,
  subtitle,
  price,
  period,
  savings,
  description,
  features,
  highlighted,
  index,
}: PricingCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`relative rounded-2xl border p-8 ${
        highlighted
          ? 'border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 shadow-lg shadow-purple-500/20'
          : 'border-border bg-card'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500/90 to-blue-500/90 px-4 py-1 text-sm font-medium text-white">
          Recommended
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold">{name}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{price}</span>
          <span className="text-muted-foreground">/{period}</span>
        </div>
        {savings && <p className="mt-1 text-sm font-medium text-green-500">{savings}</p>}
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>

      <ul className="space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            {feature.included ? (
              <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            ) : (
              <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground/30" />
            )}
            <span
              className={`text-sm ${
                feature.included ? 'text-foreground' : 'text-muted-foreground/50'
              } ${feature.bold ? 'font-semibold' : ''}`}
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}
