import { LucideIcon } from "lucide-react"
import { ReactNode } from "react"

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description?: string
  bullets: ReactNode[]
}

export function FeatureCard({ icon: Icon, title, description, bullets }: FeatureCardProps) {
  return (
    <div className="p-6 bg-muted/20 rounded-2xl">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
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
