import api from './api'

export const authService = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me').then((r) => r.data),
}
