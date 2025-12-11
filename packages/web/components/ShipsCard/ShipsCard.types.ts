export interface Ship {
  name: string
  date: string
  version?: string
  duration?: string
  filesChanged?: number
}

export interface ShipsCardProps {
  ships: Ship[]
  totalShips?: number
  codeHref?: string
  className?: string
}
