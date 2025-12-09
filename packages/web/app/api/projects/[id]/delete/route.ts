import { NextResponse } from 'next/server'
import { moveToTrash } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await moveToTrash(id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete project'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
