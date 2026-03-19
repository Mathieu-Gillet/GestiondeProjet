import { create } from 'zustand'
import { projectService } from '../services/projectService'
import { tagService } from '../services/tagService'

const useProjectStore = create((set, get) => ({
  projects: [],
  tags: [],
  filters: { pole: 'all', search: '' },
  loading: false,
  error: null,
  _sseSource: null,

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const { pole } = get().filters
      const params = pole !== 'all' ? { pole } : {}
      const projects = await projectService.list(params)
      set({ projects, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  fetchTags: async () => {
    const tags = await tagService.list()
    set({ tags })
  },

  createProject: async (data) => {
    const project = await projectService.create(data)
    set((s) => ({ projects: [...s.projects, project] }))
    return project
  },

  updateProject: async (id, data) => {
    const updated = await projectService.update(id, data)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }))
    return updated
  },

  deleteProject: async (id) => {
    await projectService.remove(id)
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
  },

  moveProject: async (id, status, position) => {
    const prev = get().projects
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, status, position } : p
      ),
    }))
    try {
      const updated = await projectService.move(id, status, position)
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? updated : p)),
      }))
    } catch {
      set({ projects: prev })
    }
  },

  getByStatus: (status) => {
    const { projects, filters } = get()
    return projects
      .filter((p) => {
        if (p.status !== status) return false
        if (filters.pole !== 'all' && p.pole !== filters.pole) return false
        if (filters.search) {
          const q = filters.search.toLowerCase()
          return p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => a.position - b.position)
  },

  // SSE : connexion temps réel
  initSSE: (token) => {
    // Ferme la connexion précédente si elle existe
    const prev = get()._sseSource
    if (prev) prev.close()

    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)

    es.addEventListener('project_created', () => get().fetchProjects())
    es.addEventListener('project_updated', () => get().fetchProjects())
    es.addEventListener('project_deleted', () => get().fetchProjects())

    es.onerror = () => {
      // Reconnexion automatique gérée par le navigateur, on ne ferme pas manuellement
    }

    set({ _sseSource: es })
    return es
  },

  closeSSE: () => {
    const es = get()._sseSource
    if (es) { es.close(); set({ _sseSource: null }) }
  },
}))

export default useProjectStore
