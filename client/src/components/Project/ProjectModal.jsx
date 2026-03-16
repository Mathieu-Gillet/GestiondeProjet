import { useState, useEffect } from 'react'
import { projectService } from '../../services/projectService'
import { taskService } from '../../services/taskService'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import ProjectForm from './ProjectForm'
import { PRIORITY_CONFIG, POLE_CONFIG, STATUS_CONFIG, formatDate, isOverdue } from '../../utils/format'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function ProjectModal({ projectId, onClose }) {
  const [project, setProject]       = useState(null)
  const [comments, setComments]     = useState([])
  const [activity, setActivity]     = useState([])
  const [tasks, setTasks]           = useState([])
  const [newComment, setNewComment] = useState('')
  const [newTask, setNewTask]       = useState({ title: '', duration_days: 1, start_date: '', due_date: '', depends_on: '', assigned_to: '' })
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTask, setEditingTask]     = useState({})
  const [activeTab, setActiveTab]   = useState('comments')
  const [showEdit, setShowEdit]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const { deleteProject } = useProjectStore()
  const user = useAuthStore((s) => s.user)

  const canEdit = user?.role === 'admin' || (user?.role === 'lead' && user?.pole === project?.pole)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [p, c, a, t] = await Promise.all([
        projectService.get(projectId),
        projectService.getComments(projectId),
        projectService.getActivity(projectId),
        taskService.list(projectId),
      ])
      setProject(p)
      setComments(c)
      setActivity(a)
      setTasks(t)
    } catch (err) {
      setError('Impossible de charger le projet. Vérifiez que le serveur est démarré.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projectId])

  // SSE : recharger les tâches si un autre utilisateur les modifie
  useEffect(() => {
    const store = useProjectStore.getState()
    const es = store._sseSource
    if (!es) return
    function onTasksUpdated(e) {
      const data = JSON.parse(e.data || '{}')
      if (data.project_id === projectId) taskService.list(projectId).then(setTasks)
    }
    es.addEventListener('tasks_updated', onTasksUpdated)
    return () => es.removeEventListener('tasks_updated', onTasksUpdated)
  }, [projectId])

  async function handleAddComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    const comment = await projectService.addComment(projectId, newComment)
    setComments((prev) => [...prev, comment])
    setNewComment('')
  }

  async function handleDeleteComment(commentId) {
    await projectService.deleteComment(projectId, commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  async function handleAddTask(e) {
    e.preventDefault()
    if (!newTask.title.trim()) return
    const payload = {
      title: newTask.title.trim(),
      duration_days: Math.max(0, Number(newTask.duration_days) || 1),
    }
    if (newTask.start_date)  payload.start_date  = newTask.start_date
    if (newTask.due_date)    payload.due_date    = newTask.due_date
    if (newTask.depends_on)  payload.depends_on  = Number(newTask.depends_on)
    if (newTask.assigned_to) payload.assigned_to = Number(newTask.assigned_to)

    const task = await taskService.create(projectId, payload)
    setTasks((prev) => [...prev, task])
    setNewTask({ title: '', duration_days: 1, start_date: '', due_date: '', depends_on: '', assigned_to: '' })
  }

  async function handleToggleTask(task) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    const updated = await taskService.update(projectId, task.id, { status: nextStatus })
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
  }

  async function handleDeleteTask(taskId) {
    await taskService.remove(projectId, taskId)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  function handleStartEditTask(task) {
    setEditingTaskId(task.id)
    setEditingTask({
      title: task.title,
      duration_days: task.duration_days ?? 1,
      start_date: task.start_date ?? '',
      due_date: task.due_date ?? '',
      depends_on: task.depends_on ?? '',
      assigned_to: task.assigned_to ?? '',
    })
  }

  async function handleSaveTask(e) {
    e.preventDefault()
    const updated = await taskService.update(projectId, editingTaskId, {
      title: editingTask.title.trim(),
      duration_days: Math.max(0, Number(editingTask.duration_days) || 1),
      start_date: editingTask.start_date || null,
      due_date: editingTask.due_date || null,
      depends_on: editingTask.depends_on ? Number(editingTask.depends_on) : null,
      assigned_to: editingTask.assigned_to ? Number(editingTask.assigned_to) : null,
    })
    setTasks((prev) => prev.map((t) => (t.id === editingTaskId ? updated : t)))
    setEditingTaskId(null)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce projet ?')) return
    await deleteProject(projectId)
    onClose()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-gray-500 flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Chargement…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-8 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-red-600 font-medium mb-3">{error}</p>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Fermer</button>
        </div>
      </div>
    )
  }

  if (!project) return null

  const priority = PRIORITY_CONFIG[project.priority]
  const pole     = POLE_CONFIG[project.pole]
  const status   = STATUS_CONFIG[project.status]
  const overdue  = isOverdue(project.due_date) && project.status !== 'done'

  const totalTaskDays = tasks.reduce((sum, t) => sum + (t.duration_days || 0), 0)
  const doneTasks     = tasks.filter((t) => t.status === 'done').length
  const projectDays   = (project.start_date && project.due_date)
    ? differenceInDays(parseISO(project.due_date), parseISO(project.start_date)) + 1
    : null
  const taskOverrun = projectDays !== null && totalTaskDays > projectDays

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        {/* Fenêtre large — 90 vw, max 1200px, 85 vh */}
        <div
          className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ width: '90vw', maxWidth: '1200px', height: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4 bg-white">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${pole?.color}`}>{pole?.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>{priority.label}</span>
                {overdue && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">En retard</span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{project.title}</h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && (
                <>
                  <button
                    onClick={() => setShowEdit(true)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-xs px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                  >
                    Supprimer
                  </button>
                </>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 ml-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Corps : panneau gauche + panneau droit ── */}
          <div className="flex flex-1 min-h-0">

            {/* ── Panneau gauche : détails + onglets ── */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                {project.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {project.owner && (
                    <div>
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Responsable</span>
                      <p className="font-medium mt-0.5">{project.owner.username}</p>
                    </div>
                  )}
                  {(project.start_date || project.due_date) && (
                    <div>
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Dates</span>
                      <p className="font-medium mt-0.5">
                        {project.start_date && <span>{formatDate(project.start_date)}</span>}
                        {project.start_date && project.due_date && <span className="text-gray-400 mx-1">→</span>}
                        {project.due_date && (
                          <span className={overdue ? 'text-red-600' : ''}>
                            {formatDate(project.due_date)}
                          </span>
                        )}
                        {projectDays && (
                          <span className="text-gray-400 font-normal ml-1.5">({projectDays}j)</span>
                        )}
                      </p>
                    </div>
                  )}
                  {(project.earliest_start || project.latest_end) && (
                    <div className="col-span-2">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Contraintes</span>
                      <p className="font-medium mt-0.5 text-xs text-gray-600">
                        {project.earliest_start && `Au plus tôt : ${formatDate(project.earliest_start)}`}
                        {project.earliest_start && project.latest_end && ' · '}
                        {project.latest_end && `Au plus tard : ${formatDate(project.latest_end)}`}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Créé le</span>
                    <p className="font-medium mt-0.5">{formatDate(project.created_at)}</p>
                  </div>
                </div>

                {/* Members */}
                {project.members?.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Membres</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {project.members.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-2.5 py-1">
                          <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold uppercase">
                            {m.username[0]}
                          </div>
                          <span className="text-xs font-medium">{m.username}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {project.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: tag.color + '22', color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tabs : Commentaires | Activité */}
                <div className="border-b border-gray-200">
                  <div className="flex gap-4">
                    {[
                      { id: 'comments', label: `Commentaires (${comments.length})` },
                      { id: 'activity', label: 'Activité' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Commentaires ── */}
                {activeTab === 'comments' && (
                  <div className="space-y-3">
                    {comments.length === 0 && (
                      <p className="text-sm text-gray-400 italic">Aucun commentaire</p>
                    )}
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold uppercase flex-shrink-0 mt-0.5">
                          {c.username?.[0] || '?'}
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{c.username}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {format(parseISO(c.created_at), 'd MMM, HH:mm', { locale: fr })}
                              </span>
                              {(c.author_id === user?.id || user?.role === 'admin') && (
                                <button
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="text-gray-300 hover:text-red-400 text-xs"
                                >✕</button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-700">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <form onSubmit={handleAddComment} className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Ajouter un commentaire..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                      >
                        Envoyer
                      </button>
                    </form>
                  </div>
                )}

                {/* ── Activité ── */}
                {activeTab === 'activity' && (
                  <div className="space-y-2">
                    {activity.length === 0 && (
                      <p className="text-sm text-gray-400 italic">Aucune activité</p>
                    )}
                    {activity.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium">{a.username || 'Système'}</span>{' '}
                          <span className="text-gray-500">
                            {a.action === 'created' && 'a créé ce projet'}
                            {a.action === 'updated' && 'a modifié ce projet'}
                            {a.action === 'commented' && 'a commenté'}
                            {a.action === 'status_changed' && (() => {
                              const d = a.detail ? JSON.parse(a.detail) : {}
                              return `a déplacé de "${STATUS_CONFIG[d.from]?.label}" vers "${STATUS_CONFIG[d.to]?.label}"`
                            })()}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            {format(parseISO(a.created_at), 'd MMM, HH:mm', { locale: fr })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Panneau droit : Tâches ── */}
            <div className="w-80 flex-shrink-0 flex flex-col bg-gray-50/60">
              {/* En-tête panneau tâches */}
              <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Tâches
                    <span className="ml-1.5 text-gray-400 font-normal">({tasks.length})</span>
                  </h3>
                  {tasks.length > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      taskOverrun ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {totalTaskDays}j total
                    </span>
                  )}
                </div>

                {/* Barre progression + résumé durée */}
                {tasks.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0)}%` }}
                        />
                      </div>
                      <span>{doneTasks}/{tasks.length}</span>
                    </div>
                    {projectDays && (
                      <p className={`text-xs ${taskOverrun ? 'text-red-600' : 'text-gray-400'}`}>
                        {taskOverrun
                          ? `⚠ +${totalTaskDays - projectDays}j vs durée projet (${projectDays}j)`
                          : `✓ ${projectDays - totalTaskDays}j de marge (projet : ${projectDays}j)`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Liste des tâches */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                {tasks.length === 0 && (
                  <p className="text-xs text-gray-400 italic text-center py-6">
                    Aucune tâche pour ce projet
                  </p>
                )}
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`rounded-lg border transition-colors ${
                      task.status === 'done'
                        ? 'bg-white border-gray-100 opacity-60'
                        : 'bg-white border-gray-200'
                    } ${task.depends_on ? 'ml-4 border-l-2 border-l-orange-200' : ''}`}
                  >
                    {/* ── Mode édition inline ── */}
                    {editingTaskId === task.id ? (
                      <form onSubmit={handleSaveTask} className="px-3 py-2 space-y-2">
                        <input
                          type="text"
                          value={editingTask.title}
                          onChange={(e) => setEditingTask((p) => ({ ...p, title: e.target.value }))}
                          className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <div className="flex gap-2 items-center">
                          <label className="text-[10px] text-gray-400 flex-shrink-0">Durée :</label>
                          <input
                            type="number" min="0"
                            value={editingTask.duration_days}
                            onChange={(e) => setEditingTask((p) => ({ ...p, duration_days: e.target.value }))}
                            className="w-12 border border-gray-300 rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] text-gray-400">j</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400 block mb-0.5">Début</label>
                            <input type="date" value={editingTask.start_date}
                              onChange={(e) => setEditingTask((p) => ({ ...p, start_date: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400 block mb-0.5">Fin</label>
                            <input type="date" value={editingTask.due_date}
                              onChange={(e) => setEditingTask((p) => ({ ...p, due_date: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        {tasks.length > 1 && (
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Dépend de :</label>
                            <select value={editingTask.depends_on}
                              onChange={(e) => setEditingTask((p) => ({ ...p, depends_on: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">— aucune —</option>
                              {tasks.filter((t) => t.id !== task.id).map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {project.members?.length > 0 && (
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Assignée à :</label>
                            <select value={editingTask.assigned_to}
                              onChange={(e) => setEditingTask((p) => ({ ...p, assigned_to: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">— non assignée —</option>
                              {project.members.map((m) => (
                                <option key={m.id} value={m.id}>{m.username}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button type="submit"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1.5 rounded-lg transition-colors"
                          >Enregistrer</button>
                          <button type="button" onClick={() => setEditingTaskId(null)}
                            className="flex-1 border border-gray-300 text-gray-500 hover:bg-gray-50 text-xs px-2 py-1.5 rounded-lg transition-colors"
                          >Annuler</button>
                        </div>
                      </form>
                    ) : (
                      /* ── Vue normale ── */
                      <div className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          {/* Checkbox */}
                          {canEdit ? (
                            <button
                              onClick={() => handleToggleTask(task)}
                              className={`rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                task.status === 'done'
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-gray-300 hover:border-indigo-400'
                              }`}
                              style={{ width: 18, height: 18 }}
                            >
                              {task.status === 'done' && (
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ) : (
                            <div
                              className={`rounded border-2 flex-shrink-0 flex items-center justify-center ${
                                task.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'
                              }`}
                              style={{ width: 18, height: 18 }}
                            >
                              {task.status === 'done' && (
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}

                          <span className={`flex-1 text-xs leading-snug ${
                            task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'
                          }`}>
                            {task.title}
                          </span>

                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {task.duration_days}j
                          </span>

                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleStartEditTask(task)}
                                className="text-gray-300 hover:text-indigo-500 flex-shrink-0"
                                title="Modifier la tâche"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-gray-300 hover:text-red-400 flex-shrink-0 text-xs"
                              >✕</button>
                            </>
                          )}
                        </div>

                        {/* Dates, dépendance et assignee */}
                        {(task.start_date || task.due_date || task.depends_on_title || task.assigned_to_username) && (
                          <div className="mt-1 pl-6 flex flex-wrap gap-x-3 gap-y-0.5">
                            {(task.start_date || task.due_date) && (
                              <span className="text-[10px] text-gray-400">
                                {task.start_date && formatDate(task.start_date)}
                                {task.start_date && task.due_date && ' → '}
                                {task.due_date && formatDate(task.due_date)}
                              </span>
                            )}
                            {task.depends_on_title && (
                              <span className="text-[10px] text-orange-500" title="Dépendance">
                                ⛓ après «{task.depends_on_title}»
                              </span>
                            )}
                            {task.assigned_to_username && (
                              <span className="text-[10px] text-indigo-500 flex items-center gap-0.5">
                                <span>👤</span> {task.assigned_to_username}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Formulaire ajout tâche */}
              {canEdit && (
                <div className="flex-shrink-0 px-3 py-3 border-t border-gray-200 bg-white">
                  <form onSubmit={handleAddTask} className="space-y-2">
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Titre de la tâche..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-gray-500 flex-shrink-0">Durée :</label>
                      <input
                        type="number"
                        min="0"
                        value={newTask.duration_days}
                        onChange={(e) => setNewTask((p) => ({ ...p, duration_days: e.target.value }))}
                        className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-gray-400">j</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 block mb-0.5">Début</label>
                        <input
                          type="date"
                          value={newTask.start_date}
                          onChange={(e) => setNewTask((p) => ({ ...p, start_date: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 block mb-0.5">Fin</label>
                        <input
                          type="date"
                          value={newTask.due_date}
                          onChange={(e) => setNewTask((p) => ({ ...p, due_date: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    {tasks.length > 0 && (
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Dépend de (commence après) :</label>
                        <select
                          value={newTask.depends_on}
                          onChange={(e) => setNewTask((p) => ({ ...p, depends_on: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— aucune dépendance —</option>
                          {tasks.map((t) => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {project.members?.length > 0 && (
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Assignée à :</label>
                        <select
                          value={newTask.assigned_to}
                          onChange={(e) => setNewTask((p) => ({ ...p, assigned_to: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— non assignée —</option>
                          {project.members.map((m) => (
                            <option key={m.id} value={m.id}>{m.username}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      + Ajouter la tâche
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <ProjectForm
          project={project}
          onClose={() => { setShowEdit(false); load() }}
        />
      )}
    </>
  )
}
