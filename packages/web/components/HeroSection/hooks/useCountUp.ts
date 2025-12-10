'use client'

import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration: number = 800): number {
  const [count, setCount] = useState(0)
  const prevTargetRef = useRef(target)

  useEffect(() => {
    if (target === 0) {
      // Only reset if target changed to 0 (not if it was already 0)
      if (prevTargetRef.current !== 0) {
        // Defer state update to avoid synchronous setState in effect
        const timeoutId = setTimeout(() => setCount(0), 0)
        prevTargetRef.current = target
        return () => clearTimeout(timeoutId)
      }
      prevTargetRef.current = target
      return
    }

    prevTargetRef.current = target

    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(easeOut * target)

      setCount(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(target)
      }
    }

    requestAnimationFrame(animate)
  }, [target, duration])

  return count
}
