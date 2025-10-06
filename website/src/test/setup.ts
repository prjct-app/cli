import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Mock IntersectionObserver for framer-motion
globalThis.IntersectionObserver = class IntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
  takeRecords = vi.fn()

  constructor() {}
} as unknown as typeof IntersectionObserver

// Mock ResizeObserver for framer-motion
globalThis.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor() {}
} as unknown as typeof ResizeObserver

// Mock Element.prototype.scrollTo for Terminal component
Element.prototype.scrollTo = vi.fn()

// Cleanup after each test
afterEach(() => {
  cleanup()
})
