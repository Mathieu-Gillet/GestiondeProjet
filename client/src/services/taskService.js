import api from './api'

export const taskService = {
  list: (projectId) =>
    api.get(`/projects/${projectId}/tasks`).then((r) => r.data),
  create: (projectId, data) =>
    api.post(`/projects/${projectId}/tasks`, data).then((r) => r.data),
  update: (projectId, taskId, data) =>
    api.put(`/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data),
  remove: (projectId, taskId) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
}
