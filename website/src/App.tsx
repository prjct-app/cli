import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { Documentation } from './pages/Documentation'
import { Commands } from './pages/Commands'
import { WorkflowsGuide } from './pages/WorkflowsGuide'
import { FAQPage } from './pages/FAQPage'
import { QuickStart } from './pages/docs/QuickStart'
import { Philosophy } from './pages/docs/Philosophy'
import { GitIntegration } from './pages/docs/GitIntegration'
import { BestPractices } from './pages/docs/BestPractices'
import { MCPIntegration } from './pages/docs/MCPIntegration'
import { Migration } from './pages/docs/Migration'
import { Terms } from './pages/Terms'
import { Privacy } from './pages/Privacy'
import { AIPolicy } from './pages/AIPolicy'
import { Changelog } from './pages/Changelog'
import { WindsurfExtensionPage } from './pages/WindsurfExtensionPage'
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';

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
            <Route path="/docs/migration" element={<Migration />} />
            <Route path="/commands" element={<Commands />} />
            <Route path="/workflows" element={<WorkflowsGuide />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/windsurf-extension" element={<WindsurfExtensionPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/ai-policy" element={<AIPolicy />} />
          </Routes>
        </main>

        <Footer />
      </div>
      <SpeedInsights />
      <Analytics />
    </Router>
  )
}

export default App
