import { Badge } from '@/components/ui/Badge'

interface VersionHeaderProps {
  version: string
  isLatest?: boolean
}

export function VersionHeader({ version, isLatest = false }: VersionHeaderProps) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <h2 className="text-3xl font-bold">{version}</h2>
      {isLatest && <Badge className="bg-cat-green text-cat-base">Latest</Badge>}
    </div>
  )
}
