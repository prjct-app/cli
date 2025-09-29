const fs = require('fs').promises;
const path = require('path');

// Try to load chalk, but work without it if not available
let chalk;
try {
    chalk = require('chalk');
} catch (e) {
    // Fallback if chalk is not available
    chalk = {
        green: (str) => str,
        blue: (str) => str,
        yellow: (str) => str,
        red: (str) => str
    };
}

class PrjctCommands {
    constructor() {
        this.prjctDir = '.prjct';
    }

    async ensureProjectDir(projectPath) {
        const dir = path.join(projectPath, this.prjctDir);
        await fs.mkdir(dir, { recursive: true });
        return dir;
    }

    async init(projectPath = process.cwd()) {
        try {
            const dir = await this.ensureProjectDir(projectPath);

            // Create initial files
            const files = {
                'now.md': '# NOW\n\nNo current task. Use `/p:now` to set focus.\n',
                'next.md': '# NEXT\n\n## Priority Queue\n\n',
                'shipped.md': '# SHIPPED 🚀\n\n',
                'ideas.md': '# IDEAS 💡\n\n## Brain Dump\n\n',
                'memory.jsonl': ''
            };

            for (const [filename, content] of Object.entries(files)) {
                await fs.writeFile(path.join(dir, filename), content);
            }

            // Detect project type
            const projectInfo = await this.detectProjectType(projectPath);

            return {
                success: true,
                message: `🚀 Initializing prjct...\n✅ Created .prjct/ structure\n📊 Detected: ${projectInfo}\nReady! Start with /p:now "your first task"`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async now(task = null, projectPath = process.cwd()) {
        try {
            const nowFile = path.join(projectPath, this.prjctDir, 'now.md');

            if (!task) {
                // Read current task
                const content = await fs.readFile(nowFile, 'utf-8');
                const lines = content.split('\n');
                const currentTask = lines[0].replace('# NOW: ', '').replace('# NOW', 'None');
                return {
                    success: true,
                    message: `📍 Current focus: ${currentTask}`
                };
            }

            // Set new task
            const content = `# NOW: ${task}\nStarted: ${new Date().toISOString()}\n\n## Task\n${task}\n\n## Notes\n\n`;
            await fs.writeFile(nowFile, content);

            // Log to memory
            await this.logToMemory(projectPath, 'now', { task, timestamp: new Date().toISOString() });

            return {
                success: true,
                message: `📍 Focus set: ${task}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async done(projectPath = process.cwd()) {
        try {
            const nowFile = path.join(projectPath, this.prjctDir, 'now.md');
            const nextFile = path.join(projectPath, this.prjctDir, 'next.md');

            // Get current task
            const content = await fs.readFile(nowFile, 'utf-8');
            const currentTask = content.split('\n')[0].replace('# NOW: ', '');

            if (currentTask === '# NOW' || !currentTask) {
                return {
                    success: false,
                    message: '⚠️ No current task to complete'
                };
            }

            // Clear current task
            await fs.writeFile(nowFile, '# NOW\n\nNo current task. Use `/p:now` to set focus.\n');

            // Log completion
            await this.logToMemory(projectPath, 'done', { task: currentTask, timestamp: new Date().toISOString() });

            // Check if there are next tasks
            const nextContent = await fs.readFile(nextFile, 'utf-8');
            const hasNext = nextContent.includes('- ');

            return {
                success: true,
                message: `✅ Task complete: ${currentTask}\n${hasNext ? 'Check /p:next for queued tasks' : 'Ready to ship? Use /p:ship if this is a feature'}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async ship(feature, projectPath = process.cwd()) {
        try {
            if (!feature) {
                return {
                    success: false,
                    message: '⚠️ Please specify a feature name: /p:ship "feature name"'
                };
            }

            const shippedFile = path.join(projectPath, this.prjctDir, 'shipped.md');

            // Read current content
            let content = await fs.readFile(shippedFile, 'utf-8');

            // Get current week
            const week = this.getWeekNumber(new Date());
            const year = new Date().getFullYear();
            const weekHeader = `## Week ${week}, ${year}`;

            // Add week header if not exists
            if (!content.includes(weekHeader)) {
                content += `\n${weekHeader}\n`;
            }

            // Add feature
            const entry = `- ✅ **${feature}** _(${new Date().toLocaleString()})_\n`;
            const insertIndex = content.indexOf(weekHeader) + weekHeader.length + 1;
            content = content.slice(0, insertIndex) + entry + content.slice(insertIndex);

            await fs.writeFile(shippedFile, content);

            // Count total shipped
            const totalShipped = (content.match(/✅/g) || []).length;

            // Log to memory
            await this.logToMemory(projectPath, 'ship', { feature, timestamp: new Date().toISOString() });

            // Calculate velocity
            const daysSinceLastShip = await this.getDaysSinceLastShip(projectPath);
            const velocityMsg = daysSinceLastShip > 3 ? '\nKeep the momentum going!' : '\nYou\'re on fire! 🔥';

            return {
                success: true,
                message: `🚀 SHIPPED! 🎉\n\n${feature}\nTotal shipped: ${totalShipped}${velocityMsg}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async next(projectPath = process.cwd()) {
        try {
            const nextFile = path.join(projectPath, this.prjctDir, 'next.md');
            const content = await fs.readFile(nextFile, 'utf-8');

            // Parse tasks
            const tasks = content.split('\n')
                .filter(line => line.startsWith('- '))
                .map((line, index) => `${index + 1}. ${line.replace('- ', '')}`);

            if (tasks.length === 0) {
                return {
                    success: true,
                    message: '📋 Queue is empty. Add tasks with /p:idea or focus on shipping!'
                };
            }

            return {
                success: true,
                message: `📋 Next up:\n${tasks.join('\n')}\n\nUse /p:now to start the next task`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async idea(text, projectPath = process.cwd()) {
        try {
            if (!text) {
                return {
                    success: false,
                    message: '⚠️ Please provide an idea: /p:idea "your idea"'
                };
            }

            const ideasFile = path.join(projectPath, this.prjctDir, 'ideas.md');
            const nextFile = path.join(projectPath, this.prjctDir, 'next.md');

            // Add to ideas
            const entry = `- ${text} _(${new Date().toLocaleDateString()})_\n`;
            await fs.appendFile(ideasFile, entry);

            // Optionally add to next queue if it looks actionable
            if (text.match(/^(implement|add|create|fix|update|build)/i)) {
                await fs.appendFile(nextFile, `- ${text}\n`);
            }

            // Log to memory
            await this.logToMemory(projectPath, 'idea', { text, timestamp: new Date().toISOString() });

            return {
                success: true,
                message: `💡 Idea captured!\n"${text}"\n${text.match(/^(implement|add|create|fix|update|build)/i) ? 'Also added to /p:next queue' : ''}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async recap(projectPath = process.cwd()) {
        try {
            // Read all files
            const nowFile = await fs.readFile(path.join(projectPath, this.prjctDir, 'now.md'), 'utf-8');
            const shippedFile = await fs.readFile(path.join(projectPath, this.prjctDir, 'shipped.md'), 'utf-8');
            const nextFile = await fs.readFile(path.join(projectPath, this.prjctDir, 'next.md'), 'utf-8');
            const ideasFile = await fs.readFile(path.join(projectPath, this.prjctDir, 'ideas.md'), 'utf-8');

            // Parse current task
            const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None');

            // Count metrics
            const shippedCount = (shippedFile.match(/✅/g) || []).length;
            const queuedCount = (nextFile.match(/^- /gm) || []).length;
            const ideasCount = (ideasFile.match(/^- /gm) || []).length;

            // Get this week's features
            const week = this.getWeekNumber(new Date());
            const year = new Date().getFullYear();
            const weekHeader = `Week ${week}, ${year}`;
            const weekShipped = shippedFile.includes(weekHeader)
                ? (shippedFile.split(weekHeader)[1]?.split('##')[0]?.match(/✅/g) || []).length
                : 0;

            const motivation = shippedCount === 0 ? 'Time to ship your first feature!' :
                             weekShipped >= 3 ? 'You\'re crushing it! 🔥' :
                             weekShipped >= 1 ? 'Good progress! Keep going!' :
                             'Let\'s get back to shipping!';

            return {
                success: true,
                message: `📊 Project Recap\n\n🎯 Current: ${currentTask}\n📦 Shipped: ${shippedCount} features total (${weekShipped} this week)\n📝 Queued: ${queuedCount} tasks\n💡 Ideas: ${ideasCount}\n\n${motivation}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async progress(period = 'week', projectPath = process.cwd()) {
        try {
            const shippedFile = await fs.readFile(path.join(projectPath, this.prjctDir, 'shipped.md'), 'utf-8');
            const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl');

            // Parse shipped features by date
            const features = [];
            const lines = shippedFile.split('\n');

            for (const line of lines) {
                if (line.includes('✅')) {
                    const match = line.match(/\*\*(.*?)\*\*.*?\((.*?)\)/);
                    if (match) {
                        features.push({
                            name: match[1],
                            date: new Date(match[2])
                        });
                    }
                }
            }

            // Filter by period
            const now = new Date();
            const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 7;
            const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

            const periodFeatures = features.filter(f => f.date >= cutoff);

            // Calculate velocity
            const velocity = periodFeatures.length / periodDays;
            const trend = velocity >= 0.5 ? '📈' : velocity >= 0.2 ? '➡️' : '📉';

            return {
                success: true,
                message: `📈 Progress Report (${period})\n\n✅ Shipped: ${periodFeatures.length} features\n⚡ Velocity: ${velocity.toFixed(2)} features/day\n${trend} Trend: ${velocity >= 0.5 ? 'Excellent!' : velocity >= 0.2 ? 'Good pace' : 'Time to accelerate'}\n\nRecent features:\n${periodFeatures.slice(0, 5).map(f => `• ${f.name}`).join('\n')}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async stuck(issue, projectPath = process.cwd()) {
        try {
            if (!issue) {
                return {
                    success: false,
                    message: '⚠️ Please describe what you\'re stuck on: /p:stuck "issue description"'
                };
            }

            // Log the issue
            await this.logToMemory(projectPath, 'stuck', { issue, timestamp: new Date().toISOString() });

            // Provide contextual help
            let help = '🤔 Let\'s work through this:\n\n';

            if (issue.match(/error|bug|crash/i)) {
                help += '🔍 Debugging steps:\n';
                help += '1. Check error message details\n';
                help += '2. Isolate the problem area\n';
                help += '3. Test with minimal code\n';
                help += '4. Search for similar issues\n';
            } else if (issue.match(/design|architecture|structure/i)) {
                help += '🏗️ Design approach:\n';
                help += '1. Define clear requirements\n';
                help += '2. Start with simplest solution\n';
                help += '3. Iterate and refactor\n';
                help += '4. Don\'t over-engineer\n';
            } else if (issue.match(/performance|slow|optimize/i)) {
                help += '⚡ Performance strategy:\n';
                help += '1. Measure first (profile)\n';
                help += '2. Identify bottlenecks\n';
                help += '3. Optimize critical path\n';
                help += '4. Cache when possible\n';
            } else {
                help += '💡 General approach:\n';
                help += '1. Break it into smaller tasks\n';
                help += '2. Tackle the easiest part first\n';
                help += '3. Build momentum\n';
                help += '4. Ask for help if needed\n';
            }

            help += '\nNeed more specific help? Provide more details about the issue.';

            return {
                success: true,
                message: help
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    async context(projectPath = process.cwd()) {
        try {
            // Detect project info
            const projectInfo = await this.detectProjectType(projectPath);

            // Get current state
            const nowFile = await fs.readFile(path.join(projectPath, this.prjctDir, 'now.md'), 'utf-8');
            const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None');

            // Read recent memory
            const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl');
            let recentActions = [];
            try {
                const memory = await fs.readFile(memoryFile, 'utf-8');
                const lines = memory.trim().split('\n').filter(l => l);
                recentActions = lines.slice(-5).map(l => {
                    const entry = JSON.parse(l);
                    return `• ${entry.action}: ${entry.data.task || entry.data.feature || entry.data.text || ''}`;
                });
            } catch (e) {
                // Memory file might not exist yet
            }

            return {
                success: true,
                message: `📋 Project Context\n\n🏗️ Project: ${projectInfo}\n📍 Current: ${currentTask}\n\n📜 Recent actions:\n${recentActions.join('\n') || '• No recent actions'}\n\nUse /p:recap for full progress report`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Error: ${error.message}`
            };
        }
    }

    // Helper methods
    async detectProjectType(projectPath) {
        const files = await fs.readdir(projectPath);

        if (files.includes('package.json')) {
            try {
                const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };

                if (deps['next']) return 'Next.js project';
                if (deps['react']) return 'React project';
                if (deps['vue']) return 'Vue project';
                if (deps['express']) return 'Express project';
                return 'Node.js project';
            } catch (e) {
                return 'Node.js project';
            }
        }

        if (files.includes('Cargo.toml')) return 'Rust project';
        if (files.includes('go.mod')) return 'Go project';
        if (files.includes('requirements.txt')) return 'Python project';
        if (files.includes('Gemfile')) return 'Ruby project';

        return 'General project';
    }

    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    async getDaysSinceLastShip(projectPath) {
        try {
            const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl');
            const memory = await fs.readFile(memoryFile, 'utf-8');
            const lines = memory.trim().split('\n').filter(l => l);

            for (let i = lines.length - 1; i >= 0; i--) {
                const entry = JSON.parse(lines[i]);
                if (entry.action === 'ship') {
                    const shipDate = new Date(entry.data.timestamp);
                    const now = new Date();
                    return Math.floor((now - shipDate) / 86400000);
                }
            }
        } catch (e) {
            // No previous ships
        }
        return Infinity;
    }

    async logToMemory(projectPath, action, data) {
        const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl');
        const entry = JSON.stringify({ action, data, timestamp: new Date().toISOString() }) + '\n';
        await fs.appendFile(memoryFile, entry);
    }
}

module.exports = new PrjctCommands();