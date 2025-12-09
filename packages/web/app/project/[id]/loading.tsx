import { Loader2 } from 'lucide-react'

export default function ProjectLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  )
}
