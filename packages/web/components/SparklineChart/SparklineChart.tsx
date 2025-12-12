'use client'

import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import type { SparklineChartProps } from './SparklineChart.types'

export function SparklineChart({
  data,
  color = 'currentColor',
  height = 32,
  showArea = true,
}: SparklineChartProps) {
  const chartData = data.map((value, index) => ({ index, value }))

  if (data.length === 0) {
    return <div style={{ height }} className="w-full" />
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={showArea ? 'url(#sparklineGradient)' : 'none'}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
