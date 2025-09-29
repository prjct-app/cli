import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { Documentation } from './pages/Documentation'
import { Commands } from './pages/Commands'
import { Workflows } from './pages/Workflows'
import { FAQPage } from './pages/FAQPage'
import { QuickStart } from './pages/docs/QuickStart'
import { Philosophy } from './pages/docs/Philosophy'
import { GitIntegration } from './pages/docs/GitIntegration'
import { BestPractices } from './pages/docs/BestPractices'
import { MCPIntegration } from './pages/docs/MCPIntegration'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <Navigation />

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/docs" element={<Documentation />} />
            <Route path="/docs/quick-start" element={<QuickStart />} />
            <Route path="/docs/philosophy" element={<Philosophy />} />
            <Route path="/docs/git-integration" element={<GitIntegration />} />
            <Route path="/docs/best-practices" element={<BestPractices />} />
            <Route path="/docs/mcp-integration" element={<MCPIntegration />} />
            <Route path="/commands" element={<Commands />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/faq" element={<FAQPage />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  )
}

export default App
