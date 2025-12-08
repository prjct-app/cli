import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Project } from '@/pages/Project'
import { Terminal } from '@/pages/Terminal'
import { Sessions } from '@/pages/Sessions'
import { Settings } from '@/pages/Settings'
import { TerminalProvider } from '@/context/TerminalContext'

function App() {
  return (
    <TerminalProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/project/:projectId" element={<Project />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/terminal/:projectId" element={<Terminal />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </TerminalProvider>
  )
}

export default App
