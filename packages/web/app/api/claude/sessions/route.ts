import { NextResponse } from 'next/server'
import { createClaudeSession, listSessions } from '@/lib/pty'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sessions = listSessions()
    return NextResponse.json({ success: true, data: sessions })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to list sessions' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, projectDir } = body

    if (!sessionId || !projectDir) {
      return NextResponse.json(
        { success: false, error: 'sessionId and projectDir are required' },
        { status: 400 }
      )
    }

    // Create PTY session
    createClaudeSession(sessionId, projectDir)

    return NextResponse.json({
      success: true,
      data: { sessionId, projectDir }
    })
  } catch (error) {
    console.error('Failed to create session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
