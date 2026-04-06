import { useEffect, useState } from 'react'
import { queryClient } from '@/lib/query-client'

export function useSSE(onEvent?: (event: { event: string; data: unknown }) => void) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const source = new EventSource('/api/events')
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data)
        onEvent?.(parsed)
        // Invalidate relevant queries on any event
        queryClient.invalidateQueries({ queryKey: ['project'] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      } catch { /* ignore */ }
    }
    return () => source.close()
  }, [])

  return { connected }
}
