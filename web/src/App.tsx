import { useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProjectsPage } from './pages/Projects'
import { ProjectPage } from './pages/Project'
import { BoardTab } from './pages/tabs/BoardTab'
import { IdeasTab } from './pages/tabs/IdeasTab'
import { ShippedTab } from './pages/tabs/ShippedTab'
import { OverviewTab } from './pages/tabs/OverviewTab'
import { CalendarTab } from './pages/tabs/CalendarTab'
import { WorkflowTab } from './pages/tabs/WorkflowTab'
import { ActivityTab } from './pages/tabs/ActivityTab'
import { TaskDetailPage } from './pages/TaskDetail'
import { CommandPalette } from './components/CommandPalette'
import { CreateIssueModal } from './components/CreateIssueModal'

function CreateIssueWrapper({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return null
  return <CreateIssueModal projectId={projectId} open onClose={onClose} onCreated={onCreated} />
}

export default function App() {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <CommandPalette onCreateIssue={() => setCreateOpen(true)} />
      <Routes>
        <Route element={<Layout onCreateIssue={() => setCreateOpen(true)} />}>
          <Route index element={<ProjectsPage />} />
          <Route path="project/:projectId/task/:taskId" element={<TaskDetailPage />} />
          <Route path="project/:projectId" element={<ProjectPage onCreateIssue={() => setCreateOpen(true)} createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />}>
            <Route index element={<Navigate to="board" replace />} />
            <Route path="board" element={<BoardTab />} />
            <Route path="ideas" element={<IdeasTab />} />
            <Route path="shipped" element={<ShippedTab />} />
            <Route path="overview" element={<OverviewTab />} />
            <Route path="calendar" element={<CalendarTab />} />
            <Route path="workflows" element={<WorkflowTab />} />
            <Route path="activity" element={<ActivityTab />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
