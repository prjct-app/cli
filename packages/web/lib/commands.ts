import {
  Play,
  Target,
  Lightbulb,
  ListTodo,
  Rocket,
  Sparkles,
  CheckCircle2,
  Pause,
  BarChart3,
  TrendingUp,
  Activity,
  History,
  Undo2,
  Redo2,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'

export interface WorkflowCommand {
  cmd: string
  icon: LucideIcon
  tip: string
  group: CommandGroup
}

export type CommandGroup = 'work' | 'session' | 'plan' | 'ship' | 'status' | 'recovery'

// Commands ordered by real developer workflow
export const WORKFLOW_COMMANDS: readonly WorkflowCommand[] = [
  { cmd: 'p. now', icon: Target, tip: 'Set task', group: 'work' },
  { cmd: 'p. done', icon: CheckCircle2, tip: 'Complete', group: 'work' },
  { cmd: 'p. pause', icon: Pause, tip: 'Pause', group: 'session' },
  { cmd: 'p. resume', icon: Play, tip: 'Resume', group: 'session' },
  { cmd: 'p. feature', icon: Sparkles, tip: 'Feature', group: 'plan' },
  { cmd: 'p. idea', icon: Lightbulb, tip: 'Idea', group: 'plan' },
  { cmd: 'p. next', icon: ListTodo, tip: 'Queue', group: 'plan' },
  { cmd: 'p. ship', icon: Rocket, tip: 'Ship', group: 'ship' },
  { cmd: 'p. recap', icon: BarChart3, tip: 'Recap', group: 'status' },
  { cmd: 'p. progress', icon: TrendingUp, tip: 'Progress', group: 'status' },
  { cmd: 'p. status', icon: Activity, tip: 'Status', group: 'status' },
  { cmd: 'p. history', icon: History, tip: 'History', group: 'status' },
  { cmd: 'p. undo', icon: Undo2, tip: 'Undo', group: 'recovery' },
  { cmd: 'p. redo', icon: Redo2, tip: 'Redo', group: 'recovery' },
] as const

export const COMMAND_GROUPS: readonly CommandGroup[] = ['work', 'session', 'plan', 'ship', 'status', 'recovery']

// Sync command - always first/prominent
export const SYNC_COMMAND: WorkflowCommand = {
  cmd: 'p. sync',
  icon: RefreshCw,
  tip: 'Sync',
  group: 'status',
}

// Get commands by group
export function getCommandsByGroup(group: CommandGroup): WorkflowCommand[] {
  return WORKFLOW_COMMANDS.filter(c => c.group === group)
}

// Project colors for tabs (based on project ID hash)
export const PROJECT_COLORS = [
  'bg-orange-500/20 border-orange-500/50 text-orange-400',
  'bg-blue-500/20 border-blue-500/50 text-blue-400',
  'bg-green-500/20 border-green-500/50 text-green-400',
  'bg-purple-500/20 border-purple-500/50 text-purple-400',
  'bg-pink-500/20 border-pink-500/50 text-pink-400',
  'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
  'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  'bg-red-500/20 border-red-500/50 text-red-400',
]

export function getProjectColor(projectId: string): string {
  let hash = 0
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash) + projectId.charCodeAt(i)
    hash = hash & hash
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length]
}
