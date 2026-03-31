import api from './api'

export const projectService = {
  list: (params) => api.get('/projects', { params }).then((r) => r.data),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data),
  create: (data) => api.post('/projects', data).then((r) => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/projects/${id}`).then((r) => r.data),
  move: (id, status, position) =>
    api.patch(`/projects/${id}/move`, { status, position }).then((r) => r.data),
  getComments: (id) => api.get(`/projects/${id}/comments`).then((r) => r.data),
  addComment: (id, content) =>
    api.post(`/projects/${id}/comments`, { content }).then((r) => r.data),
  deleteComment: (projectId, commentId) =>
    api.delete(`/projects/${projectId}/comments/${commentId}`).then((r) => r.data),
  getActivity: (id) => api.get(`/projects/${id}/activity`).then((r) => r.data),
  addDependency: (fromId, toId) =>
    api.post(`/projects/${fromId}/dependencies/${toId}`).then((r) => r.data),
  removeDependency: (fromId, toId) =>
    api.delete(`/projects/${fromId}/dependencies/${toId}`).then((r) => r.data),
}
