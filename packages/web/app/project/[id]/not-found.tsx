import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FolderX, ArrowLeft } from 'lucide-react'

export default function ProjectNotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <FolderX className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-medium">Project not found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This project may have been deleted or moved.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
