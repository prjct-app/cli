'use client'

/**
 * useClaudeTerminal - WebSocket connection to Claude Code CLI via PTY
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Session persistence across server restarts
 * - NO API costs - uses your existing Claude Max subscription!
 * - Light/Dark theme support
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useTheme } from 'next-themes'
import type { Terminal, ITheme } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'

// Terminal themes
const darkTheme: ITheme = {
  background: '#0a0a0f',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  cursorAccent: '#0a0a0f',
  selectionBackground: '#3f3f46',
  black: '#18181b',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#fafafa'
}

const lightTheme: ITheme = {
  background: '#ffffff',
  foreground: '#18181b',
  cursor: '#18181b',
  cursorAccent: '#ffffff',
  selectionBackground: '#d4d4d8',
  black: '#18181b',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#f4f4f5',
  brightBlack: '#71717a',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#fafafa'
}

interface UseClaudeTerminalOptions {
  sessionId: string
  projectDir: string
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: string) => void
  onReconnecting?: (attempt: number, maxAttempts: number) => void
}

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY = 1000 // 1 second
const MAX_RECONNECT_DELAY = 30000 // 30 seconds

export function useClaudeTerminal(options: UseClaudeTerminalOptions) {
  const { sessionId, projectDir, onConnect, onDisconnect, onError, onReconnecting } = options
  const { resolvedTheme } = useTheme()

  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const intentionalDisconnectRef = useRef(false)
  const currentSessionIdRef = useRef<string | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const outputBufferRef = useRef<string[]>([])
  const flushScheduledRef = useRef(false)

  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)

  // Update terminal theme when resolvedTheme changes
  useEffect(() => {
    if (terminalRef.current) {
      const newTheme = resolvedTheme === 'light' ? lightTheme : darkTheme
      terminalRef.current.options.theme = newTheme
    }
  }, [resolvedTheme])

  // Initialize terminal - returns Promise<void>
  const initTerminal = useCallback(async (container: HTMLDivElement): Promise<void> => {
    if (terminalRef.current) return

    // Dynamic imports for client-side only
    const { Terminal } = await import('@xterm/xterm')
    const { FitAddon } = await import('@xterm/addon-fit')
    const { WebLinksAddon } = await import('@xterm/addon-web-links')
    // CSS is loaded globally via globals.css

    // Determine initial theme based on document class
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    const initialTheme = isDark ? darkTheme : lightTheme

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: initialTheme,
      // Performance optimizations
      scrollback: 5000,
      smoothScrollDuration: 0,  // Instant scroll for better performance
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    term.open(container)
    fitAddon.fit()

    terminalRef.current = term
    fitAddonRef.current = fitAddon
    containerRef.current = container

    // Use ResizeObserver for better resize handling (works with container, not just window)
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && containerRef.current) {
        // Only fit if container has dimensions (not hidden)
        if (containerRef.current.offsetWidth > 0 && containerRef.current.offsetHeight > 0) {
          fitAddonRef.current.fit()

          // Send resize to server
          if (wsRef.current?.readyState === WebSocket.OPEN && terminalRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'resize',
              cols: terminalRef.current.cols,
              rows: terminalRef.current.rows
            }))
          }
        }
      }
    })

    resizeObserver.observe(container)
    resizeObserverRef.current = resizeObserver
  }, [])

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  // Schedule reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (intentionalDisconnectRef.current) return
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setIsReconnecting(false)
      onError?.(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`)
      return
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    )

    reconnectAttemptsRef.current++
    setIsReconnecting(true)
    onReconnecting?.(reconnectAttemptsRef.current, MAX_RECONNECT_ATTEMPTS)

    console.log(`[Terminal] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)

    reconnectTimeoutRef.current = setTimeout(() => {
      connectWebSocket()
    }, delay)
  }, [onError, onReconnecting])

  // Connect WebSocket (internal)
  const connectWebSocket = useCallback(async () => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const activeSessionId = currentSessionIdRef.current || sessionId

    try {
      // Create PTY session on server
      const response = await fetch('/api/claude/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, projectDir })
      })

      if (!response.ok) {
        throw new Error('Failed to create PTY session')
      }

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/claude/${activeSessionId}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[Terminal] WebSocket connected')
        reconnectAttemptsRef.current = 0
        setIsConnected(true)
        setIsLoading(false)
        setIsReconnecting(false)
        onConnect?.()

        // Send initial resize
        if (terminalRef.current) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: terminalRef.current.cols,
            rows: terminalRef.current.rows
          }))
        }
      }

      // Flush buffered output using requestAnimationFrame for smooth rendering
      const flushOutput = () => {
        if (outputBufferRef.current.length > 0 && terminalRef.current) {
          const combined = outputBufferRef.current.join('')
          terminalRef.current.write(combined)
          outputBufferRef.current = []
        }
        flushScheduledRef.current = false
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'output':
              // Buffer output and flush on next animation frame for smooth rendering
              outputBufferRef.current.push(message.data)
              if (!flushScheduledRef.current) {
                flushScheduledRef.current = true
                requestAnimationFrame(flushOutput)
              }
              break

            case 'connected':
              console.log('[Terminal] Connected to Claude Code CLI')
              break

            case 'exit':
              console.log('[Terminal] Claude Code exited with code:', message.code)
              terminalRef.current?.write('\r\n[Session ended]\r\n')
              break

            case 'error':
              onError?.(message.message)
              break
          }
        } catch {
          // Raw data, write directly (also buffered)
          outputBufferRef.current.push(event.data)
          if (!flushScheduledRef.current) {
            flushScheduledRef.current = true
            requestAnimationFrame(flushOutput)
          }
        }
      }

      ws.onclose = (event) => {
        console.log(`[Terminal] WebSocket closed (code: ${event.code})`)
        setIsConnected(false)
        wsRef.current = null

        // Only trigger reconnect if not intentional
        if (!intentionalDisconnectRef.current) {
          terminalRef.current?.write('\r\n\x1b[33m[Disconnected - Reconnecting...]\x1b[0m\r\n')
          scheduleReconnect()
        } else {
          onDisconnect?.()
        }
      }

      ws.onerror = (error) => {
        console.error('[Terminal] WebSocket error:', error)
        // Don't call onError here, onclose will handle reconnect
      }

      wsRef.current = ws

      // Forward terminal input to WebSocket
      terminalRef.current?.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }))
        }
      })

    } catch (error) {
      console.error('[Terminal] Connection error:', error)
      setIsLoading(false)

      // Schedule reconnect on connection failure
      if (!intentionalDisconnectRef.current) {
        scheduleReconnect()
      } else {
        onError?.(error instanceof Error ? error.message : 'Connection failed')
      }
    }
  }, [sessionId, projectDir, onConnect, onDisconnect, onError, scheduleReconnect])

  // Public connect function
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    intentionalDisconnectRef.current = false
    reconnectAttemptsRef.current = 0
    currentSessionIdRef.current = sessionId
    setIsLoading(true)

    await connectWebSocket()
  }, [sessionId, connectWebSocket])

  // Disconnect (intentional)
  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true
    clearReconnectTimeout()
    setIsReconnecting(false)

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    onDisconnect?.()
  }, [clearReconnectTimeout, onDisconnect])

  // Send input
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }))
    }
  }, [])

  // Focus terminal
  const focusTerminal = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [])

  // Fit terminal to container (useful when tab becomes visible)
  const fit = useCallback(() => {
    if (fitAddonRef.current && containerRef.current) {
      // Only fit if container has dimensions (not hidden)
      if (containerRef.current.offsetWidth > 0 && containerRef.current.offsetHeight > 0) {
        fitAddonRef.current.fit()

        // Send resize to server
        if (wsRef.current?.readyState === WebSocket.OPEN && terminalRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: terminalRef.current.cols,
            rows: terminalRef.current.rows
          }))
        }
      }
    }
  }, [])

  // Cleanup on unmount - empty deps to run only on unmount
  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      // Cleanup ResizeObserver
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
    }
  }, []) // Empty deps - run cleanup only on unmount

  return {
    initTerminal,
    connect,
    disconnect,
    sendInput,
    focusTerminal,
    fit,
    isConnected,
    isLoading,
    isReconnecting,
    terminalRef,
    containerRef
  }
}
