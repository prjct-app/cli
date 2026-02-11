#!/usr/bin/env node
/**
 * Daemon entry point
 *
 * This file is spawned as a detached background process.
 * It starts the daemon server and keeps running until stopped.
 */

import { startDaemon } from './daemon'

const args = process.argv.slice(2)
const port =
  parseInt(args.find((a) => a.startsWith('--port='))?.split('=')[1] || '', 10) || undefined
const noHttp = args.includes('--no-http')
const foreground = args.includes('--foreground')

startDaemon({ port, noHttp, foreground }).catch((err) => {
  console.error('Failed to start daemon:', (err as Error).message)
  process.exit(1)
})
