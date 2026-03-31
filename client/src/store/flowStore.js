import { create } from 'zustand'
import flowService from '../services/flowService'

const useFlowStore = create((set, get) => ({
  diagrams:  [],
  loading:   false,
  error:     null,

  fetchDiagrams: async (pole) => {
    set({ loading: true, error: null })
    try {
      const diagrams = await flowService.list(pole)
      set({ diagrams, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  createDiagram: async (data) => {
    const diagram = await flowService.create(data)
    set((s) => ({ diagrams: [diagram, ...s.diagrams] }))
    return diagram
  },

  deleteDiagram: async (id) => {
    await flowService.remove(id)
    set((s) => ({ diagrams: s.diagrams.filter((d) => d.id !== id) }))
  },
}))

export default useFlowStore
