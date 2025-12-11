export interface RoadmapPhase {
  name: string
  progress: number
  features?: Array<{ name: string; status: string }>
}

export interface RoadmapData {
  phases: RoadmapPhase[]
  progress: number
}

export interface RoadmapCardProps {
  roadmap: RoadmapData | null
  codeHref?: string
  className?: string
}
