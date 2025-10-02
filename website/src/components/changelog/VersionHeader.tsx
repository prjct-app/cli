import { Badge } from "@/components/ui/Badge"

interface VersionHeaderProps {
  version: string
  date: string
  isLatest?: boolean
}

export function VersionHeader({ version, date, isLatest = false }: VersionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h2 className="text-3xl font-bold">{version}</h2>
      {isLatest && (
        <Badge className="bg-cat-green text-cat-base">Latest</Badge>
      )}
      <span className="text-muted-foreground">— {date}</span>
    </div>
  )
}
