import api from './api'

export const exportService = {
  downloadProjects: async () => {
    const year = new Date().getFullYear()
    const response = await api.get('/export/projects', { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `projets_${year}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}
