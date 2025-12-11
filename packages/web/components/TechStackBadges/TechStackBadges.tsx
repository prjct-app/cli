import { Badge } from '@/components/ui/badge'

interface TechStackBadgesProps {
  techStack: string[] | Record<string, string[]> | undefined
  max?: number
}

function normalizeTechStack(techStack: string[] | Record<string, string[]> | undefined): string[] {
  if (!techStack) return []
  if (Array.isArray(techStack)) return techStack
  // Handle object format: { languages: [...], frameworks: [...] }
  return Object.values(techStack).flat()
}

export function TechStackBadges({ techStack, max = 4 }: TechStackBadgesProps) {
  const normalized = normalizeTechStack(techStack)
  if (normalized.length === 0) return null

  return (
    <div className="flex gap-1">
      {normalized.slice(0, max).map((tech) => (
        <Badge key={tech} variant="secondary" className="text-xs px-1.5 py-0">
          {tech}
        </Badge>
      ))}
    </div>
  )
}
