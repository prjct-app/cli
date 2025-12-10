import { Badge } from '@/components/ui/badge'

interface TechStackBadgesProps {
  techStack: string[]
  max?: number
}

export function TechStackBadges({ techStack, max = 4 }: TechStackBadgesProps) {
  if (!techStack || techStack.length === 0) return null

  return (
    <div className="flex gap-1">
      {techStack.slice(0, max).map((tech) => (
        <Badge key={tech} variant="secondary" className="text-[10px] px-1.5 py-0">
          {tech}
        </Badge>
      ))}
    </div>
  )
}
