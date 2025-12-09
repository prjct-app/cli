import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { getProjects } from '@/lib/projects'
import { lookup } from 'mime-types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projects = await getProjects()
    const project = projects.find(p => p.id === id)

    if (!project?.iconPath) {
      return new NextResponse(null, { status: 404 })
    }

    const file = await fs.readFile(project.iconPath)
    const mimeType = lookup(project.iconPath) || 'application/octet-stream'

    return new NextResponse(file, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400'
      }
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
