import { useState, useEffect } from 'react'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import { userService } from '../../services/userService'
import { taskService } from '../../services/taskService'

const PRIORITIES = ['critical', 'high', 'normal', 'low']
const PRIORITY_LABELS = { critical: 'Critique', high: 'Haute', normal: 'Normale', low: 'Basse' }
const STATUSES = ['backlog', 'in_progress', 'on_hold', 'done']
const STATUS_LABELS = { backlog: 'Idées', in_progress: 'En cours', on_hold: 'En attente', done: 'Terminé' }

export default function ProjectForm({ project, onClose }) {
  const isEdit = !!project
  const { createProject, updateProject, tags } = useProjectStore()
  const user = useAuthStore((s) => s.user)
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Tâches pré-remplies à créer (seulement en mode création)
  const [formTasks, setFormTasks]   = useState([])
  const [newTaskInput, setNewTaskInput] = useState({ title: '', duration_days: 1 })

  const defaultPole = user?.role === 'lead' ? user.pole : 'dev'

  const [form, setForm] = useState({
    title:          project?.title || '',
    description:    project?.description || '',
    pole:           project?.pole || defaultPole,
    owner_id:       project?.owner_id || null,
    status:         project?.status || 'backlog',
    priority:       project?.priority || 'normal',
    start_date:     project?.start_date || '',
    due_date:       project?.due_date || '',
    earliest_start: project?.earliest_start || '',
    latest_end:     project?.latest_end || '',
    member_ids:     project?.members?.map((m) => m.id) || [],
    tag_ids:        project?.tags?.map((t) => t.id) || [],
  })

  useEffect(() => {
    userService.list().then(setUsers).catch(() => {})
  }, [])

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleId(key, id) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter((x) => x !== id)
        : [...prev[key], id],
    }))
  }

  function handleAddFormTask(e) {
    e.preventDefault()
    if (!newTaskInput.title.trim()) return
    setFormTasks((prev) => [
      ...prev,
      { id: Date.now(), title: newTaskInput.title.trim(), duration_days: Math.max(0, Number(newTaskInput.duration_days) || 1) },
    ])
    setNewTaskInput({ title: '', duration_days: 1 })
  }

  function handleRemoveFormTask(id) {
    setFormTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        owner_id:       form.owner_id ? parseInt(form.owner_id) : null,
        start_date:     form.start_date || null,
        due_date:       form.due_date || null,
        earliest_start: form.earliest_start || null,
        latest_end:     form.latest_end || null,
      }

      if (isEdit) {
        await updateProject(project.id, payload)
      } else {
        const created = await createProject(payload)
        // Créer les tâches pré-remplies après création du projet
        for (const t of formTasks) {
          await taskService.create(created.id, { title: t.title, duration_days: t.duration_days })
        }
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const totalTaskDays = formTasks.reduce((s, t) => s + t.duration_days, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '85vw', maxWidth: '960px', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifier le projet' : 'Nouveau projet'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corps : deux colonnes */}
        <div className="flex flex-1 min-h-0">

          {/* ── Colonne gauche : champs projet ── */}
          <form
            id="project-form"
            onSubmit={handleSubmit}
            className="flex-1 min-w-0 overflow-y-auto px-6 py-4 space-y-4 border-r border-gray-200"
          >
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Pole + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pôle *</label>
                <select
                  value={form.pole}
                  onChange={(e) => set('pole', e.target.value)}
                  disabled={user?.role === 'lead'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                >
                  <option value="dev">Développement</option>
                  <option value="network">Réseau</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                <select
                  value={form.priority}
                  onChange={(e) => set('priority', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Dates planifiées */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set('due_date', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Contraintes temporelles */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Contraintes temporelles</span>
                <span className="text-xs text-gray-400">au plus tôt / au plus tard</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Au plus tôt</label>
                  <input
                    type="date"
                    value={form.earliest_start}
                    onChange={(e) => set('earliest_start', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Au plus tard</label>
                  <input
                    type="date"
                    value={form.latest_end}
                    onChange={(e) => set('latest_end', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <select
                value={form.owner_id || ''}
                onChange={(e) => set('owner_id', e.target.value || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Aucun —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                ))}
              </select>
            </div>

            {/* Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Membres impliqués</label>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleId('member_ids', u.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.member_ids.includes(u.id)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {u.username}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleId('tag_ids', tag.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.tag_ids.includes(tag.id)
                        ? 'text-white'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                    style={
                      form.tag_ids.includes(tag.id)
                        ? { backgroundColor: tag.color, borderColor: tag.color }
                        : {}
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </form>

          {/* ── Colonne droite : tâches initiales ── */}
          {!isEdit && (
            <div className="w-80 flex-shrink-0 flex flex-col bg-gray-50/60">
              {/* En-tête */}
              <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Tâches initiales
                    <span className="ml-1.5 text-gray-400 font-normal">({formTasks.length})</span>
                  </h3>
                  {formTasks.length > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {totalTaskDays}j total
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Optionnel — créées avec le projet</p>
              </div>

              {/* Liste tâches formulaire */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                {formTasks.length === 0 && (
                  <p className="text-xs text-gray-400 italic text-center py-6">
                    Ajoutez des tâches ci-dessous
                  </p>
                )}
                {formTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-white border border-gray-200"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="flex-1 text-xs text-gray-700 leading-snug">{task.title}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      {task.duration_days}j
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFormTask(task.id)}
                      className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0"
                    >✕</button>
                  </div>
                ))}
              </div>

              {/* Formulaire ajout tâche */}
              <div className="flex-shrink-0 px-3 py-3 border-t border-gray-200 bg-white">
                <form onSubmit={handleAddFormTask} className="space-y-2">
                  <input
                    type="text"
                    value={newTaskInput.title}
                    onChange={(e) => setNewTaskInput((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Titre de la tâche..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-gray-500 flex-shrink-0">Durée :</label>
                    <input
                      type="number"
                      min="0"
                      value={newTaskInput.duration_days}
                      onChange={(e) => setNewTaskInput((p) => ({ ...p, duration_days: e.target.value }))}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-400">jours</span>
                    <button
                      type="submit"
                      className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      + Ajouter
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="project-form"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {loading
              ? 'Enregistrement...'
              : isEdit
                ? 'Enregistrer'
                : formTasks.length > 0
                  ? `Créer le projet + ${formTasks.length} tâche${formTasks.length > 1 ? 's' : ''}`
                  : 'Créer le projet'}
          </button>
        </div>
      </div>
    </div>
  )
}
