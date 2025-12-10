import { BentoCard } from '@/components/BentoCard'
import { EmptyState } from '@/components/EmptyState'
import { Rocket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatShipDate } from './ShipsCard.utils'
import type { ShipsCardProps } from './ShipsCard.types'

export function ShipsCard({ ships, totalShips = 0, className }: ShipsCardProps) {
  const displayShips = ships.slice(0, 4)

  return (
    <BentoCard
      size="1x2"
      title="Ships"
      icon={Rocket}
      count={totalShips}
      accentColor={ships.length > 0 ? 'success' : 'default'}
      className={className}
    >
      {ships.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Nothing shipped yet"
          description="Ship your first feature"
          command="/p:ship"
          compact
        />
      ) : (
        <div className="space-y-3">
          {displayShips.map((ship, i) => (
            <div key={i} className="group">
              <div className="flex items-center gap-2">
                {ship.version && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                    {ship.version}
                  </Badge>
                )}
                <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                  {ship.name}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatShipDate(ship.date)}
                {ship.duration && ` · ${ship.duration}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  )
}
