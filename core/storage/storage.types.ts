/**
 * Storage Types
 *
 * Types for granular storage (legacy/future use)
 */

export interface Storage {
  write<T>(path: string[], data: T): Promise<void>
  read<T>(path: string[]): Promise<T | null>
  list(prefix: string[]): Promise<string[][]>
  delete(path: string[]): Promise<void>
  exists(path: string[]): Promise<boolean>
}

