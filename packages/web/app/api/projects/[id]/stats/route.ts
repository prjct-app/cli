import { NextRequest, NextResponse } from 'next/server'
import { loadUnifiedJsonData, hasJsonState } from '@/lib/json-loader'
import { getProjectStats, getRawProjectFiles } from '@/lib/parse-prjct-files'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'Project ID required' },
      { status: 400 }
    )
  }

  try {
    // Check if JSON files exist (new format)
    const hasJson = await hasJsonState(projectId)

    if (hasJson) {
      // Use new JSON loader (fast path)
      const jsonData = await loadUnifiedJsonData(projectId)

      // Convert to stats-compatible format
      return NextResponse.json({
        success: true,
        version: 'v2',
        data: {
          currentTask: jsonData.state?.currentTask || null,
          queue: jsonData.state?.queue || [],
          stats: jsonData.state?.stats || { tasksToday: 0, tasksThisWeek: 0, streak: 0, velocity: '0', avgDuration: '0' },
          agents: jsonData.agents,
          ideas: jsonData.ideas,
          roadmap: jsonData.roadmap,
          shipped: jsonData.shipped,
          analysis: jsonData.analysis,
          outcomes: jsonData.outcomes,
          insights: jsonData.insights
        }
      })
    }

    // Fallback to legacy markdown parsing
    const [stats, raw] = await Promise.all([
      getProjectStats(projectId),
      getRawProjectFiles(projectId)
    ])

    return NextResponse.json({
      success: true,
      version: 'v1-legacy',
      data: stats,
      raw
    })
  } catch (error) {
    console.error('[API] Error getting project stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get project stats' },
      { status: 500 }
    )
  }
}
