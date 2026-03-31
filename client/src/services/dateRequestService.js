import api from './api'

export const dateRequestService = {
  create: (projectId, taskId, data) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/date-requests`, data).then((r) => r.data),

  listForLead: () =>
    api.get('/date-requests').then((r) => r.data),

  listForTask: (projectId, taskId) =>
    api.get(`/projects/${projectId}/tasks/${taskId}/date-requests`).then((r) => r.data),

  approve: (id, responseNote) =>
    api.patch(`/date-requests/${id}/approve`, { response_note: responseNote || null }).then((r) => r.data),

  reject: (id, responseNote) =>
    api.patch(`/date-requests/${id}/reject`, { response_note: responseNote || null }).then((r) => r.data),
}
