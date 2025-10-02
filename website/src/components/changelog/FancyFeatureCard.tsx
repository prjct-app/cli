import { LucideIcon } from "lucide-react"
import { ReactNode } from "react"

interface FancyFeatureCardProps {
  icon: LucideIcon
  title: string
  description?: string
  bullets: ReactNode[]
}

export function FancyFeatureCard({ icon: Icon, title, description, bullets }: FancyFeatureCardProps) {
  return (
    <div className="relative p-6 bg-gradient-to-br from-cat-mauve/10 to-cat-blue/10 rounded-2xl border-2 border-cat-mauve/30">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-cat-mauve/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-cat-mauve" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">{title}</h3>
          {description && (
            <p className="text-muted-foreground mb-3">{description}</p>
          )}
          <ul className="space-y-2 text-sm text-muted-foreground">
            {bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
