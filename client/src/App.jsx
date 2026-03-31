import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './components/Auth/LoginPage'
import AppShell from './components/Layout/AppShell'
import Board from './components/Board/Board'
import CalendarPage from './components/Calendar/CalendarPage'
import ArchivesPage from './components/Archives/ArchivesPage'
import AdminUsersPage from './components/Admin/AdminUsersPage'
import AdminTagsPage from './components/Admin/AdminTagsPage'
import MonEspacePage from './components/MonEspace/MonEspacePage'
import ProjectsLayout from './components/Projects/ProjectsLayout'
import ListView from './components/List/ListView'
import DashboardView from './components/Dashboard/DashboardView'
import useAuthStore from './store/authStore'

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

function ProjectsRoute({ children }) {
  return (
    <PrivateRoute>
      <AppShell>
        <ProjectsLayout>{children}</ProjectsLayout>
      </AppShell>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Redirect legacy root to board */}
        <Route path="/" element={<Navigate to="/projects/board" replace />} />

        {/* Projects views */}
        <Route path="/projects/board" element={<ProjectsRoute><Board /></ProjectsRoute>} />
        <Route path="/projects/list" element={<ProjectsRoute><ListView /></ProjectsRoute>} />
<Route path="/projects/dashboard" element={<ProjectsRoute><DashboardView /></ProjectsRoute>} />

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
          path="/mon-espace"
          element={
            <PrivateRoute>
              <AppShell>
                <MonEspacePage />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/projects/board" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
