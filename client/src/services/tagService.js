import api from './api'

export const tagService = {
  list: () => api.get('/tags').then((r) => r.data),
  create: (name, color) => api.post('/tags', { name, color }).then((r) => r.data),
  update: (id, name, color) => api.put(`/tags/${id}`, { name, color }).then((r) => r.data),
  remove: (id) => api.delete(`/tags/${id}`).then((r) => r.data),
}
