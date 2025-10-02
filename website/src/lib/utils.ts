import clsx, { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Combines CSS classes without duplicates
// Example: cn('p-4', 'p-2') → 'p-2' (last one wins)
// Example: cn('bg-blue-500', 'hover:bg-blue-600') → both classes applied
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
