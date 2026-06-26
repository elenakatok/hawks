import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { auth, functions } from './firebase'
import Play from './pages/Play'
import InstructorDashboard from './pages/InstructorDashboard'
import Configure from './pages/Configure'
import Reports from './pages/Reports'
import { SettingsPage } from '@mygames/game-ui'

const hawksRoleLabels: Record<string, string> = {
  angel: 'Angel',
  agent: 'Agent',
  hawks: 'Hawks',
}

const hawksInfoLinks = [
  { roleKey: 'angel', links: [
    { key: 'angel_sheet_url', label: 'Role sheet' },
  ]},
  { roleKey: 'agent', links: [
    { key: 'agent_sheet_url', label: 'Role sheet' },
  ]},
  { roleKey: 'hawks', links: [
    { key: 'hawks_sheet_url', label: 'Role sheet' },
  ]},
]

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Play />} />
        <Route path="/dashboard" element={<InstructorDashboard />} />
        <Route path="/configure" element={<Configure />} />
        <Route path="/reports"   element={<Reports />} />
        <Route path="/settings"  element={
          <SettingsPage
            title="Settings — Hawks"
            functions={functions}
            auth={auth}
            roleLabels={hawksRoleLabels}
            roleInfoLinks={hawksInfoLinks}
          />
        } />
      </Routes>
    </BrowserRouter>
  )
}
