/**
 * Task Stack Manager - Handles multiple concurrent tasks with pause/resume capability
 * Enables natural workflow with interruptions and context switching
 */

const path = require('path');
const fs = require('fs').promises;

class TaskStack {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.stackPath = path.join(projectPath, 'core', 'stack.jsonl');
    this.nowPath = path.join(projectPath, 'core', 'now.md');
  }

  /**
   * Initialize stack system - migrate from legacy now.md if needed
   */
  async initialize() {
    try {
      // Check if stack already exists
      await fs.access(this.stackPath);
      return { migrated: false };
    } catch {
      // Stack doesn't exist, check for legacy now.md
      return await this.migrateFromLegacy();
    }
  }

  /**
   * Migrate from legacy now.md to stack system
   */
  async migrateFromLegacy() {
    try {
      const nowContent = await fs.readFile(this.nowPath, 'utf8');

      if (!nowContent.trim() || nowContent.includes('No active task')) {
        // Empty or no task, just create empty stack
        await this.ensureStackFile();
        return { migrated: true, hadTask: false };
      }

      // Parse task from now.md
      const task = this.parseNowFile(nowContent);

      // Create initial stack entry
      const entry = {
        id: `task-${Date.now()}`,
        task: task.description || 'Migrated task',
        agent: task.agent || 'unknown',
        status: 'active',
        started: task.started || new Date().toISOString(),
        paused: null,
        resumed: null,
        completed: null,
        duration: null,
        complexity: task.complexity || 'moderate',
        dev: task.dev || 'unknown'
      };

      // Write to stack
      await this.appendToStack(entry);

      return { migrated: true, hadTask: true, task: entry };
    } catch (error) {
      // No now.md or error reading, just create empty stack
      await this.ensureStackFile();
      return { migrated: true, hadTask: false, error: error.message };
    }
  }

  /**
   * Parse legacy now.md format
   */
  parseNowFile(content) {
    const result = {
      description: '',
      started: null,
      agent: null,
      complexity: null,
      dev: null
    };

    // Check for frontmatter
    if (content.startsWith('---')) {
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd > 0) {
        const frontmatter = content.substring(3, frontmatterEnd);
        const lines = frontmatter.split('\n');

        for (const line of lines) {
          if (line.includes('task:')) {
            result.description = line.split('task:')[1].trim().replace(/['"]/g, '');
          }
          if (line.includes('started:')) {
            result.started = line.split('started:')[1].trim();
          }
          if (line.includes('agent:')) {
            result.agent = line.split('agent:')[1].trim();
          }
          if (line.includes('complexity:')) {
            result.complexity = line.split('complexity:')[1].trim();
          }
          if (line.includes('dev:')) {
            result.dev = line.split('dev:')[1].trim();
          }
        }

        // Get description from content if not in frontmatter
        if (!result.description) {
          const contentBody = content.substring(frontmatterEnd + 3).trim();
          const firstLine = contentBody.split('\n')[0];
          if (firstLine && !firstLine.startsWith('#')) {
            result.description = firstLine.replace(/^[*-]\s*/, '').trim();
          }
        }
      }
    } else {
      // No frontmatter, try to extract task from content
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
          result.description = line.replace(/^[*-]\s*/, '').trim();
          break;
        }
      }
    }

    return result;
  }

  /**
   * Ensure stack file exists
   */
  async ensureStackFile() {
    try {
      await fs.access(this.stackPath);
    } catch {
      // Create empty file
      await fs.writeFile(this.stackPath, '');
    }
  }

  /**
   * Append entry to stack
   */
  async appendToStack(entry) {
    await this.ensureStackFile();
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.stackPath, line);
  }

  /**
   * Read all stack entries
   */
  async readStack() {
    await this.ensureStackFile();
    const content = await fs.readFile(this.stackPath, 'utf8');

    if (!content.trim()) {
      return [];
    }

    const entries = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (error) {
        console.error('Error parsing stack line:', error);
      }
    }

    return entries;
  }

  /**
   * Get active task
   */
  async getActiveTask() {
    const stack = await this.readStack();
    return stack.find(task => task.status === 'active') || null;
  }

  /**
   * Get paused tasks
   */
  async getPausedTasks() {
    const stack = await this.readStack();
    return stack.filter(task => task.status === 'paused')
      .sort((a, b) => new Date(b.paused) - new Date(a.paused)); // Most recently paused first
  }

  /**
   * Get all incomplete tasks
   */
  async getIncompleteTasks() {
    const stack = await this.readStack();
    return stack.filter(task => task.status !== 'completed');
  }

  /**
   * Start a new task
   */
  async startTask(description, agent = 'general', complexity = 'moderate') {
    // Check if there's already an active task
    const active = await this.getActiveTask();
    if (active) {
      throw new Error(`Already working on: ${active.task}. Use /p:pause to pause it first.`);
    }

    const entry = {
      id: `task-${Date.now()}`,
      task: description,
      agent,
      status: 'active',
      started: new Date().toISOString(),
      paused: null,
      resumed: null,
      completed: null,
      duration: null,
      complexity,
      dev: await this.getCurrentDev()
    };

    await this.appendToStack(entry);
    await this.updateNowFile(entry);

    return entry;
  }

  /**
   * Pause the active task
   */
  async pauseTask(reason = '') {
    const active = await this.getActiveTask();
    if (!active) {
      throw new Error('No active task to pause');
    }

    // Update the task
    active.status = 'paused';
    active.paused = new Date().toISOString();
    if (reason) {
      active.pauseReason = reason;
    }

    // Rewrite stack with updated task
    await this.updateTask(active);

    // Update now.md to show paused state
    await this.updateNowFile(null, `Paused: ${active.task}`);

    return active;
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId = null) {
    // Check if there's an active task
    const active = await this.getActiveTask();
    if (active) {
      throw new Error(`Already working on: ${active.task}. Complete or pause it first.`);
    }

    const paused = await this.getPausedTasks();
    if (paused.length === 0) {
      throw new Error('No paused tasks to resume');
    }

    let taskToResume;
    if (taskId) {
      taskToResume = paused.find(t => t.id === taskId);
      if (!taskToResume) {
        throw new Error(`Task ${taskId} not found or not paused`);
      }
    } else {
      // Resume most recently paused
      taskToResume = paused[0];
    }

    // Update the task
    taskToResume.status = 'active';
    taskToResume.resumed = new Date().toISOString();

    // Calculate paused duration
    if (taskToResume.paused) {
      const pausedMs = new Date() - new Date(taskToResume.paused);
      taskToResume.pausedDuration = (taskToResume.pausedDuration || 0) + pausedMs;
    }

    // Rewrite stack with updated task
    await this.updateTask(taskToResume);

    // Update now.md
    await this.updateNowFile(taskToResume);

    return taskToResume;
  }

  /**
   * Complete the active task
   */
  async completeTask() {
    const active = await this.getActiveTask();
    if (!active) {
      throw new Error('No active task to complete');
    }

    // Update the task
    active.status = 'completed';
    active.completed = new Date().toISOString();

    // Calculate duration (excluding paused time)
    const totalMs = new Date() - new Date(active.started);
    const pausedMs = active.pausedDuration || 0;
    active.duration = totalMs - pausedMs;
    active.durationFormatted = this.formatDuration(active.duration);

    // Rewrite stack with updated task
    await this.updateTask(active);

    // Clear now.md
    await this.updateNowFile(null, '');

    return active;
  }

  /**
   * Switch tasks (atomic pause + resume/start)
   */
  async switchTask(targetTaskOrDescription) {
    const active = await this.getActiveTask();
    let pausedTask = null;

    // Pause current if exists
    if (active) {
      pausedTask = await this.pauseTask('Switched to another task');
    }

    try {
      // Check if target is a task ID or description
      const paused = await this.getPausedTasks();
      const existingTask = paused.find(t => t.id === targetTaskOrDescription);

      if (existingTask) {
        // Resume existing task
        return {
          paused: pausedTask,
          resumed: await this.resumeTask(targetTaskOrDescription),
          type: 'resumed'
        };
      } else {
        // Start new task
        return {
          paused: pausedTask,
          started: await this.startTask(targetTaskOrDescription),
          type: 'started'
        };
      }
    } catch (error) {
      // If switch fails, resume the original task
      if (pausedTask) {
        await this.resumeTask(pausedTask.id);
      }
      throw error;
    }
  }

  /**
   * Update a task in the stack
   */
  async updateTask(updatedTask) {
    const stack = await this.readStack();
    const index = stack.findIndex(t => t.id === updatedTask.id);

    if (index === -1) {
      throw new Error(`Task ${updatedTask.id} not found`);
    }

    stack[index] = updatedTask;

    // Rewrite entire file (JSONL format)
    const content = stack.map(task => JSON.stringify(task)).join('\n') + '\n';
    await fs.writeFile(this.stackPath, content);
  }

  /**
   * Update now.md to reflect current state
   */
  async updateNowFile(task, customContent = null) {
    let content;

    if (customContent !== undefined && customContent !== null) {
      content = customContent;
    } else if (!task) {
      content = `# Current Task

**No active task**

Use \`/p:work\` or \`/p:resume\` to start working.

---

_Track your focus with \`/p:work [task]\`_
`;
    } else {
      const started = new Date(task.started);
      const now = new Date();
      const elapsed = this.formatDuration(now - started - (task.pausedDuration || 0));

      content = `---
task: "${task.task}"
started: ${task.started}
agent: ${task.agent}
complexity: ${task.complexity}
dev: ${task.dev}
---

# Current Task

**${task.task}**

- Started: ${started.toLocaleTimeString()} (${elapsed} ago)
- Agent: ${task.agent}
- Complexity: ${task.complexity}

---

When done: \`/p:done\`
Need to pause: \`/p:pause\`
`;
    }

    await fs.writeFile(this.nowPath, content);
  }

  /**
   * Get current developer from git or system
   */
  async getCurrentDev() {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('git config user.name');
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get stack summary for display
   */
  async getStackSummary() {
    const active = await this.getActiveTask();
    const paused = await this.getPausedTasks();
    const stack = await this.readStack();
    const completed = stack.filter(t => t.status === 'completed');

    return {
      active,
      paused,
      pausedCount: paused.length,
      completed,
      completedCount: completed.length,
      totalTasks: stack.length
    };
  }
}

module.exports = TaskStack;