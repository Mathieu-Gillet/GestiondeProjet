import { useState, useEffect } from 'react'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import { userService } from '../../services/userService'
import { taskService } from '../../services/taskService'

const PRIORITIES = ['critical', 'high', 'normal', 'low']
const PRIORITY_LABELS = { critical: 'Critique', high: 'Haute', normal: 'Normale', low: 'Basse' }
const STATUSES = ['backlog', 'in_progress', 'on_hold', 'done']
const STATUS_LABELS = { backlog: 'Idées', in_progress: 'En cours', on_hold: 'En attente', done: 'Terminé' }

const EMPTY_TASK_INPUT = {
  title: '',
  duration_days: 1,
  start_date: '',
  due_date: '',
  earliest_start: '',
  latest_end: '',
  depends_on: '',   // temp id (string) of another formTask
  assigned_to: '',  // user id (string)
}

export default function ProjectForm({ project, onClose }) {
  const isEdit = !!project
  const { createProject, updateProject, tags } = useProjectStore()
  const user = useAuthStore((s) => s.user)
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Tâches pré-remplies à créer (seulement en mode création)
  const [formTasks, setFormTasks]     = useState([])
  const [newTaskInput, setNewTaskInput] = useState(EMPTY_TASK_INPUT)

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

  function setTask(key, value) {
    setNewTaskInput((p) => ({ ...p, [key]: value }))
  }

  function handleAddFormTask(e) {
    e.preventDefault()
    if (!newTaskInput.title.trim()) return
    setFormTasks((prev) => [
      ...prev,
      {
        id:             Date.now(),
        title:          newTaskInput.title.trim(),
        duration_days:  Math.max(0, Number(newTaskInput.duration_days) || 1),
        start_date:     newTaskInput.start_date || null,
        due_date:       newTaskInput.due_date || null,
        earliest_start: newTaskInput.earliest_start || null,
        latest_end:     newTaskInput.latest_end || null,
        depends_on:     newTaskInput.depends_on ? Number(newTaskInput.depends_on) : null,
        assigned_to:    newTaskInput.assigned_to ? Number(newTaskInput.assigned_to) : null,
      },
    ])
    setNewTaskInput(EMPTY_TASK_INPUT)
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
        // Créer les tâches séquentiellement en résolvant les dépendances
        const idMap = {}  // tempId → realId
        for (const t of formTasks) {
          const task = await taskService.create(created.id, {
            title:          t.title,
            duration_days:  t.duration_days,
            start_date:     t.start_date || null,
            due_date:       t.due_date || null,
            earliest_start: t.earliest_start || null,
            latest_end:     t.latest_end || null,
            depends_on:     t.depends_on ? (idMap[t.depends_on] ?? null) : null,
            assigned_to:    t.assigned_to || null,
          })
          idMap[t.id] = task.id
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

  // Membres disponibles pour affectation de tâche :
  // priorité aux membres déjà sélectionnés, sinon tous les utilisateurs
  const assignableUsers = form.member_ids.length > 0
    ? users.filter((u) => form.member_ids.includes(u.id))
    : users

  // Résout le nom d'un membre depuis son id
  function userName(id) {
    return users.find((u) => u.id === id)?.username || `#${id}`
  }

  // Résout le titre d'une tâche depuis son tempId
  function taskTitle(tempId) {
    return formTasks.find((t) => t.id === tempId)?.title || `tâche #${tempId}`
  }

  // Tâche précédente possible pour le champ depends_on du formulaire
  // (on ne peut dépendre que d'une tâche déjà ajoutée)
  const availableDeps = formTasks

  // Min start_date pour la nouvelle tâche (dépend de la tâche précédente sélectionnée)
  const depTask = newTaskInput.depends_on
    ? formTasks.find((t) => t.id === Number(newTaskInput.depends_on))
    : null
  const minStart = depTask?.due_date || form.start_date || ''

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '98vw', maxWidth: '1600px', height: '95vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
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

        {/* ── Corps : deux colonnes égales ── */}
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

          {/* ── Colonne droite : tâches initiales (création uniquement) ── */}
          {!isEdit && (
            <div className="flex-1 min-w-0 flex flex-col bg-gray-50/60">

              {/* En-tête panneau tâches */}
              <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">
                      Tâches initiales
                      <span className="ml-1.5 text-gray-400 font-normal">({formTasks.length})</span>
                      {totalTaskDays > 0 && (
                        <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-normal">
                          {totalTaskDays}j total
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Optionnel — créées avec le projet</p>
                  </div>
                </div>
              </div>

              {/* Liste des tâches ajoutées */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {formTasks.length === 0 && (
                  <p className="text-xs text-gray-400 italic text-center py-8">
                    Utilisez le formulaire ci-dessous pour ajouter des tâches
                  </p>
                )}
                {formTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-1.5"
                  >
                    {/* Ligne principale */}
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-800 leading-snug">{task.title}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                        {task.duration_days}j
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFormTask(task.id)}
                        className="text-gray-300 hover:text-red-400 flex-shrink-0 text-base leading-none"
                        title="Supprimer"
                      >✕</button>
                    </div>
                    {/* Infos secondaires */}
                    <div className="pl-8 flex flex-wrap gap-x-3 gap-y-0.5">
                      {(task.start_date || task.due_date) && (
                        <span className="text-xs text-gray-400">
                          📅 {task.start_date || '?'}{task.due_date ? ` → ${task.due_date}` : ''}
                        </span>
                      )}
                      {(task.earliest_start || task.latest_end) && (
                        <span className="text-xs text-purple-500">
                          ⏰ {task.earliest_start && `≥ ${task.earliest_start}`}{task.earliest_start && task.latest_end && ' · '}{task.latest_end && `≤ ${task.latest_end}`}
                        </span>
                      )}
                      {task.depends_on && (
                        <span className="text-xs text-orange-500">
                          ⛓ après «{taskTitle(task.depends_on)}»
                        </span>
                      )}
                      {task.assigned_to && (
                        <span className="text-xs text-indigo-500">
                          👤 {userName(task.assigned_to)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Formulaire ajout tâche ── */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-white">
                <form onSubmit={handleAddFormTask} className="px-4 py-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nouvelle tâche</p>

                  {/* Titre + durée */}
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newTaskInput.title}
                      onChange={(e) => setTask('title', e.target.value)}
                      placeholder="Titre de la tâche *"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="number"
                        min="0"
                        value={newTaskInput.duration_days}
                        onChange={(e) => setTask('duration_days', e.target.value)}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-gray-400">j</span>
                    </div>
                  </div>

                  {/* Dates planifiées */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Début{minStart && <span className="text-orange-400 ml-1">min {minStart}</span>}
                      </label>
                      <input
                        type="date"
                        value={newTaskInput.start_date}
                        min={minStart}
                        onChange={(e) => setTask('start_date', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fin</label>
                      <input
                        type="date"
                        value={newTaskInput.due_date}
                        min={newTaskInput.start_date || minStart}
                        onChange={(e) => setTask('due_date', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Contraintes au plus tôt / au plus tard */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Au plus tôt</label>
                      <input
                        type="date"
                        value={newTaskInput.earliest_start}
                        onChange={(e) => setTask('earliest_start', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Au plus tard</label>
                      <input
                        type="date"
                        value={newTaskInput.latest_end}
                        onChange={(e) => setTask('latest_end', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Dépend de + Assignée à */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tâche précédente</label>
                      <select
                        value={newTaskInput.depends_on}
                        onChange={(e) => setTask('depends_on', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={availableDeps.length === 0}
                      >
                        <option value="">— aucune —</option>
                        {availableDeps.map((t) => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Assignée à</label>
                      <select
                        value={newTaskInput.assigned_to}
                        onChange={(e) => setTask('assigned_to', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={assignableUsers.length === 0}
                      >
                        <option value="">— non assignée —</option>
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    + Ajouter la tâche
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
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
