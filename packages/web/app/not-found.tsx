import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <div>
          <h2 className="text-lg font-medium">Page not found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The page you're looking for doesn't exist.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
