/**
 * useClaudeTerminal - WebSocket connection to Claude Code CLI via PTY
 *
 * CRITICAL: This connects to Claude Code CLI using your subscription.
 * NO API costs - uses your existing Claude Max subscription!
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface UseClaudeTerminalOptions {
  sessionId: string
  projectDir: string
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: string) => void
}

export function useClaudeTerminal(options: UseClaudeTerminalOptions) {
  const { sessionId, projectDir, onConnect, onDisconnect, onError } = options

  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize terminal
  const initTerminal = useCallback((container: HTMLDivElement) => {
    if (terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
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

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()

        // Send resize to server
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows
          }))
        }
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
      terminalRef.current = null
    }
  }, [])

  // Connect WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current) return

    setIsLoading(true)

    try {
      // First, create PTY session on server
      const response = await fetch('/api/claude/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, projectDir })
      })

      if (!response.ok) {
        throw new Error('Failed to create PTY session')
      }

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/claude/${sessionId}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setIsConnected(true)
        setIsLoading(false)
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

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'output':
              terminalRef.current?.write(message.data)
              break

            case 'connected':
              console.log('Connected to Claude Code CLI')
              break

            case 'exit':
              console.log('Claude Code exited with code:', message.code)
              terminalRef.current?.write('\r\n[Session ended]\r\n')
              break

            case 'error':
              onError?.(message.message)
              break
          }
        } catch (error) {
          // Raw data, write directly
          terminalRef.current?.write(event.data)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        onDisconnect?.()
      }

      ws.onerror = () => {
        onError?.('WebSocket connection error')
      }

      wsRef.current = ws

      // Forward terminal input to WebSocket
      terminalRef.current?.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }))
        }
      })

    } catch (error) {
      setIsLoading(false)
      onError?.(error instanceof Error ? error.message : 'Connection failed')
    }
  }, [sessionId, projectDir, onConnect, onDisconnect, onError])

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Send input
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }))
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    initTerminal,
    connect,
    disconnect,
    sendInput,
    isConnected,
    isLoading,
    terminalRef,
    containerRef
  }
}
