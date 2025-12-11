export type MomentumStatus = 'hot' | 'active' | 'cooling' | 'cold'

export interface MomentumData {
  dailyTasks: number[]
  totalTasks: number
  totalShips: number
  lastActivityDate: string | null
  daysSinceActivity: number
  streak: number
  status: MomentumStatus
  message: string
}

export interface MomentumWidgetProps {
  projectId: string
}
