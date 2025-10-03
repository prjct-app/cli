/**
 * ASCII Graphics Utilities
 *
 * Creates visual dashboards and progress bars in terminal
 * using ASCII characters with Catppuccin Mocha color scheme.
 *
 * @version 0.6.0
 */

const chalk = require('chalk')

/**
 * Catppuccin Mocha Color Palette
 * https://github.com/catppuccin/catppuccin
 */
const CATPPUCCIN = {
  // Base colors
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',

  // Text colors
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',

  // Overlay colors
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
  surface2: '#585b70',
  surface1: '#45475a',
  surface0: '#313244',

  // Accent colors
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
}

/**
 * Semantic color mapping
 */
const COLORS = {
  // Status colors
  success: chalk.hex(CATPPUCCIN.green),
  warning: chalk.hex(CATPPUCCIN.yellow),
  error: chalk.hex(CATPPUCCIN.red),
  info: chalk.hex(CATPPUCCIN.blue),

  // UI colors
  primary: chalk.hex(CATPPUCCIN.mauve),
  secondary: chalk.hex(CATPPUCCIN.lavender),
  accent: chalk.hex(CATPPUCCIN.peach),
  muted: chalk.hex(CATPPUCCIN.overlay0),

  // Progress colors
  progress: chalk.hex(CATPPUCCIN.teal),
  complete: chalk.hex(CATPPUCCIN.green),
  pending: chalk.hex(CATPPUCCIN.overlay1),

  // Text colors
  bold: chalk.hex(CATPPUCCIN.text).bold,
  dim: chalk.hex(CATPPUCCIN.overlay0),
  highlight: chalk.hex(CATPPUCCIN.sapphire),
}

/**
 * Box Drawing Characters
 */
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  verticalRight: '├',
  verticalLeft: '┤',
  cross: '┼',
}

/**
 * Progress Bar Characters
 */
const PROGRESS = {
  filled: '█',
  empty: '░',
  partial: ['▏', '▎', '▍', '▌', '▋', '▊', '▉'],
}

/**
 * ASCII Graphics Generator
 */
class ASCIIGraphics {
  /**
   * Create a status dashboard
   */
  static createDashboard(data) {
    const width = 50
    const lines = []

    // Top border
    lines.push(
      COLORS.primary(
        `${BOX.topLeft}${BOX.horizontal} Project Status ${BOX.horizontal.repeat(width - 17)}${BOX.topRight}`,
      ),
    )

    // Sprint Progress
    const sprintProgress = data.sprintProgress || 0
    lines.push(
      `${COLORS.primary(BOX.vertical)} ${COLORS.bold('Sprint Progress')}    ${this.createProgressBar(sprintProgress, 10)} ${COLORS.highlight(Math.round(sprintProgress) + '%')} ${' '.repeat(width - 38)}${COLORS.primary(BOX.vertical)}`,
    )

    // Tasks Complete
    const tasksComplete = data.tasksComplete || 0
    const tasksTotal = data.tasksTotal || 0
    lines.push(
      `${COLORS.primary(BOX.vertical)} ${COLORS.bold('Tasks Complete')}     ${COLORS.complete(tasksComplete)}/${COLORS.info(tasksTotal)}${' '.repeat(width - 28)}${COLORS.primary(BOX.vertical)}`,
    )

    // Ideas in Backlog
    const ideasCount = data.ideasCount || 0
    lines.push(
      `${COLORS.primary(BOX.vertical)} ${COLORS.bold('Ideas in Backlog')}   ${COLORS.accent(ideasCount)}${' '.repeat(width - 28)}${COLORS.primary(BOX.vertical)}`,
    )

    // Days Since Ship
    const daysSinceShip = data.daysSinceShip || 0
    const shipColor =
      daysSinceShip > 7 ? COLORS.error : daysSinceShip > 3 ? COLORS.warning : COLORS.success
    lines.push(
      `${COLORS.primary(BOX.vertical)} ${COLORS.bold('Days Since Ship')}    ${shipColor(daysSinceShip)}${' '.repeat(width - 28)}${COLORS.primary(BOX.vertical)}`,
    )

    // Middle separator
    lines.push(
      COLORS.primary(
        `${BOX.verticalRight}${BOX.horizontal} Current Focus ${BOX.horizontal.repeat(width - 17)}${BOX.verticalLeft}`,
      ),
    )

    // Current Task
    const currentTask = data.currentTask || 'No active task'
    const taskTime = data.taskTime || ''
    lines.push(
      `${COLORS.primary(BOX.vertical)} ${COLORS.highlight('→')} ${COLORS.bold(this.truncate(currentTask, width - 5))}${' '.repeat(Math.max(0, width - currentTask.length - 4))}${COLORS.primary(BOX.vertical)}`,
    )

    if (taskTime) {
      lines.push(
        `${COLORS.primary(BOX.vertical)}   ${COLORS.dim(`Started: ${taskTime}`)}${' '.repeat(Math.max(0, width - taskTime.length - 13))}${COLORS.primary(BOX.vertical)}`,
      )
    }

    // Bottom border
    lines.push(COLORS.primary(`${BOX.bottomLeft}${BOX.horizontal.repeat(width)}${BOX.bottomRight}`))

    return lines.join('\n')
  }

  /**
   * Create a progress bar
   */
  static createProgressBar(percentage, width = 20) {
    const filled = Math.floor((percentage / 100) * width)
    const empty = width - filled

    return COLORS.progress(PROGRESS.filled.repeat(filled)) + COLORS.pending(PROGRESS.empty.repeat(empty))
  }

  /**
   * Create a horizontal bar chart
   */
  static createBarChart(data, maxWidth = 30) {
    const lines = []
    const maxValue = Math.max(...data.map((d) => d.value))

    for (const item of data) {
      const barWidth = Math.round((item.value / maxValue) * maxWidth)
      const bar = PROGRESS.filled.repeat(barWidth)
      const label = item.label.padEnd(15)
      const value = String(item.value).padStart(3)

      lines.push(`${label} ${COLORS.progress(bar)} ${COLORS.bold(value)}`)
    }

    return lines.join('\n')
  }

  /**
   * Create a vertical progress indicator
   */
  static createVerticalProgress(percentage, height = 10) {
    const filled = Math.floor((percentage / 100) * height)
    const empty = height - filled

    const lines = []
    lines.push(COLORS.primary('┌─┐'))

    for (let i = 0; i < empty; i++) {
      lines.push(`${COLORS.primary('│')}${COLORS.pending(PROGRESS.empty)}${COLORS.primary('│')}`)
    }

    for (let i = 0; i < filled; i++) {
      lines.push(`${COLORS.primary('│')}${COLORS.progress(PROGRESS.filled)}${COLORS.primary('│')}`)
    }

    lines.push(COLORS.primary('└─┘'))
    lines.push(` ${COLORS.highlight(percentage + '%')}`)

    return lines.join('\n')
  }

  /**
   * Create a timeline view
   */
  static createTimeline(events) {
    const lines = []

    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      const isLast = i === events.length - 1

      // Event marker
      const marker = event.completed ? COLORS.complete('●') : COLORS.pending('○')
      const connector = isLast ? ' ' : COLORS.muted('│')

      lines.push(`${marker} ${COLORS.bold(event.title)}`)

      if (event.description) {
        lines.push(`${connector} ${COLORS.dim(event.description)}`)
      }

      if (event.time) {
        lines.push(`${connector} ${COLORS.info(event.time)}`)
      }

      if (!isLast) {
        lines.push(connector)
      }
    }

    return lines.join('\n')
  }

  /**
   * Create a table
   */
  static createTable(headers, rows) {
    const columnWidths = headers.map((h, i) => {
      const maxRowWidth = Math.max(...rows.map((r) => String(r[i] || '').length))
      return Math.max(h.length, maxRowWidth) + 2
    })

    const lines = []

    // Top border
    const topBorder =
      BOX.topLeft +
      columnWidths.map((w) => BOX.horizontal.repeat(w)).join(BOX.cross) +
      BOX.topRight
    lines.push(topBorder)

    // Headers
    const headerRow =
      BOX.vertical +
      headers
        .map((h, i) => chalk.bold(h.padEnd(columnWidths[i])))
        .join(BOX.vertical) +
      BOX.vertical
    lines.push(headerRow)

    // Header separator
    const headerSep =
      BOX.verticalRight +
      columnWidths.map((w) => BOX.horizontal.repeat(w)).join(BOX.cross) +
      BOX.verticalLeft
    lines.push(headerSep)

    // Rows
    for (const row of rows) {
      const rowStr =
        BOX.vertical +
        row
          .map((cell, i) => String(cell || '').padEnd(columnWidths[i]))
          .join(BOX.vertical) +
        BOX.vertical
      lines.push(rowStr)
    }

    // Bottom border
    const bottomBorder =
      BOX.bottomLeft +
      columnWidths.map((w) => BOX.horizontal.repeat(w)).join(BOX.cross) +
      BOX.bottomRight
    lines.push(bottomBorder)

    return lines.join('\n')
  }

  /**
   * Create a sparkline (mini chart)
   */
  static createSparkline(values) {
    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min

    if (range === 0) {
      return chars[0].repeat(values.length)
    }

    return values
      .map((v) => {
        const normalized = (v - min) / range
        const index = Math.floor(normalized * (chars.length - 1))
        return chars[index]
      })
      .join('')
  }

  /**
   * Create a gauge/meter
   */
  static createGauge(value, max, label = '') {
    const percentage = (value / max) * 100
    const width = 30

    const filled = Math.floor((percentage / 100) * width)
    const empty = width - filled

    let color = COLORS.success
    if (percentage > 75) color = COLORS.error
    else if (percentage > 50) color = COLORS.warning

    const bar = color(PROGRESS.filled.repeat(filled)) + COLORS.pending(PROGRESS.empty.repeat(empty))

    const labelStr = label ? `${COLORS.bold(label.padEnd(15))} ` : ''
    const valueStr = `${COLORS.info(value)}/${COLORS.muted(max)} (${COLORS.highlight(Math.round(percentage) + '%')})`

    return `${labelStr}[${bar}] ${valueStr}`
  }

  /**
   * Create ASCII art number (for big stats)
   */
  static createBigNumber(num) {
    const digits = {
      0: ['███', '█ █', '█ █', '█ █', '███'],
      1: ['  █', '  █', '  █', '  █', '  █'],
      2: ['███', '  █', '███', '█  ', '███'],
      3: ['███', '  █', '███', '  █', '███'],
      4: ['█ █', '█ █', '███', '  █', '  █'],
      5: ['███', '█  ', '███', '  █', '███'],
      6: ['███', '█  ', '███', '█ █', '███'],
      7: ['███', '  █', '  █', '  █', '  █'],
      8: ['███', '█ █', '███', '█ █', '███'],
      9: ['███', '█ █', '███', '  █', '███'],
    }

    const numStr = String(num)
    const lines = ['', '', '', '', '']

    for (const char of numStr) {
      if (digits[char]) {
        for (let i = 0; i < 5; i++) {
          lines[i] += digits[char][i] + '  '
        }
      }
    }

    return lines.join('\n')
  }

  /**
   * Truncate text to fit width
   */
  static truncate(text, maxWidth) {
    if (text.length <= maxWidth) {
      return text
    }
    return text.substring(0, maxWidth - 3) + '...'
  }

  /**
   * Create a loading spinner frame
   */
  static getSpinnerFrame(index) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    return frames[index % frames.length]
  }

  /**
   * Create a status indicator
   */
  static statusIndicator(status) {
    const indicators = {
      success: COLORS.success('✓'),
      error: COLORS.error('✗'),
      warning: COLORS.warning('⚠'),
      info: COLORS.info('ℹ'),
      pending: COLORS.pending('○'),
      active: COLORS.highlight('●'),
    }

    return indicators[status] || indicators.info
  }

  /**
   * Create a divider line
   */
  static divider(width = 50, char = '─') {
    return COLORS.muted(char.repeat(width))
  }
}

module.exports = ASCIIGraphics
module.exports.COLORS = COLORS
module.exports.CATPPUCCIN = CATPPUCCIN
