import api from './api'

export const taskService = {
  list: (projectId) =>
    api.get(`/projects/${projectId}/tasks`).then((r) => r.data),
  create: (projectId, data) =>
    api.post(`/projects/${projectId}/tasks`, data).then((r) => r.data),
  update: (projectId, taskId, data) =>
    api.put(`/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data),
  patchStatus: (projectId, taskId, status) =>
    api.patch(`/projects/${projectId}/tasks/${taskId}/status`, { status }).then((r) => r.data),
  patchNotes: (projectId, taskId, notes) =>
    api.patch(`/projects/${projectId}/tasks/${taskId}/notes`, { notes }).then((r) => r.data),
  remove: (projectId, taskId) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
  listComments: (projectId, taskId) =>
    api.get(`/projects/${projectId}/tasks/${taskId}/comments`).then((r) => r.data),
  addComment: (projectId, taskId, content) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { content }).then((r) => r.data),
  deleteComment: (projectId, taskId, commentId) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`).then((r) => r.data),
}
