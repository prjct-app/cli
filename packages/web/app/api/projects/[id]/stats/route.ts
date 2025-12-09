import { NextRequest, NextResponse } from 'next/server'
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
    // Get both parsed stats AND raw files
    const [stats, raw] = await Promise.all([
      getProjectStats(projectId),
      getRawProjectFiles(projectId)
    ])

    return NextResponse.json({
      success: true,
      data: stats,
      raw  // Raw markdown files for direct rendering
    })
  } catch (error) {
    console.error('[API] Error getting project stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get project stats' },
      { status: 500 }
    )
  }
}
