'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RotateCcw, Copy, Check, Printer } from 'lucide-react'
import { WeekCalendar, type ActivityLevel } from './WeekCalendar'
import { ReportPreviewCard } from './ReportPreviewCard'
import {
  getCurrentYearWeek,
  filterDataByWeek,
  generateReportText,
  getWeekActivityLevel,
} from '@/lib/generate-week-report'
import type { StatsResult } from '@/lib/services/stats.server'
import { cn } from '@/lib/utils'

interface WeeklyReportsProps {
  stats: StatsResult
  projectName: string
}

export function WeeklyReports({ stats, projectName }: WeeklyReportsProps) {
  const params = useParams()
  const projectId = params.id as string
  const { year: currentYear, week: currentWeek } = getCurrentYearWeek()

  const [year, setYear] = useState(currentYear)
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([currentWeek])
  const [copied, setCopied] = useState(false)

  // Build print URL with selected weeks
  const printUrl = `/project/${projectId}/reports/print?weeks=${selectedWeeks.join(',')}&year=${year}`

  const activityLevels = useMemo(() => {
    const levels = new Map<number, ActivityLevel>()
    for (let w = 1; w <= 52; w++) {
      levels.set(w, getWeekActivityLevel(stats, year, w))
    }
    return levels
  }, [stats, year])

  const handleReset = () => {
    setYear(currentYear)
    setSelectedWeeks([currentWeek])
  }

  const weekDataList = useMemo(() => {
    return selectedWeeks.map(w => filterDataByWeek(stats, year, w))
  }, [stats, year, selectedWeeks])

  const reportText = useMemo(() => {
    if (weekDataList.length === 0) return ''
    return generateReportText(weekDataList, projectName)
  }, [weekDataList, projectName])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="relative overflow-hidden rounded-xl border bg-card p-6">
        <WeekCalendar
          year={year}
          selectedWeeks={selectedWeeks}
          activityLevels={activityLevels}
          onWeekSelect={setSelectedWeeks}
          onYearChange={setYear}
        />

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          <div className="flex items-center gap-2">
            <Link
              href={printUrl}
              target="_blank"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                'border border-foreground/20 text-foreground hover:bg-muted',
                selectedWeeks.length === 0 && 'opacity-50 pointer-events-none'
              )}
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </Link>

            <button
              onClick={handleCopy}
              disabled={selectedWeeks.length === 0}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-foreground text-background hover:bg-foreground/90',
                selectedWeeks.length === 0 && 'opacity-50 cursor-not-allowed'
              )}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview Card */}
      <ReportPreviewCard weekData={weekDataList} />

      {/* Copy Text Preview (collapsed) */}
      {selectedWeeks.length > 0 && reportText && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            View copy text
          </summary>
          <div className="mt-3 relative overflow-hidden rounded-xl border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
              {reportText}
            </pre>
          </div>
        </details>
      )}
    </div>
  )
}
