export interface Ship {
  name: string
  date: string
  version?: string
  duration?: string
}

export interface ShipsCardProps {
  ships: Ship[]
  totalShips?: number
  className?: string
}
