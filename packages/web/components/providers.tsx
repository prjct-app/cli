'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ThemeProvider, type ThemeProviderProps } from 'next-themes'
import { TerminalProvider } from '@/context/TerminalContext'

function ThemeWrapper({ children, ...props }: ThemeProviderProps & { children: ReactNode }) {
  return <ThemeProvider {...props}>{children}</ThemeProvider>
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data considered fresh for 2.5 seconds
        staleTime: 2500,
        // Garbage collect after 5 minutes
        gcTime: 5 * 60 * 1000,
        // Refetch on window focus for real-time feel
        refetchOnWindowFocus: true,
        // Refetch when reconnecting
        refetchOnReconnect: true,
        // Retry failed requests once
        retry: 1,
        retryDelay: 1000,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeWrapper
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TerminalProvider>
          {children}
        </TerminalProvider>
      </ThemeWrapper>
    </QueryClientProvider>
  )
}
