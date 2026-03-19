import api from './api'

export default {
  list:       (pole)       => api.get('/flows', { params: { pole } }).then((r) => r.data),
  get:        (id)         => api.get(`/flows/${id}`).then((r) => r.data),
  create:     (data)       => api.post('/flows', data).then((r) => r.data),
  update:     (id, data)   => api.put(`/flows/${id}`, data).then((r) => r.data),
  remove:     (id)         => api.delete(`/flows/${id}`),
  saveCanvas: (id, canvas) => api.put(`/flows/${id}/canvas`, canvas).then((r) => r.data),
}
