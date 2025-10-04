/**
 * Simple animations with basic colors for better compatibility
 * Fallback when terminal doesn't support RGB colors
 */

const chalk = require('chalk')

const colors = {
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

const frames = {
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

const banners = {
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

async function animate(frames, duration = 100) {
  for (const frame of frames) {
    process.stdout.write('\r' + frame)
    await sleep(duration)
  }
  process.stdout.write('\r' + ' '.repeat(30) + '\r')
}

async function typeWriter(text, delay = 30) {
  for (let i = 0; i <= text.length; i++) {
    process.stdout.write('\r' + text.slice(0, i) + (i < text.length ? '▋' : ''))
    await sleep(delay)
  }
  process.stdout.write('\n')
}

async function progressBar(duration = 1000, label = 'Processing') {
  const steps = 20
  const stepDuration = duration / steps

  for (let i = 0; i <= steps; i++) {
    const percent = Math.round((i / steps) * 100)
    const filled = '▓'.repeat(i)
    const empty = '░'.repeat(steps - i)
    const bar = `${colors.dim(label)} [${colors.primary(filled)}${colors.dim(empty)}] ${colors.text(percent + '%')}`
    process.stdout.write('\r' + bar)
    await sleep(stepDuration)
  }
  process.stdout.write('\n')
}

async function sparkle(message) {
  const sparkles = ['✨', '⭐', '💫', '🌟']
  let output = ''

  for (let i = 0; i < 3; i++) {
    const spark = sparkles[Math.floor(Math.random() * sparkles.length)]
    output = `${spark} ${message} ${spark}`
    process.stdout.write('\r' + output)
    await sleep(200)
    process.stdout.write('\r' + ' '.repeat(output.length))
    await sleep(100)
  }

  console.log(output)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatShip(feature, count) {
  const banner = banners.ship
  const stats = `
${colors.text('Feature:')} ${colors.ship.bold(feature)}
${colors.text('Total shipped:')} ${colors.success.bold(count)}
${colors.text('Velocity:')} ${colors.celebrate('🔥 On fire!')}
  `

  return banner + stats
}

function formatFocus(task, timestamp) {
  const banner = banners.focus
  const info = `
${colors.text('Current task:')} ${colors.focus.bold(task)}
${colors.dim('Started:')} ${colors.subtext(timestamp)}
  `

  return banner + info
}

function formatSuccess(message) {
  return `${colors.success('✅')} ${colors.text(message)}`
}

function formatError(message) {
  return `${colors.error('❌')} ${colors.text(message)}`
}

function formatIdea(idea) {
  return `
${colors.idea('💡 Idea captured!')}
${colors.text('―'.repeat(30))}
${colors.subtext(idea)}
${colors.text('―'.repeat(30))}
${colors.dim('Added to your ideas backlog')}
  `
}

function formatCleanup(filesRemoved, tasksArchived, spaceFeed) {
  return `
${banners.cleanup}

${colors.text('🗑️  Files removed:')} ${colors.success.bold(filesRemoved)}
${colors.text('📦 Tasks archived:')} ${colors.success.bold(tasksArchived)}
${colors.text('💾 Space freed:')} ${colors.success.bold(spaceFeed + ' MB')}

${colors.celebrate('✨ Your project is clean and lean!')}
  `
}

function formatRecap(data) {
  const divider = colors.primary('━'.repeat(40))

  return `
${divider}
${colors.primary.bold('📊 PROJECT RECAP')}
${divider}

${colors.text('🎯 Current focus:')} ${data.currentTask || colors.dim('No active task')}
${colors.text('🚀 Shipped this week:')} ${colors.success.bold(data.shippedCount)}
${colors.text('📝 Queued tasks:')} ${colors.info.bold(data.queuedCount)}
${colors.text('💡 Ideas captured:')} ${colors.idea.bold(data.ideasCount)}

${divider}
${colors.dim('Keep shipping! 🚀')}
  `
}

module.exports = {
  colors,
  frames,
  banners,
  animate,
  typeWriter,
  progressBar,
  sparkle,
  formatShip,
  formatFocus,
  formatSuccess,
  formatError,
  formatIdea,
  formatCleanup,
  formatRecap,
}
