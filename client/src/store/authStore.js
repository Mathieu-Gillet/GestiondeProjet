import { create } from 'zustand'
import { authService } from '../services/authService'

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),

  login: async (username, password) => {
    const data = await authService.login(username, password)
    localStorage.setItem('token', data.token)
    set({ token: data.token, user: data.user })
    return data
  },

  loginLdap: async (username, password) => {
    const data = await authService.ldapLogin(username, password)
    localStorage.setItem('token', data.token)
    set({ token: data.token, user: data.user })
    return data
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null })
  },

  fetchMe: async () => {
    try {
      const user = await authService.me()
      set({ user })
    } catch (err) {
      // Déconnecter uniquement si le token est explicitement invalide (401)
      // Ne pas déconnecter sur une erreur réseau passagère
      if (err?.response?.status === 401) {
        localStorage.removeItem('token')
        set({ token: null, user: null })
      }
    }
  },
}))

export default useAuthStore
