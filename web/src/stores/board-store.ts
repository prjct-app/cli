import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SortBy = 'priority' | 'date' | 'type' | 'manual'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'board' | 'table'

interface ProjectPrefs {
  view: ViewMode
  sortBy: SortBy
  sortDir: SortDir
  pageSize: number
  page: number
  manualOrder: string[]
}

const DEFAULT_PREFS: ProjectPrefs = {
  view: 'board',
  sortBy: 'priority',
  sortDir: 'asc',
  pageSize: 25,
  page: 0,
  manualOrder: [],
}

interface BoardState {
  projects: Record<string, ProjectPrefs>
  getPrefs: (projectId: string) => ProjectPrefs
  setView: (projectId: string, view: ViewMode) => void
  setSort: (projectId: string, sortBy: SortBy, sortDir?: SortDir) => void
  setPage: (projectId: string, page: number) => void
  setPageSize: (projectId: string, size: number) => void
  setManualOrder: (projectId: string, order: string[]) => void
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      projects: {},

      getPrefs: (projectId: string) => get().projects[projectId] || DEFAULT_PREFS,

      setView: (projectId, view) =>
        set(s => ({ projects: { ...s.projects, [projectId]: { ...s.projects[projectId] || DEFAULT_PREFS, view } } })),

      setSort: (projectId, sortBy, sortDir) =>
        set(s => {
          const prev = s.projects[projectId] || DEFAULT_PREFS
          return { projects: { ...s.projects, [projectId]: { ...prev, sortBy, sortDir: sortDir ?? prev.sortDir, page: 0 } } }
        }),

      setPage: (projectId, page) =>
        set(s => ({ projects: { ...s.projects, [projectId]: { ...s.projects[projectId] || DEFAULT_PREFS, page } } })),

      setPageSize: (projectId, pageSize) =>
        set(s => ({ projects: { ...s.projects, [projectId]: { ...s.projects[projectId] || DEFAULT_PREFS, pageSize, page: 0 } } })),

      setManualOrder: (projectId, manualOrder) =>
        set(s => ({ projects: { ...s.projects, [projectId]: { ...s.projects[projectId] || DEFAULT_PREFS, manualOrder, sortBy: 'manual' as SortBy } } })),
    }),
    { name: 'prjct-board' }
  )
)
