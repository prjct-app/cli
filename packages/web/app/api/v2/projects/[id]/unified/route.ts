import { NextRequest, NextResponse } from 'next/server'
import { loadUnifiedJsonData } from '@/lib/json-loader'

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
    // Load all JSON data directly
    const jsonData = await loadUnifiedJsonData(projectId)

    if (!jsonData.hasJsonData) {
      // No JSON files exist yet
      return NextResponse.json({
        success: true,
        version: 'v2-empty',
        state: null,
        project: null,
        agents: [],
        ideas: [],
        roadmap: [],
        shipped: [],
        analysis: null,
        outcomes: [],
        insights: {
          healthScore: 0,
          estimateAccuracy: 0,
          topBlockers: [],
          patternsDetected: [],
          recommendations: ['Run /p:sync to initialize project data'],
        },
        hasJsonData: false,
      })
    }

    return NextResponse.json({
      success: true,
      version: 'v2',
      ...jsonData,
    })
  } catch (error) {
    console.error('[API v2] Error getting unified project data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get project data' },
      { status: 500 }
    )
  }
}
