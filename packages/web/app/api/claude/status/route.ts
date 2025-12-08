import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check if claude is available
    const { stdout } = await execAsync('which claude && claude --version 2>/dev/null || echo "not found"')
    const lines = stdout.trim().split('\n')

    const available = !stdout.includes('not found') && lines.length > 0
    const version = available ? lines[lines.length - 1] : null

    return NextResponse.json({
      success: true,
      data: {
        available,
        version
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: true,
      data: {
        available: false,
        version: null
      }
    })
  }
}
