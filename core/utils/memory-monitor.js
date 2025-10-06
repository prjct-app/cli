/**
 * Memory Monitor - Optional debugging utility
 *
 * Helps identify memory leaks in production
 *
 * Usage:
 *   PRJCT_DEBUG_MEMORY=1 prjct now "task"
 *
 * @version 1.0.0
 */

class MemoryMonitor {
  constructor() {
    this.enabled = process.env.PRJCT_DEBUG_MEMORY === '1'
    this.interval = null
    this.intervalMs = 10000 // 10 seconds
    this.samples = []
    this.maxSamples = 100 // Keep last 100 samples (16 minutes)
  }

  /**
   * Start monitoring memory usage
   */
  start() {
    if (!this.enabled) return

    console.log('[MemoryMonitor] Starting memory monitoring...')

    this.interval = setInterval(() => {
      const usage = process.memoryUsage()

      const sample = {
        timestamp: new Date().toISOString(),
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
      }

      this.samples.push(sample)

      // Keep only last maxSamples
      if (this.samples.length > this.maxSamples) {
        this.samples.shift()
      }

      // Log current usage
      console.log(
        `[MemoryMonitor] RSS: ${sample.rss}MB | Heap: ${sample.heapUsed}/${sample.heapTotal}MB | External: ${sample.external}MB`
      )

      // Warn if memory usage is growing
      if (this.samples.length > 10) {
        const oldest = this.samples[0]
        const growth = sample.heapUsed - oldest.heapUsed

        if (growth > 50) {
          // 50MB growth
          console.warn(
            `[MemoryMonitor] ⚠️  Memory leak detected! Heap grew ${growth}MB in ${(this.samples.length * this.intervalMs) / 1000}s`
          )
        }
      }
    }, this.intervalMs)

    // Prevent interval from keeping process alive
    this.interval.unref()
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
      console.log('[MemoryMonitor] Stopped')
    }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    if (this.samples.length === 0) {
      return null
    }

    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]

    return {
      duration: this.samples.length * this.intervalMs,
      samples: this.samples.length,
      initial: first,
      current: last,
      growth: {
        rss: last.rss - first.rss,
        heapUsed: last.heapUsed - first.heapUsed,
      },
    }
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC() {
    if (global.gc) {
      console.log('[MemoryMonitor] Running garbage collection...')
      global.gc()
    } else {
      console.log('[MemoryMonitor] GC not available (run with --expose-gc)')
    }
  }
}

module.exports = new MemoryMonitor()
