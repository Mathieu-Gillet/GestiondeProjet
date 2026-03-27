import api from './api'

export const notificationService = {
  list:       ()   => api.get('/notifications').then((r) => r.data),
  markRead:   (id) => api.patch(`/notifications/${id}`).then((r) => r.data),
  markAllRead:()   => api.patch('/notifications/read').then((r) => r.data),
}
