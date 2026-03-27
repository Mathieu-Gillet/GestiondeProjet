import { useEffect } from 'react'
import TopBar from './TopBar'
import useAuthStore from '../../store/authStore'
import useProjectStore from '../../store/projectStore'

export default function AppShell({ children }) {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const token = useAuthStore((s) => s.token)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)
  const fetchTags = useProjectStore((s) => s.fetchTags)
  const initSSE = useProjectStore((s) => s.initSSE)
  const closeSSE = useProjectStore((s) => s.closeSSE)

  useEffect(() => {
    fetchMe()
    fetchProjects()
    fetchTags()
    if (token) initSSE(token)
    return () => closeSSE()
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <TopBar />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
