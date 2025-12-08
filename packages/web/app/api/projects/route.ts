import { NextResponse } from 'next/server'
import { getProjects } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const projects = await getProjects()
    return NextResponse.json({ success: true, data: projects })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to list projects' },
      { status: 500 }
    )
  }
}
