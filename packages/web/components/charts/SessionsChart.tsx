'use client'

import * as React from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const chartConfig = {
  views: {
    label: 'Activity',
  },
  tasks: {
    label: 'Tasks Completed',
    color: 'var(--chart-1)',
  },
  ships: {
    label: 'Features Shipped',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

interface ChartDataPoint {
  date: string
  tasks: number
  ships: number
}

interface SessionsHistoryResponse {
  success: boolean
  data: {
    chartData: ChartDataPoint[]
    totals: {
      tasks: number
      ships: number
    }
    dateRange: {
      start: string
      end: string
    }
  }
}

export function SessionsChart() {
  const [activeChart, setActiveChart] =
    React.useState<'tasks' | 'ships'>('tasks')

  const { data: response, isLoading } = useQuery<SessionsHistoryResponse>({
    queryKey: ['sessions-history'],
    queryFn: async () => {
      const res = await fetch('/api/sessions/history')
      return res.json()
    },
  })

  const chartData = response?.data?.chartData || []
  const totals = response?.data?.totals || { tasks: 0, ships: 0 }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-4 py-3 sm:px-5 sm:py-4">
            <CardTitle>Session Activity</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:p-4">
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-4 py-3 sm:px-5 sm:py-4">
          <CardTitle>Session Activity</CardTitle>
          <CardDescription>
            Last 90 days across all projects
          </CardDescription>
        </div>
        <div className="flex">
          {(['tasks', 'ships'] as const).map((key) => {
            return (
              <button
                key={key}
                data-active={activeChart === key}
                className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-4 py-3 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-6 sm:py-4"
                onClick={() => setActiveChart(key)}
              >
                <span className="text-xs text-muted-foreground">
                  {chartConfig[key].label}
                </span>
                <span className="text-lg font-bold leading-none sm:text-3xl">
                  {totals[key].toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-4">
        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No session data yet
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => {
                  const date = new Date(value)
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[150px]"
                    nameKey="views"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    }}
                  />
                }
              />
              <Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
