import { useState, useEffect } from 'react'
import { projectService } from '../../services/projectService'
import { taskService } from '../../services/taskService'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import ProjectForm from './ProjectForm'
import ConfirmModal from '../ConfirmModal'
import { PRIORITY_CONFIG, POLE_CONFIG, SERVICE_CONFIG, STATUS_CONFIG, formatDate, isOverdue, formatDuration, canManage, canDelete } from '../../utils/format'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function ProjectModal({ projectId, onClose }) {
  const [project, setProject]       = useState(null)
  const [comments, setComments]     = useState([])
  const [activity, setActivity]     = useState([])
  const [tasks, setTasks]           = useState([])
  const [newComment, setNewComment] = useState('')
  const [newTask, setNewTask]       = useState({ title: '', duration_days: 0, duration_hours: 0, start_date: '', due_date: '', depends_on: '', assigned_to: '', notes: '' })
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTask, setEditingTask]     = useState({})
  const [expandedDiscussionId, setExpandedDiscussionId] = useState(null)
  const [taskCommentsMap, setTaskCommentsMap]           = useState({})
  const [newTaskCommentMap, setNewTaskCommentMap]       = useState({})
  const [mainTab, setMainTab]           = useState('project')
  const [activeTab, setActiveTab]       = useState('comments')
  const [activeTaskTab, setActiveTaskTab] = useState('todo')
  const [confirmAction, setConfirmAction] = useState(null)
  const [showEdit, setShowEdit]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [taskError, setTaskError]   = useState(null)

  const { deleteProject } = useProjectStore()
  const user = useAuthStore((s) => s.user)

  const isArchived = project?.status === 'done'
  const isDG = user?.service === 'direction_generale'
  const canEdit = user?.role === 'admin' || isDG
    ? true
    : !isArchived && canManage(user) && (isDG || user?.service === project?.service)
  const canDeleteProject = canDelete(user) && (user?.role === 'admin' || isDG || user?.service === project?.service)

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
      duration_days: Math.max(0, Number(newTask.duration_days) || 0),
      duration_hours: Math.min(23, Math.max(0, Number(newTask.duration_hours) || 0)),
    }
    if (newTask.start_date)  payload.start_date  = newTask.start_date
    if (newTask.due_date)    payload.due_date    = newTask.due_date
    if (newTask.depends_on)  payload.depends_on  = Number(newTask.depends_on)
    if (newTask.assigned_to) payload.assigned_to = Number(newTask.assigned_to)
    if (newTask.notes.trim()) payload.notes      = newTask.notes.trim()

    const task = await taskService.create(projectId, payload)
    setTasks((prev) => [...prev, task])
    setNewTask({ title: '', duration_days: 0, duration_hours: 0, start_date: '', due_date: '', depends_on: '', assigned_to: '', notes: '' })
  }

  const TASK_STATUS_CFG = {
    todo:        { label: 'À faire',  cls: 'bg-gray-100 text-gray-600 border-gray-300' },
    in_progress: { label: 'En cours', cls: 'bg-blue-100 text-blue-700 border-blue-400' },
    done:        { label: 'Terminé',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-500' },
  }

  async function handleChangeTaskStatus(task, newStatus) {
    const updated = await taskService.patchStatus(projectId, task.id, newStatus)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
  }

  async function handleToggleDiscussion(task) {
    if (expandedDiscussionId === task.id) {
      setExpandedDiscussionId(null)
      return
    }
    setExpandedDiscussionId(task.id)
    if (!taskCommentsMap[task.id]) {
      const comments = await taskService.listComments(projectId, task.id)
      setTaskCommentsMap((prev) => ({ ...prev, [task.id]: comments }))
    }
  }

  async function handleAddTaskComment(e, taskId) {
    e.preventDefault()
    const content = (newTaskCommentMap[taskId] || '').trim()
    if (!content) return
    const comment = await taskService.addComment(projectId, taskId, content)
    setTaskCommentsMap((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), comment] }))
    setNewTaskCommentMap((prev) => ({ ...prev, [taskId]: '' }))
  }

  async function handleDeleteTaskComment(taskId, commentId) {
    await taskService.deleteComment(projectId, taskId, commentId)
    setTaskCommentsMap((prev) => ({ ...prev, [taskId]: prev[taskId].filter((c) => c.id !== commentId) }))
  }

  function handleDelete() {
    setConfirmAction({
      title: 'Supprimer le projet',
      message: `Supprimer définitivement "${project.title}" et toutes ses tâches ? Cette action est irréversible.`,
      onConfirm: async () => {
        setConfirmAction(null)
        await deleteProject(projectId)
        onClose()
      },
    })
  }

  async function handleDeleteTask(taskId) {
    const task = tasks.find((t) => t.id === taskId)
    setConfirmAction({
      title: 'Supprimer la tâche',
      message: `Supprimer "${task?.title}" ? Cette action est irréversible.`,
      onConfirm: async () => {
        setConfirmAction(null)
        await taskService.remove(projectId, taskId)
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      },
    })
  }

  function handleStartEditTask(task) {
    setEditingTaskId(task.id)
    setEditingTask({
      title: task.title,
      duration_days: task.duration_days ?? 0,
      duration_hours: task.duration_hours ?? 0,
      start_date: task.start_date ?? '',
      due_date: task.due_date ?? '',
      depends_on: task.depends_on ?? '',
      assigned_to: task.assigned_to ?? '',
      earliest_start: task.earliest_start ?? '',
      latest_end:     task.latest_end ?? '',
      notes:          task.notes ?? '',
    })
  }

  async function handleSaveTask(e) {
    e.preventDefault()
    setTaskError(null)
    try {
      const updated = await taskService.update(projectId, editingTaskId, {
        title: editingTask.title.trim(),
        duration_days: Math.max(0, Number(editingTask.duration_days) || 0),
        duration_hours: Math.min(23, Math.max(0, Number(editingTask.duration_hours) || 0)),
        start_date: editingTask.start_date || null,
        due_date: editingTask.due_date || null,
        depends_on: editingTask.depends_on ? Number(editingTask.depends_on) : null,
        assigned_to: editingTask.assigned_to ? Number(editingTask.assigned_to) : null,
        earliest_start: editingTask.earliest_start || null,
        latest_end:     editingTask.latest_end || null,
        notes:          editingTask.notes || null,
      })
      setTasks((prev) => prev.map((t) => (t.id === editingTaskId ? updated : t)))
      setEditingTaskId(null)
    } catch (err) {
      setTaskError(err.response?.data?.error || 'Erreur lors de la sauvegarde')
    }
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

  const priority   = PRIORITY_CONFIG[project.priority]
  const serviceCfg = SERVICE_CONFIG[project.service] || POLE_CONFIG[project.pole]
  const status     = STATUS_CONFIG[project.status]
  const overdue  = isOverdue(project.due_date) && project.status !== 'done'

  const totalTaskDays  = tasks.reduce((sum, t) => sum + (t.duration_days || 0), 0)
  const totalTaskHours = tasks.reduce((sum, t) => sum + (t.duration_days || 0) * 8 + (t.duration_hours || 0), 0)
  const doneTaskHours  = tasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + (t.duration_days || 0) * 8 + (t.duration_hours || 0), 0)
  const doneTasks      = tasks.filter((t) => t.status === 'done').length
  const projectDays   = (project.start_date && project.due_date)
    ? differenceInDays(parseISO(project.due_date), parseISO(project.start_date)) + 1
    : null
  const taskOverrun = projectDays !== null && totalTaskDays > projectDays

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2"
        onClick={onClose}
      >
        {/* Fenêtre 90 vw × 90 vh */}
        <div
          className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ width: '98vw', height: '97vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4 bg-white">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${serviceCfg?.color}`}>{serviceCfg?.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>{priority.label}</span>
                {overdue && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">En retard</span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{project.title}</h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isArchived && user?.role !== 'admin' && (
                <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg">Lecture seule</span>
              )}
              {canEdit && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  Modifier
                </button>
              )}
              {canDeleteProject && (
                <button
                  onClick={handleDelete}
                  className="text-xs px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                >
                  Supprimer
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 ml-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Onglets principaux ── */}
          <div className="flex-shrink-0 flex border-b border-gray-200 bg-gray-50/60 px-6 pt-3 gap-1">
            <button
              type="button"
              onClick={() => setMainTab('project')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                mainTab === 'project'
                  ? 'bg-white border-gray-200 text-indigo-700 -mb-px'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Projet
            </button>
            <button
              type="button"
              onClick={() => setMainTab('tasks')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                mainTab === 'tasks'
                  ? 'bg-white border-gray-200 text-indigo-700 -mb-px'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Tâches
              {tasks.length > 0 && (
                <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  mainTab === 'tasks' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tasks.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Contenu ── */}
          <div className="flex-1 min-h-0 flex flex-col">

            {/* ── Onglet Projet ── */}
            {mainTab === 'project' && (
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
            )}

            {/* ── Onglet Tâches ── */}
            {mainTab === 'tasks' && (
            <div className="flex-1 min-h-0 flex flex-col bg-gray-50/30">
              {/* En-tête tâches */}
              <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Tâches
                    <span className="ml-1.5 text-gray-400 font-normal">({tasks.length})</span>
                  </h3>
                  {tasks.length > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      taskOverrun ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {totalTaskHours}h total
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

              {/* ── Sub-tabs statuts ── */}
              <div className="flex-shrink-0 px-6 pt-3 pb-0">
                <div className="flex border-b border-gray-200">
                  {[
                    { key: 'todo',        label: 'À faire',  color: 'text-gray-600' },
                    { key: 'in_progress', label: 'En cours', color: 'text-blue-600' },
                    { key: 'done',        label: 'Terminé',  color: 'text-emerald-600' },
                  ].map(({ key, label, color }) => {
                    const count = tasks.filter((t) => t.status === key).length
                    const active = activeTaskTab === key
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTaskTab(key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                          active
                            ? `${color} border-current`
                            : 'text-gray-400 border-transparent hover:text-gray-600'
                        }`}
                      >
                        {label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                          active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Liste des tâches */}
              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
                {tasks.filter((t) => t.status === activeTaskTab).length === 0 && (
                  <p className="text-xs text-gray-400 italic text-center py-6">
                    Aucune tâche dans cet onglet
                  </p>
                )}
                {tasks.filter((t) => t.status === activeTaskTab).map((task) => {
                  const taskNum = tasks.findIndex((t) => t.id === task.id) + 1
                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border transition-colors ${
                        task.status === 'done'
                          ? 'bg-white border-gray-100 opacity-60'
                          : 'bg-white border-gray-200'
                      }`}
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
                            <input
                              type="number" min="0" max="23"
                              value={editingTask.duration_hours}
                              onChange={(e) => setEditingTask((p) => ({ ...p, duration_hours: e.target.value }))}
                              className="w-12 border border-gray-300 rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              title="Heures (0-23)"
                            />
                            <span className="text-[10px] text-gray-400">h</span>
                          </div>
                          {(() => {
                            const depEditTask = editingTask.depends_on ? tasks.find((t) => t.id === Number(editingTask.depends_on)) : null
                            const minEditStart = depEditTask?.due_date || project.start_date || ''
                            return (
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-400 block mb-0.5">
                                    Début{minEditStart && <span className="text-orange-400 ml-1">min {minEditStart}</span>}
                                  </label>
                                  <input type="date" value={editingTask.start_date} min={minEditStart}
                                    onChange={(e) => setEditingTask((p) => ({ ...p, start_date: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-gray-400 block mb-0.5">Fin</label>
                                  <input type="date" value={editingTask.due_date} min={editingTask.start_date || minEditStart}
                                    onChange={(e) => setEditingTask((p) => ({ ...p, due_date: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            )
                          })()}
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-400 block mb-0.5">Au plus tôt</label>
                              <input type="date" value={editingTask.earliest_start || ''}
                                onChange={(e) => setEditingTask((p) => ({ ...p, earliest_start: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-400 block mb-0.5">Au plus tard</label>
                              <input type="date" value={editingTask.latest_end || ''}
                                onChange={(e) => setEditingTask((p) => ({ ...p, latest_end: e.target.value }))}
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
                          {(() => {
                            const assignable = [
                              ...(project.owner ? [project.owner] : []),
                              ...(project.members || []).filter((m) => m.id !== project.owner?.id),
                            ]
                            return assignable.length > 0 ? (
                              <div>
                                <label className="text-[10px] text-gray-400 block mb-0.5">Assignée à :</label>
                                <select value={editingTask.assigned_to}
                                  onChange={(e) => setEditingTask((p) => ({ ...p, assigned_to: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">— non assignée —</option>
                                  {assignable.map((u) => (
                                    <option key={u.id} value={u.id}>{u.username}</option>
                                  ))}
                                </select>
                              </div>
                            ) : null
                          })()}
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Description / Notes</label>
                            <textarea
                              value={editingTask.notes || ''}
                              onChange={(e) => setEditingTask((p) => ({ ...p, notes: e.target.value }))}
                              placeholder="Détails, contexte, instructions…"
                              rows={2}
                              className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                          </div>
                          {taskError && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{taskError}</p>
                          )}
                          <div className="flex gap-2">
                            <button type="submit"
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1.5 rounded-lg transition-colors"
                            >Enregistrer</button>
                            <button type="button" onClick={() => { setEditingTaskId(null); setTaskError(null) }}
                              className="flex-1 border border-gray-300 text-gray-500 hover:bg-gray-50 text-xs px-2 py-1.5 rounded-lg transition-colors"
                            >Annuler</button>
                          </div>
                        </form>
                      ) : (
                        /* ── Vue normale ── */
                        <div className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {/* Numéro de tâche */}
                            <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                              task.status === 'done' ? 'bg-gray-100 text-gray-400' :
                              task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {taskNum}
                            </span>

                            {/* Sélecteur statut carré */}
                            {(() => {
                              const cfg = TASK_STATUS_CFG[task.status] || TASK_STATUS_CFG.todo
                              return (
                                <select
                                  value={task.status}
                                  onChange={(e) => handleChangeTaskStatus(task, e.target.value)}
                                  title="Changer le statut"
                                  className={`flex-shrink-0 rounded border-2 text-xs font-semibold px-1 py-0.5 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${cfg.cls}`}
                                >
                                  <option value="todo">À faire</option>
                                  <option value="in_progress">En cours</option>
                                  <option value="done">Terminé</option>
                                </select>
                              )
                            })()}

                            {/* Espace */}
                            <div className="flex-1" />

                            {/* Titre + notes */}
                            <div className="flex-[3] min-w-0">
                              <span className={`text-sm leading-snug ${
                                task.status === 'done' ? 'line-through text-gray-400' : task.status === 'in_progress' ? 'text-blue-700 font-medium' : 'text-gray-700'
                              }`}>
                                {task.title}
                              </span>
                              {task.notes && (
                                <p className="mt-0.5 text-xs text-gray-500 italic leading-snug">{task.notes}</p>
                              )}
                              {task.assigned_to_username && (
                                <p className="mt-0.5 text-xs text-indigo-500">👤 {task.assigned_to_username}</p>
                              )}
                            </div>

                            {/* Dates à droite en gras */}
                            <div className="flex-shrink-0 w-32 text-right">
                              {(task.start_date || task.due_date) ? (
                                <span className="text-xs font-bold text-gray-700 leading-tight">
                                  {task.start_date && formatDate(task.start_date)}
                                  {task.start_date && task.due_date && ' → '}
                                  {task.due_date && formatDate(task.due_date)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </div>

                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                              {formatDuration(task.duration_days, task.duration_hours)}
                            </span>

                            {canEdit && (
                              <button
                                onClick={() => handleStartEditTask(task)}
                                className="text-gray-300 hover:text-indigo-500 flex-shrink-0"
                                title="Modifier la tâche"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z"
                                  />
                                </svg>
                              </button>
                            )}
                            {canDeleteProject && (
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-gray-300 hover:text-red-400 flex-shrink-0 text-base leading-none"
                                title="Supprimer la tâche"
                              >✕</button>
                            )}
                          </div>

                          {/* Dépendance + contraintes */}
                          {task.depends_on_title && (
                            <div className="mt-1 pl-9 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span className="text-xs text-orange-500" title="Dépendance">
                                ⛓ après «{task.depends_on_title}»
                              </span>
                            </div>
                          )}

                          {/* Contraintes au plus tôt / au plus tard */}
                          {(task.earliest_start || task.latest_end) && (
                            <div className="mt-0.5 pl-9 flex flex-wrap gap-x-3 gap-y-0.5">
                              {task.earliest_start && (
                                <span className="text-xs text-purple-500">⏰ au plus tôt : {formatDate(task.earliest_start)}</span>
                              )}
                              {task.latest_end && (
                                <span className="text-xs text-red-400">⏳ au plus tard : {formatDate(task.latest_end)}</span>
                              )}
                            </div>
                          )}

                          {/* Discussion par tâche */}
                          <div className="mt-2 pl-7">
                            <button
                              onClick={() => handleToggleDiscussion(task)}
                              className={`text-xs flex items-center gap-1.5 transition-colors ${
                                expandedDiscussionId === task.id
                                  ? 'text-indigo-600 font-medium'
                                  : taskCommentsMap[task.id]?.length > 0
                                  ? 'text-indigo-500 font-medium'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {taskCommentsMap[task.id]?.length > 0
                                ? `Discussion (${taskCommentsMap[task.id].length})`
                                : 'Discussion'}
                            </button>

                            {expandedDiscussionId === task.id && (
                              <div className="mt-1.5 border border-indigo-100 rounded-lg bg-white overflow-hidden">
                                {/* Messages */}
                                <div className="max-h-44 overflow-y-auto px-3 py-2 space-y-2">
                                  {!taskCommentsMap[task.id] ? (
                                    <p className="text-xs text-gray-400 italic">Chargement…</p>
                                  ) : taskCommentsMap[task.id].length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">Pas encore de messages</p>
                                  ) : (
                                    taskCommentsMap[task.id].map((c) => (
                                      <div key={c.id} className="flex items-start gap-1.5 group">
                                        <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
                                          {c.username?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <span className="text-xs font-semibold text-gray-600">{c.username}</span>
                                          <p className="text-sm text-gray-700 break-words">{c.content}</p>
                                        </div>
                                        {(c.author_id === user?.id || user?.role === 'admin') && (
                                          <button
                                            onClick={() => handleDeleteTaskComment(task.id, c.id)}
                                            className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1"
                                          >✕</button>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                                {/* Saisie */}
                                <form
                                  onSubmit={(e) => handleAddTaskComment(e, task.id)}
                                  className="border-t border-gray-100 px-2 py-1.5 flex gap-1.5"
                                >
                                  <input
                                    type="text"
                                    value={newTaskCommentMap[task.id] || ''}
                                    onChange={(e) => setNewTaskCommentMap((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    placeholder="Écrire un message…"
                                    className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                  />
                                  <button
                                    type="submit"
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded transition-colors"
                                  >Envoyer</button>
                                </form>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Formulaire ajout tâche */}
              {canEdit && (
                <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 bg-white">
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
                      <input
                        type="number"
                        min="0" max="23"
                        value={newTask.duration_hours}
                        onChange={(e) => setNewTask((p) => ({ ...p, duration_hours: e.target.value }))}
                        className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        title="Heures (0-23)"
                      />
                      <span className="text-xs text-gray-400">h</span>
                    </div>
                    {(() => {
                      const depTask = newTask.depends_on ? tasks.find((t) => t.id === Number(newTask.depends_on)) : null
                      const minStart = depTask?.due_date || project.start_date || ''
                      const minEnd   = newTask.start_date || minStart
                      return (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400 block mb-0.5">
                              Début{minStart && <span className="text-orange-400 ml-1">min {minStart}</span>}
                            </label>
                            <input
                              type="date" value={newTask.start_date} min={minStart}
                              onChange={(e) => setNewTask((p) => ({ ...p, start_date: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400 block mb-0.5">Fin</label>
                            <input
                              type="date" value={newTask.due_date} min={minEnd}
                              onChange={(e) => setNewTask((p) => ({ ...p, due_date: e.target.value }))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      )
                    })()}
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
                    {(() => {
                      const assignable = [
                        ...(project.owner ? [project.owner] : []),
                        ...(project.members || []).filter((m) => m.id !== project.owner?.id),
                      ]
                      return assignable.length > 0 ? (
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Assignée à :</label>
                          <select
                            value={newTask.assigned_to}
                            onChange={(e) => setNewTask((p) => ({ ...p, assigned_to: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">— non assignée —</option>
                            {assignable.map((u) => (
                              <option key={u.id} value={u.id}>{u.username}</option>
                            ))}
                          </select>
                        </div>
                      ) : null
                    })()}
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Description / Notes</label>
                      <textarea
                        value={newTask.notes}
                        onChange={(e) => setNewTask((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Détails, contexte, instructions…"
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
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
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <ProjectForm
          project={project}
          onClose={() => { setShowEdit(false); load() }}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  )
}
