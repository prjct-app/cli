import { NextResponse } from 'next/server'
import { migrateProject, getProjectsToMigrate } from '@/lib/services/migration.server'

export async function GET() {
  try {
    const projects = await getProjectsToMigrate()
    return NextResponse.json({
      success: true,
      data: { projects }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to list projects' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const result = await migrateProject(projectId)

    return NextResponse.json({
      success: result.success,
      data: result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed'
      },
      { status: 500 }
    )
  }
}
