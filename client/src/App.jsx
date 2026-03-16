import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './components/Auth/LoginPage'
import AppShell from './components/Layout/AppShell'
import Board from './components/Board/Board'
import CalendarPage from './components/Calendar/CalendarPage'
import ArchivesPage from './components/Archives/ArchivesPage'
import AdminUsersPage from './components/Admin/AdminUsersPage'
import AdminTagsPage from './components/Admin/AdminTagsPage'
import FlowsPage from './components/Flows/FlowsPage'
import FlowEditor from './components/Flows/FlowEditor'
import MonEspacePage from './components/MonEspace/MonEspacePage'
import useAuthStore from './store/authStore'

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppShell>
                <Board />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <PrivateRoute>
              <AppShell>
                <CalendarPage />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/archives"
          element={
            <PrivateRoute>
              <AppShell>
                <ArchivesPage />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <PrivateRoute>
              <AppShell>
                <AdminUsersPage />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/tags"
          element={
            <PrivateRoute>
              <AppShell>
                <AdminTagsPage />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/flows"
          element={
            <PrivateRoute>
              <AppShell>
                <FlowsPage />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/flows/:id"
          element={
            <PrivateRoute>
              <AppShell>
                <FlowEditor />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/mon-espace"
          element={
            <PrivateRoute>
              <AppShell>
                <MonEspacePage />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
