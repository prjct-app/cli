import { NextResponse } from 'next/server'
import { getProjects } from '@/lib/projects'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

async function getGitUserName(): Promise<string> {
  try {
    const { stdout } = await execAsync('git config user.name')
    return stdout.trim() || 'Developer'
  } catch {
    return 'Developer'
  }
}

export async function GET() {
  try {
    const [projects, userName] = await Promise.all([
      getProjects(),
      getGitUserName()
    ])

    const stats = {
      userName,
      totalProjects: projects.length
    }

    return NextResponse.json({ success: true, data: stats })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
