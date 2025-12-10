import type { InsightMessageProps } from './InsightMessage.types'

export function InsightMessage({ message }: InsightMessageProps) {
  return (
    <p className="text-sm md:text-base text-muted-foreground mt-2 md:mt-3 max-w-md">
      {message}
    </p>
  )
}
