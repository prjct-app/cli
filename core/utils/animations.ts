/**
 * Simple animations with basic colors for better compatibility
 * Fallback when terminal doesn't support RGB colors
 */

import chalk from 'chalk'

type ChalkFunction = typeof chalk.green

interface Colors {
  success: ChalkFunction
  error: ChalkFunction
  warning: ChalkFunction
  info: ChalkFunction
  ship: ChalkFunction
  celebrate: ChalkFunction
  focus: ChalkFunction
  idea: ChalkFunction
  progress: ChalkFunction
  task: ChalkFunction
  primary: ChalkFunction
  secondary: ChalkFunction
  text: ChalkFunction
  subtext: ChalkFunction
  dim: ChalkFunction
}

interface Frames {
  rocket: string[]
  sparkles: string[]
  loading: string[]
  progress: string[]
  celebration: string[]
}

interface Banners {
  ship: string
  success: string
  error: string
  welcome: string
  cleanup: string
  focus: string
}

interface RecapData {
  currentTask?: string | null
  shippedCount: number
  queuedCount: number
  ideasCount: number
}

export const colors: Colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  ship: chalk.cyan,
  celebrate: chalk.magenta,
  focus: chalk.green.bold,
  idea: chalk.yellow,
  progress: chalk.blue,
  task: chalk.cyan,
  primary: chalk.magenta,
  secondary: chalk.cyan,
  text: chalk.white,
  subtext: chalk.gray,
  dim: chalk.gray,
}

export const frames: Frames = {
  rocket: [
    '     🚀     ',
    '    🚀      ',
    '   🚀       ',
    '  🚀        ',
    ' 🚀         ',
    '🚀          ',
  ],
  sparkles: [
    '✨ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ✨',
    '･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ✨ ･',
    '｡ﾟ☆: *.☽ .* :☆ﾟ. ✨ ･ ｡ﾟ',
    '☆: *.☽ .* :☆ﾟ. ✨ ･ ｡ﾟ☆:',
  ],
  loading: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  progress: [
    '[          ]',
    '[▓         ]',
    '[▓▓        ]',
    '[▓▓▓       ]',
    '[▓▓▓▓      ]',
    '[▓▓▓▓▓     ]',
    '[▓▓▓▓▓▓    ]',
    '[▓▓▓▓▓▓▓   ]',
    '[▓▓▓▓▓▓▓▓  ]',
    '[▓▓▓▓▓▓▓▓▓ ]',
    '[▓▓▓▓▓▓▓▓▓▓]',
  ],
  celebration: ['🎉', '🎊', '✨', '🌟', '⭐', '💫', '🎆', '🎇'],
}

export const banners: Banners = {
  ship: `
╔════════════════════════════════════════════╗
║  🚀 ${colors.ship.bold('S H I P P E D !')}  🚀            ║
╚════════════════════════════════════════════╝`,

  success: `
✨ ${colors.success.bold('Success!')} ✨`,

  error: `
❌ ${colors.error.bold('Error')} ❌`,

  welcome: `
${colors.primary('╔══════════════════════════════════════════════════╗')}
${colors.primary('║')}  ${colors.text.bold('🚀 prjct')}${colors.primary('/')}${colors.secondary.bold('cli')}                              ${colors.primary('║')}
${colors.primary('║')}  ${colors.dim('Ship faster with zero friction')}              ${colors.primary('║')}
${colors.primary('╚══════════════════════════════════════════════════╝')}`,

  cleanup: `
${colors.focus('🧹 ✨ Cleanup Magic ✨ 🧹')}`,

  focus: `
${colors.focus('━━━━━━━━━━━━━━━━━━━━━━━')}
${colors.focus.bold('   🎯 FOCUS MODE 🎯   ')}
${colors.focus('━━━━━━━━━━━━━━━━━━━━━━━')}`,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function animate(frameList: string[], duration = 100): Promise<void> {
  for (const frame of frameList) {
    process.stdout.write(`\r${frame}`)
    await sleep(duration)
  }
  process.stdout.write(`\r${' '.repeat(30)}\r`)
}

export async function typeWriter(text: string, delay = 30): Promise<void> {
  for (let i = 0; i <= text.length; i++) {
    process.stdout.write(`\r${text.slice(0, i)}${i < text.length ? '▋' : ''}`)
    await sleep(delay)
  }
  process.stdout.write('\n')
}

export async function progressBar(duration = 1000, label = 'Processing'): Promise<void> {
  const steps = 20
  const stepDuration = duration / steps

  for (let i = 0; i <= steps; i++) {
    const percent = Math.round((i / steps) * 100)
    const filled = '▓'.repeat(i)
    const empty = '░'.repeat(steps - i)
    const bar = `${colors.dim(label)} [${colors.primary(filled)}${colors.dim(empty)}] ${colors.text(`${percent}%`)}`
    process.stdout.write(`\r${bar}`)
    await sleep(stepDuration)
  }
  process.stdout.write('\n')
}

export async function sparkle(message: string): Promise<void> {
  const sparkles = ['✨', '⭐', '💫', '🌟']
  let output = ''

  for (let i = 0; i < 3; i++) {
    const spark = sparkles[Math.floor(Math.random() * sparkles.length)]
    output = `${spark} ${message} ${spark}`
    process.stdout.write(`\r${output}`)
    await sleep(200)
    process.stdout.write(`\r${' '.repeat(output.length)}`)
    await sleep(100)
  }

  console.log(output)
}

export function formatShip(feature: string, count: number): string {
  const banner = banners.ship
  const stats = `
${colors.text('Feature:')} ${colors.ship.bold(feature)}
${colors.text('Total shipped:')} ${colors.success.bold(String(count))}
${colors.text('Velocity:')} ${colors.celebrate('🔥 On fire!')}
  `

  return banner + stats
}

export function formatFocus(task: string, timestamp: string): string {
  const banner = banners.focus
  const info = `
${colors.text('Current task:')} ${colors.focus.bold(task)}
${colors.dim('Started:')} ${colors.subtext(timestamp)}
  `

  return banner + info
}

export function formatSuccess(message: string): string {
  return `${colors.success('✅')} ${colors.text(message)}`
}

export function formatError(message: string): string {
  return `${colors.error('❌')} ${colors.text(message)}`
}

export function formatIdea(idea: string): string {
  return `
${colors.idea('💡 Idea captured!')}
${colors.text('―'.repeat(30))}
${colors.subtext(idea)}
${colors.text('―'.repeat(30))}
${colors.dim('Added to your ideas backlog')}
  `
}

export function formatCleanup(
  filesRemoved: number,
  tasksArchived: number,
  spaceFeed: number
): string {
  return `
${banners.cleanup}

${colors.text('🗑️  Files removed:')} ${colors.success.bold(String(filesRemoved))}
${colors.text('📦 Tasks archived:')} ${colors.success.bold(String(tasksArchived))}
${colors.text('💾 Space freed:')} ${colors.success.bold(`${spaceFeed} MB`)}

${colors.celebrate('✨ Your project is clean and lean!')}
  `
}

export function formatRecap(data: RecapData): string {
  const divider = colors.primary('━'.repeat(40))

  return `
${divider}
${colors.primary.bold('📊 PROJECT RECAP')}
${divider}

${colors.text('🎯 Current focus:')} ${data.currentTask || colors.dim('No active task')}
${colors.text('🚀 Shipped this week:')} ${colors.success.bold(String(data.shippedCount))}
${colors.text('📝 Queued tasks:')} ${colors.info.bold(String(data.queuedCount))}
${colors.text('💡 Ideas captured:')} ${colors.idea.bold(String(data.ideasCount))}

${divider}
${colors.dim('Keep shipping! 🚀')}
  `
}
