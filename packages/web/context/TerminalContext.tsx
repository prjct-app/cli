'use client'

/**
 * Terminal Context - Share terminal commands across components
 */

import { createContext, useContext, useRef, useCallback, useState, ReactNode } from 'react'

interface TerminalContextType {
  isConnected: boolean
  setIsConnected: (connected: boolean) => void
  sendCommand: (command: string) => void
  registerSendInput: (fn: (data: string) => void) => void
}

const TerminalContext = createContext<TerminalContextType | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const sendInputRef = useRef<((data: string) => void) | null>(null)

  const registerSendInput = useCallback((fn: (data: string) => void) => {
    sendInputRef.current = fn
  }, [])

  const sendCommand = useCallback((command: string) => {
    if (sendInputRef.current && isConnected) {
      sendInputRef.current(command + '\n')
    }
  }, [isConnected])

  return (
    <TerminalContext.Provider value={{ isConnected, setIsConnected, sendCommand, registerSendInput }}>
      {children}
    </TerminalContext.Provider>
  )
}

export function useTerminalContext() {
  const context = useContext(TerminalContext)
  if (!context) {
    throw new Error('useTerminalContext must be used within TerminalProvider')
  }
  return context
}
