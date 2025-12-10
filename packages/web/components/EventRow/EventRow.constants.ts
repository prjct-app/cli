import { Activity, CheckCircle2, Rocket, Target, RefreshCw } from 'lucide-react'
import type { EventIconName } from './EventRow.types'

export const EVENT_ICON_MAP: Record<EventIconName, typeof Activity> = {
  check: CheckCircle2,
  target: Target,
  rocket: Rocket,
  refresh: RefreshCw,
  activity: Activity,
}
