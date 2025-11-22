---
allowed-tools: [Read]
description: 'Progress metrics'
---

# /p:progress

## Flow
1. Parse period (day/week/month, default: week)
2. Read sessions → filter by date range
3. Aggregate: ships, velocity, trends

## Response
`📈 {period} | 🚀 {N} shipped | ⚡ {velocity}/day | Trend: {↗%}`
