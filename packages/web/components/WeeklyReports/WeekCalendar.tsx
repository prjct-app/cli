'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCurrentYearWeek, getWeekDateRange, formatDateRange } from '@/lib/generate-week-report'

export type ActivityLevel = 'none' | 'low' | 'medium' | 'high'

interface WeekCalendarProps {
  year: number
  selectedWeeks: number[]
  activityLevels: Map<number, ActivityLevel>
  onWeekSelect: (weeks: number[]) => void
  onYearChange: (year: number) => void
}

const DAYS = ['M', 'T', 'W', 'T', 'F'] // Mon-Fri

export function WeekCalendar({
  year,
  selectedWeeks,
  activityLevels,
  onWeekSelect,
  onYearChange,
}: WeekCalendarProps) {
  const { year: currentYear, week: currentWeek } = getCurrentYearWeek()
  const isCurrentYear = year === currentYear
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  // Generate 52 weeks
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1)

  // Drag to scroll state
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeftStart, setScrollLeftStart] = useState(0)
  const [hasMoved, setHasMoved] = useState(false)

  // Handle mouse down - start potential drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return
    setIsDragging(true)
    setStartX(e.pageX)
    setScrollLeftStart(scrollRef.current.scrollLeft)
    setHasMoved(false)
  }

  // Handle mouse move - scroll if dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return

    const diff = e.pageX - startX
    // Only count as drag if moved more than 5px
    if (Math.abs(diff) > 5) {
      setHasMoved(true)
      e.preventDefault()
      scrollRef.current.scrollLeft = scrollLeftStart - diff
    }
  }

  // Handle mouse up - end drag
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Handle week click (only if not dragging)
  const handleWeekClick = (week: number, e: React.MouseEvent) => {
    // Ignore click if we were dragging
    if (hasMoved) {
      e.preventDefault()
      return
    }

    const isFuture = isCurrentYear && week > currentWeek
    if (isFuture) return

    if (selectedWeeks.includes(week)) {
      onWeekSelect(selectedWeeks.filter(w => w !== week))
    } else {
      onWeekSelect([...selectedWeeks, week].sort((a, b) => a - b))
    }
  }

  // Check scroll state
  const updateScrollState = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    updateScrollState()
    // Scroll to current week on mount
    if (scrollRef.current && isCurrentYear) {
      const weekElement = scrollRef.current.querySelector(`[data-week="${currentWeek}"]`)
      if (weekElement) {
        weekElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [currentWeek, isCurrentYear])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Year header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onYearChange(year - 1)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-4xl font-bold tabular-nums">{year}</span>

          <button
            onClick={() => onYearChange(year + 1)}
            disabled={year >= currentYear}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm text-muted-foreground">
          {selectedWeeks.length === 0
            ? 'Select weeks'
            : selectedWeeks.length === 1
              ? `W${selectedWeeks[0]}`
              : `${selectedWeeks.length} wks`
          }
        </span>
      </div>

      {/* Horizontal week strip */}
      <div className="relative -mx-2">
        {/* Scroll buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-background/80 backdrop-blur rounded-full shadow-lg border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-background/80 backdrop-blur rounded-full shadow-lg border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Scrollable week cards - drag to scroll */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            'flex gap-3 overflow-x-auto scrollbar-hide py-2 px-2',
            isDragging && hasMoved ? 'cursor-grabbing' : 'cursor-grab'
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {weeks.map((week) => {
            const isSelected = selectedWeeks.includes(week)
            const isCurrent = isCurrentYear && week === currentWeek
            const activityLevel = activityLevels.get(week) ?? 'none'
            const isFuture = isCurrentYear && week > currentWeek
            const { start, end } = getWeekDateRange(year, week)

            // Get month name
            const monthName = start.toLocaleDateString('en-US', { month: 'short' })
            const dayStart = start.getDate()
            const dayEnd = end.getDate()

            return (
              <div
                key={week}
                data-week={week}
                onClick={(e) => handleWeekClick(week, e)}
                className={cn(
                  'flex-shrink-0 w-28 rounded-2xl transition-all duration-200 select-none',
                  'flex flex-col overflow-hidden',
                  'border',
                  isFuture && 'opacity-30',
                  // Selected state
                  isSelected
                    ? 'bg-foreground text-background border-foreground shadow-lg scale-105'
                    : 'bg-card hover:bg-muted border-border',
                  isCurrent && !isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
              >
                {/* Week header */}
                <div className={cn(
                  'px-3 py-2 text-left border-b',
                  isSelected ? 'border-background/20' : 'border-border'
                )}>
                  <div className="flex items-baseline gap-0.5">
                    <span className={cn(
                      'text-xs font-medium',
                      isSelected ? 'text-background/60' : 'text-muted-foreground'
                    )}>
                      W
                    </span>
                    <span className="text-2xl font-bold tabular-nums">{week}</span>
                  </div>
                  <p className={cn(
                    'text-xs mt-0.5',
                    isSelected ? 'text-background/70' : 'text-muted-foreground'
                  )}>
                    {monthName} {dayStart}-{dayEnd}
                  </p>
                </div>

                {/* Days grid - Mon to Fri with GitHub-style activity levels */}
                <div className="px-3 py-2">
                  <div className="flex justify-between gap-1">
                    {DAYS.map((day, i) => {
                      // Generate activity level per day based on week activity
                      // This simulates varying activity levels across the week
                      let dayActivityLevel: 0 | 1 | 2 | 3 | 4 = 0

                      if (activityLevel === 'high') {
                        // High activity: most days are 3-4
                        dayActivityLevel = [4, 3, 4, 3, 2][i] as 0 | 1 | 2 | 3 | 4
                      } else if (activityLevel === 'medium') {
                        // Medium: mix of 2-3
                        dayActivityLevel = [2, 3, 2, 1, 2][i] as 0 | 1 | 2 | 3 | 4
                      } else if (activityLevel === 'low') {
                        // Low: mostly 0-1
                        dayActivityLevel = [1, 0, 1, 0, 0][i] as 0 | 1 | 2 | 3 | 4
                      }

                      // GitHub-style green gradients
                      const activityColors = {
                        0: isSelected ? 'bg-background/10' : 'bg-muted',
                        1: isSelected ? 'bg-background/30' : 'bg-emerald-500/30',
                        2: isSelected ? 'bg-background/50' : 'bg-emerald-500/50',
                        3: isSelected ? 'bg-background/75' : 'bg-emerald-500/75',
                        4: isSelected ? 'bg-background' : 'bg-emerald-500',
                      }

                      return (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className={cn(
                            'text-[10px] font-medium',
                            isSelected ? 'text-background/50' : 'text-muted-foreground'
                          )}>
                            {day}
                          </span>
                          <div className={cn(
                            'w-3 h-3 rounded-sm',
                            activityColors[dayActivityLevel]
                          )} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
