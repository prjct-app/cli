import { Badge } from '@/components/ui/badge'
import { RefreshCw } from 'lucide-react'

interface ConnectionStatusProps {
  isConnected: boolean
  isReconnecting?: boolean
  reconnectInfo?: { attempt: number; max: number } | null
}

export function ConnectionStatus({ isConnected, isReconnecting, reconnectInfo }: ConnectionStatusProps) {
  if (isReconnecting && reconnectInfo) {
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 animate-pulse">
        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
        Reconnecting ({reconnectInfo.attempt}/{reconnectInfo.max})
      </Badge>
    )
  }

  if (isConnected) {
    return (
      <Badge variant="outline" className="text-green-500 border-green-500/50">
        Connected
      </Badge>
    )
  }

  return null
}
