import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const SETTINGS_PATH = join(homedir(), '.prjct-cli', 'settings.json')

interface Settings {
  openRouterApiKey?: string
}

async function getSettings(): Promise<Settings> {
  try {
    const content = await fs.readFile(SETTINGS_PATH, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  const dir = join(homedir(), '.prjct-cli')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}

export async function GET() {
  try {
    const settings = await getSettings()
    // Mask the API key for security (only show last 4 chars)
    const maskedKey = settings.openRouterApiKey
      ? `sk-...${settings.openRouterApiKey.slice(-4)}`
      : null

    return NextResponse.json({
      success: true,
      data: {
        hasApiKey: !!settings.openRouterApiKey,
        maskedKey
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to read settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { openRouterApiKey } = body

    if (!openRouterApiKey || typeof openRouterApiKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 400 }
      )
    }

    const settings = await getSettings()
    settings.openRouterApiKey = openRouterApiKey
    await saveSettings(settings)

    return NextResponse.json({
      success: true,
      data: {
        hasApiKey: true,
        maskedKey: `sk-...${openRouterApiKey.slice(-4)}`
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const settings = await getSettings()
    delete settings.openRouterApiKey
    await saveSettings(settings)

    return NextResponse.json({
      success: true,
      data: { hasApiKey: false, maskedKey: null }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
