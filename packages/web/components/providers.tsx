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
        staleTime: 5000,
        refetchOnWindowFocus: false,
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
