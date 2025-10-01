/**
 * Cool animations and visual effects for prjct
 * Using Catppuccin color palette
 */

const chalk = require('chalk');


if (!chalk.supportsColor) {
  chalk.level = 3; // Full RGB color support
  process.env.FORCE_COLOR = '3';
}


const catppuccin = {

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


  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
  surface2: '#585b70',
  surface1: '#45475a',
  surface0: '#313244',
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
};


const colors = {
  success: chalk.hex(catppuccin.green),
  error: chalk.hex(catppuccin.red),
  warning: chalk.hex(catppuccin.yellow),
  info: chalk.hex(catppuccin.blue),
  ship: chalk.hex(catppuccin.sapphire),
  celebrate: chalk.hex(catppuccin.pink),
  focus: chalk.hex(catppuccin.teal),
  idea: chalk.hex(catppuccin.yellow),
  progress: chalk.hex(catppuccin.lavender),
  task: chalk.hex(catppuccin.mauve),
  primary: chalk.hex(catppuccin.mauve),
  secondary: chalk.hex(catppuccin.sky),
  text: chalk.hex(catppuccin.text),
  subtext: chalk.hex(catppuccin.subtext1),
  dim: chalk.hex(catppuccin.overlay1),
};


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
  loading: [
    '⠋',
    '⠙',
    '⠹',
    '⠸',
    '⠼',
    '⠴',
    '⠦',
    '⠧',
    '⠇',
    '⠏',
  ],
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
  celebration: [
    '🎉',
    '🎊',
    '✨',
    '🌟',
    '⭐',
    '💫',
    '🎆',
    '🎇',
  ],
};


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
};


async function animate(frames, duration = 100) {
  for (const frame of frames) {
    process.stdout.write('\r' + frame);
    await sleep(duration);
  }
  process.stdout.write('\r' + ' '.repeat(30) + '\r');
}

async function typeWriter(text, delay = 30) {
  for (let i = 0; i <= text.length; i++) {
    process.stdout.write('\r' + text.slice(0, i) + (i < text.length ? '▋' : ''));
    await sleep(delay);
  }
  process.stdout.write('\n');
}

async function progressBar(duration = 1000, label = 'Processing') {
  const steps = 20;
  const stepDuration = duration / steps;

  for (let i = 0; i <= steps; i++) {
    const percent = Math.round((i / steps) * 100);
    const filled = '▓'.repeat(i);
    const empty = '░'.repeat(steps - i);
    const bar = `${colors.dim(label)} [${colors.primary(filled)}${colors.dim(empty)}] ${colors.text(percent + '%')}`;
    process.stdout.write('\r' + bar);
    await sleep(stepDuration);
  }
  process.stdout.write('\n');
}

async function sparkle(message) {
  const sparkles = ['✨', '⭐', '💫', '🌟'];
  let output = '';

  for (let i = 0; i < 3; i++) {
    const spark = sparkles[Math.floor(Math.random() * sparkles.length)];
    output = `${spark} ${message} ${spark}`;
    process.stdout.write('\r' + output);
    await sleep(200);
    process.stdout.write('\r' + ' '.repeat(output.length));
    await sleep(100);
  }

  console.log(output);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function formatShip(feature, count) {
  const banner = banners.ship;
  const stats = `
${colors.text('Feature:')} ${colors.ship.bold(feature)}
${colors.text('Total shipped:')} ${colors.success.bold(count)}
${colors.text('Velocity:')} ${colors.celebrate('🔥 On fire!')}
  `;

  return banner + stats;
}

function formatFocus(task, timestamp) {
  const banner = banners.focus;
  const info = `
${colors.text('Current task:')} ${colors.focus.bold(task)}
${colors.dim('Started:')} ${colors.subtext(timestamp)}
  `;

  return banner + info;
}

function formatSuccess(message) {
  return `${colors.success('✅')} ${colors.text(message)}`;
}

function formatError(message) {
  return `${colors.error('❌')} ${colors.text(message)}`;
}

function formatIdea(idea) {
  return `
${colors.idea('💡 Idea captured!')}
${colors.text('―'.repeat(30))}
${colors.subtext(idea)}
${colors.text('―'.repeat(30))}
${colors.dim('Added to your ideas backlog')}
  `;
}

function formatCleanup(filesRemoved, tasksArchived, spaceFeed) {
  return `
${banners.cleanup}

${colors.text('🗑️  Files removed:')} ${colors.success.bold(filesRemoved)}
${colors.text('📦 Tasks archived:')} ${colors.success.bold(tasksArchived)}
${colors.text('💾 Space freed:')} ${colors.success.bold(spaceFeed + ' MB')}

${colors.celebrate('✨ Your project is clean and lean!')}
  `;
}

function formatRecap(data) {
  const divider = colors.primary('━'.repeat(40));

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
  `;
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
  catppuccin,
};