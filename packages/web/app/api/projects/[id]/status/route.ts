import { NextResponse } from 'next/server'
import { getProjectStatus } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const status = await getProjectStatus(id)
    return NextResponse.json({ success: true, data: status })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
