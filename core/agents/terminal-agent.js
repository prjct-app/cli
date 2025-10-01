/**
 * Terminal Agent Adapter
 * Implements prjct commands for terminal/CLI environment
 */

const fs = require('fs').promises
const path = require('path')


let chalk
let animations

try {
  chalk = require('chalk')


  if (chalk.supportsColor && chalk.supportsColor.has16m) {

    animations = require('../animations')
  } else {

    animations = require('../animations-simple')
  }
} catch (e) {

  chalk = {
    green: (str) => str,
    blue: (str) => str,
    yellow: (str) => str,
    red: (str) => str,
    cyan: (str) => str,
    magenta: (str) => str,
    bold: (str) => str,
    dim: (str) => str,
  }
  animations = null
}

class TerminalAgent {
  constructor() {
    this.name = 'Terminal/CLI'
    this.type = 'terminal'
  }

  /**
   * Format response for terminal with ANSI colors and emojis
   */
  formatResponse(message, type = 'info') {

    if (animations) {

      if (type === 'success' && message.includes('Cleanup complete')) {

        const filesMatch = message.match(/Files removed: (\d+)/)
        const tasksMatch = message.match(/Tasks archived: (\d+)/)
        const spaceMatch = message.match(/Space freed: ([\d.]+)/)

        if (filesMatch && tasksMatch && spaceMatch) {
          return animations.formatCleanup(
            parseInt(filesMatch[1]),
            parseInt(tasksMatch[1]),
            parseFloat(spaceMatch[1])
          )
        }
      }

      switch(type) {
        case 'success':
          return animations.formatSuccess(message)
        case 'error':
          return animations.formatError(message)
        case 'ship':
          return animations.formatShip(message, 1)
        case 'focus':
          return animations.formatFocus(message, new Date().toISOString())
        case 'idea':
          return animations.formatIdea(message)
        default:

          const emojis = {
            warning: '⚠️',
            info: 'ℹ️',
            celebrate: '🎉',
            progress: '📊',
            task: '📝',
          }
          const emoji = emojis[type] || '💬'
          return `${emoji} ${animations.colors.text(message)}`
      }
    }


    const emojis = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      celebrate: '🎉',
      ship: '🚀',
      focus: '🎯',
      idea: '💡',
      progress: '📊',
      task: '📝',
    }

    const colors = {
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue,
      celebrate: chalk.magenta,
      ship: chalk.cyan,
      focus: chalk.green,
      idea: chalk.yellow,
      progress: chalk.blue,
      task: chalk.cyan,
    }

    const emoji = emojis[type] || emojis.info
    const color = colors[type] || colors.info


    return `${emoji} ${color(message)}`
  }

  /**
   * Read file using native fs
   */
  async readFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`)
    }
  }

  /**
   * Write file using native fs
   */
  async writeFile(filePath, content) {
    try {
      await fs.writeFile(filePath, content, 'utf8')
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`)
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath) {
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`)
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`)
    }
  }

  /**
   * Get current timestamp in ISO format
   */
  getTimestamp() {
    return new Date().toISOString()
  }

  /**
   * Format task list with colors
   */
  formatTaskList(tasks) {
    if (!tasks || tasks.length === 0) {
      return this.formatResponse('No tasks in queue', 'info')
    }


    if (animations) {
      let output = animations.colors.primary.bold('\n📋 Task Queue\n')
      output += animations.colors.dim('─'.repeat(40)) + '\n'

      tasks.forEach((task, index) => {
        output += animations.colors.task(`  ${index + 1}.`) + ` ${animations.colors.text(task)}\n`
      })

      return output
    }


    let output = chalk.bold('\n📋 Task Queue\n')
    output += chalk.dim('─'.repeat(40)) + '\n'

    tasks.forEach((task, index) => {
      output += chalk.cyan(`  ${index + 1}.`) + ` ${task}\n`
    })

    return output
  }

  /**
   * Format recap with colored output
   */
  formatRecap(data) {

    if (animations) {
      return animations.formatRecap(data)
    }


    let output = '\n' + chalk.bold('📊 Project Recap\n')
    output += chalk.dim('─'.repeat(40)) + '\n\n'

    output += `${chalk.green('🎯 Current Task:')} ${data.currentTask || chalk.dim('None')}\n`
    output += `${chalk.cyan('🚀 Shipped Features:')} ${chalk.bold(data.shippedCount)} total\n`
    output += `${chalk.blue('📝 Queued Tasks:')} ${data.queuedCount}\n`
    output += `${chalk.yellow('💡 Ideas Captured:')} ${data.ideasCount}\n`

    if (data.recentActivity) {
      output += '\n' + chalk.bold('Recent Activity:\n')
      output += data.recentActivity
    }

    output += '\n' + chalk.dim('─'.repeat(40))
    output += '\n' + chalk.green('💪 Keep shipping! Every feature counts!')

    return output
  }

  /**
   * Format progress report
   */
  formatProgress(data) {

    if (animations) {
      const trend =
        data.velocity > data.previousVelocity
          ? '📈'
          : data.velocity < data.previousVelocity
            ? '📉'
            : '➡️'

      const divider = animations.colors.primary('━'.repeat(40))

      let output = '\n' + divider + '\n'
      output += animations.colors.primary.bold(`📊 PROGRESS REPORT - ${data.period.toUpperCase()}\n`)
      output += divider + '\n\n'

      output += animations.colors.text('Features Shipped: ') + animations.colors.success.bold(data.count) + '\n'
      output += animations.colors.text('Velocity: ') + animations.colors.info.bold(data.velocity.toFixed(1) + ' features/day') + ' ' + trend + '\n'

      if (data.recentFeatures) {
        output += '\n' + animations.colors.primary.bold('Recent Wins:\n')
        output += data.recentFeatures
      }

      output += '\n' + divider
      output += '\n' + animations.colors.celebrate(data.motivationalMessage || '🚀 Keep shipping!')

      return output
    }


    const trend =
      data.velocity > data.previousVelocity
        ? '📈'
        : data.velocity < data.previousVelocity
          ? '📉'
          : '➡️'

    let output = '\n' + chalk.bold(`📊 Progress Report (${data.period})\n`)
    output += chalk.dim('─'.repeat(40)) + '\n\n'

    output += `${chalk.green('Features Shipped:')} ${chalk.bold(data.count)}\n`
    output += `${chalk.blue('Velocity:')} ${data.velocity.toFixed(1)} features/day ${trend}\n`

    if (data.recentFeatures) {
      output += '\n' + chalk.bold('Recent Wins:\n')
      output += data.recentFeatures
    }

    output += '\n' + chalk.dim('─'.repeat(40))
    output += '\n' + chalk.green(data.motivationalMessage)

    return output
  }

  /**
   * Get help content based on issue type
   */
  getHelpContent(issue) {

    if (animations) {
      const c = animations.colors
      const helps = {
        debugging: `
${c.error.bold('🔍 Debugging Strategy:')}
  ${c.secondary('1.')} ${c.text.bold('Isolate')} - Comment out code until error disappears
  ${c.secondary('2.')} ${c.text.bold('Log')} - Add console.log at key points
  ${c.secondary('3.')} ${c.text.bold('Simplify')} - Create minimal reproduction
  ${c.secondary('4.')} ${c.text.bold('Research')} - Search for exact error message
  ${c.secondary('5.')} ${c.text.bold('Break')} - Take a walk, fresh perspective helps!
              `,
        design: `
${c.primary.bold('🎨 Design Approach:')}
  ${c.secondary('1.')} ${c.text.bold('Start Simple')} - Basic version first
  ${c.secondary('2.')} ${c.text.bold('User First')} - What problem does this solve?
  ${c.secondary('3.')} ${c.text.bold('Iterate')} - Ship v1, improve based on feedback
  ${c.secondary('4.')} ${c.text.bold('Patterns')} - Look for similar solutions
  ${c.secondary('5.')} ${c.text.bold('Validate')} - Show mockup before building
              `,
        performance: `
${c.warning.bold('⚡ Performance Strategy:')}
  ${c.secondary('1.')} ${c.text.bold('Measure First')} - Profile before optimizing
  ${c.secondary('2.')} ${c.text.bold('Biggest Wins')} - Focus on slowest parts
  ${c.secondary('3.')} ${c.text.bold('Cache')} - Store expensive computations
  ${c.secondary('4.')} ${c.text.bold('Lazy Load')} - Defer non-critical work
  ${c.secondary('5.')} ${c.text.bold('Monitor')} - Track improvements
              `,
        default: `
${c.idea.bold('💡 General Strategy:')}
  ${c.secondary('1.')} ${c.text.bold('Break It Down')} - Divide into smaller tasks
  ${c.secondary('2.')} ${c.text.bold('Start Small')} - Implement simplest part first
  ${c.secondary('3.')} ${c.text.bold('Test Often')} - Verify each step works
  ${c.secondary('4.')} ${c.text.bold('Document')} - Write down what you learn
  ${c.secondary('5.')} ${c.text.bold('Ship It')} - Perfect is the enemy of done
              `,
      }

      const helpType =
        Object.keys(helps).find((key) => issue.toLowerCase().includes(key)) || 'default'

      return helps[helpType]
    }


    const helps = {
      debugging: `
${chalk.bold('🔍 Debugging Strategy:')}
  ${chalk.cyan('1.')} ${chalk.bold('Isolate')} - Comment out code until error disappears
  ${chalk.cyan('2.')} ${chalk.bold('Log')} - Add console.log at key points
  ${chalk.cyan('3.')} ${chalk.bold('Simplify')} - Create minimal reproduction
  ${chalk.cyan('4.')} ${chalk.bold('Research')} - Search for exact error message
  ${chalk.cyan('5.')} ${chalk.bold('Break')} - Take a walk, fresh perspective helps!
            `,
      design: `
${chalk.bold('🎨 Design Approach:')}
  ${chalk.cyan('1.')} ${chalk.bold('Start Simple')} - Basic version first
  ${chalk.cyan('2.')} ${chalk.bold('User First')} - What problem does this solve?
  ${chalk.cyan('3.')} ${chalk.bold('Iterate')} - Ship v1, improve based on feedback
  ${chalk.cyan('4.')} ${chalk.bold('Patterns')} - Look for similar solutions
  ${chalk.cyan('5.')} ${chalk.bold('Validate')} - Show mockup before building
            `,
      performance: `
${chalk.bold('⚡ Performance Strategy:')}
  ${chalk.cyan('1.')} ${chalk.bold('Measure First')} - Profile before optimizing
  ${chalk.cyan('2.')} ${chalk.bold('Biggest Wins')} - Focus on slowest parts
  ${chalk.cyan('3.')} ${chalk.bold('Cache')} - Store expensive computations
  ${chalk.cyan('4.')} ${chalk.bold('Lazy Load')} - Defer non-critical work
  ${chalk.cyan('5.')} ${chalk.bold('Monitor')} - Track improvements
            `,
      default: `
${chalk.bold('💡 General Strategy:')}
  ${chalk.cyan('1.')} ${chalk.bold('Break It Down')} - Divide into smaller tasks
  ${chalk.cyan('2.')} ${chalk.bold('Start Small')} - Implement simplest part first
  ${chalk.cyan('3.')} ${chalk.bold('Test Often')} - Verify each step works
  ${chalk.cyan('4.')} ${chalk.bold('Document')} - Write down what you learn
  ${chalk.cyan('5.')} ${chalk.bold('Ship It')} - Perfect is the enemy of done
            `,
    }

    const helpType =
      Object.keys(helps).find((key) => issue.toLowerCase().includes(key)) || 'default'

    return helps[helpType]
  }

  /**
   * Suggest next action based on context
   */
  suggestNextAction(context) {

    if (animations) {
      const c = animations.colors
      const suggestions = {
        taskCompleted:
          c.dim('→ Ready for the next challenge? Use ') +
          c.success('prjct next') +
          c.dim(' to see your queue!'),
        featureShipped:
          c.dim('→ Awesome! Take a moment to celebrate, then ') +
          c.ship('prjct now') +
          c.dim(' for next focus!'),
        ideaCaptured:
          c.dim('→ Great idea! Use ') +
          c.idea('prjct now') +
          c.dim(' to start working on it!'),
        initialized: c.dim('→ All set! Start with ') + c.primary('prjct now "your first task"'),
        stuck:
          c.dim('→ You got this! Break it down with ') +
          c.focus('prjct idea') +
          c.dim(' for each step'),
      }

      return suggestions[context] || c.dim('→ What would you like to work on next?')
    }


    const suggestions = {
      taskCompleted:
        chalk.dim('→ Ready for the next challenge? Use ') +
        chalk.green('prjct next') +
        chalk.dim(' to see your queue!'),
      featureShipped:
        chalk.dim('→ Awesome! Take a moment to celebrate, then ') +
        chalk.green('prjct now') +
        chalk.dim(' for next focus!'),
      ideaCaptured:
        chalk.dim('→ Great idea! Use ') +
        chalk.green('prjct now') +
        chalk.dim(' to start working on it!'),
      initialized: chalk.dim('→ All set! Start with ') + chalk.green('prjct now "your first task"'),
      stuck:
        chalk.dim('→ You got this! Break it down with ') +
        chalk.green('prjct idea') +
        chalk.dim(' for each step'),
    }

    return suggestions[context] || chalk.dim('→ What would you like to work on next?')
  }

  /**
   * Clear terminal screen (for better UX)
   */
  clearScreen() {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1Bc')
    }
  }

  /**
   * Show progress spinner for long operations
   */
  showSpinner(message) {
    if (!process.stdout.isTTY) return


    const frames = animations?.frames?.loading || ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let i = 0

    const formattedMessage = animations
      ? animations.colors.text(message)
      : message

    const interval = setInterval(() => {
      const frame = animations?.colors?.primary(frames[i]) || frames[i]
      process.stdout.write(`\r${frame} ${formattedMessage}`)
      i = (i + 1) % frames.length
    }, 80)

    return () => {
      clearInterval(interval)
      process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r')
    }
  }
}

module.exports = TerminalAgent
