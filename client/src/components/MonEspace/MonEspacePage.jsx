import { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import api from '../../services/api'
import { taskService } from '../../services/taskService'
import { formatDate, isOverdue, POLE_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG } from '../../utils/format'
import ProjectModal from '../Project/ProjectModal'

const TASK_STATUS_CYCLE = ['todo', 'in_progress', 'done']
const TASK_STATUS_CFG = {
  todo:        { label: 'À faire',  icon: '○', cls: 'border-gray-300 hover:border-indigo-400 text-gray-300' },
  in_progress: { label: 'En cours', icon: '◑', cls: 'border-blue-400 bg-blue-50 text-blue-500' },
  done:        { label: 'Terminé',  icon: '●', cls: 'border-emerald-500 bg-emerald-50 text-emerald-600' },
}

// ─── Discussion par tâche ────────────────────────────────────────────────────

function TaskDiscussion({ task, user }) {
  const [expanded,   setExpanded]   = useState(false)
  const [comments,   setComments]   = useState(null)
  const [newComment, setNewComment] = useState('')

  async function handleToggle() {
    setExpanded((v) => !v)
    if (!comments) {
      const c = await taskService.listComments(task.project_id, task.id)
      setComments(c)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    const content = newComment.trim()
    if (!content) return
    const c = await taskService.addComment(task.project_id, task.id, content)
    setComments((prev) => [...(prev || []), c])
    setNewComment('')
  }

  async function handleDelete(commentId) {
    await taskService.deleteComment(task.project_id, task.id, commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  return (
    <div className="mt-2 pl-9">
      <button
        onClick={handleToggle}
        className={`text-xs flex items-center gap-1.5 transition-colors ${
          expanded ? 'text-indigo-600 font-medium'
          : comments?.length > 0 ? 'text-indigo-500 font-medium'
          : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {comments?.length > 0 ? `Discussion (${comments.length})` : 'Discussion'}
      </button>

      {expanded && (
        <div className="mt-1.5 border border-indigo-100 rounded-lg bg-white overflow-hidden">
          <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-2">
            {!comments ? (
              <p className="text-xs text-gray-400 italic">Chargement…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Pas encore de messages</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-1.5 group">
                  <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
                    {c.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-600">{c.username}</span>
                    <p className="text-sm text-gray-700 break-words">{c.content}</p>
                  </div>
                  {(c.author_id === user?.id || user?.role === 'admin') && (
                    <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1">✕</button>
                  )}
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleAdd} className="border-t border-gray-100 px-2 py-1.5 flex gap-1.5">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Écrire un message…"
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button type="submit" className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded transition-colors">Envoyer</button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Ligne de tâche ──────────────────────────────────────────────────────────

function TaskItem({ task, taskNum, onCycleStatus, user }) {
  const cfg    = TASK_STATUS_CFG[task.status] || TASK_STATUS_CFG.todo
  const overdue = isOverdue(task.due_date) && task.status !== 'done'

  return (
    <div className={`rounded-lg border px-4 py-3 transition-colors ${
      task.status === 'done' ? 'border-gray-100 bg-gray-50/50 opacity-70' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-3">
        {/* Numéro */}
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
          task.status === 'done' ? 'bg-gray-100 text-gray-400' :
          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {taskNum}
        </span>

        {/* Bouton statut */}
        <button
          onClick={() => onCycleStatus(task)}
          title={`Statut : ${cfg.label}`}
          className={`flex-shrink-0 rounded-full border-2 flex items-center justify-center font-bold transition-all ${cfg.cls}`}
          style={{ width: 26, height: 26, fontSize: 14 }}
        >
          {cfg.icon}
        </button>

        {/* Titre */}
        <span className={`flex-1 text-base ${
          task.status === 'done' ? 'line-through text-gray-400' :
          task.status === 'in_progress' ? 'text-blue-700 font-medium' : 'text-gray-800'
        }`}>
          {task.title}
        </span>

        {/* Date */}
        {task.due_date && (
          <span className={`text-sm flex-shrink-0 ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
            {overdue ? '⚠ ' : ''}{formatDate(task.due_date)}
          </span>
        )}
      </div>

      <TaskDiscussion task={task} user={user} />
    </div>
  )
}

// ─── Accordéon projet ────────────────────────────────────────────────────────

function ProjectAccordion({ project, tasks, onOpenModal, onCycleStatus, user }) {
  const [expanded, setExpanded] = useState(false)
  const statusCfg  = STATUS_CONFIG[project.status]  || {}
  const poleCfg    = POLE_CONFIG[project.pole]       || {}
  const prioCfg    = PRIORITY_CONFIG[project.priority] || {}
  const doneTasks  = tasks.filter((t) => t.status === 'done').length
  const totalTasks = tasks.length
  const progress   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const overdue    = isOverdue(project.due_date) && project.status !== 'done'

  return (
    <div className={`rounded-xl border transition-all ${expanded ? 'border-indigo-200 shadow-sm' : 'border-gray-200 hover:border-indigo-200'}`}>
      {/* En-tête projet (cliquable) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-4 text-left"
      >
        {/* Flèche */}
        <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 6l8 4-8 4V6z" />
        </svg>

        {/* Dot priorité */}
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${prioCfg.dot || 'bg-gray-300'}`} />

        {/* Titre */}
        <span className="flex-1 font-semibold text-gray-900 text-base text-left">{project.title}</span>

        {/* Badges */}
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${poleCfg.color || ''}`}>{poleCfg.label || project.pole}</span>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusCfg.color || ''}`}>{statusCfg.label || project.status}</span>

        {/* Tâches count + progress */}
        {totalTasks > 0 && (
          <span className="text-sm text-gray-400 flex-shrink-0">{doneTasks}/{totalTasks}</span>
        )}

        {/* Dates */}
        {(project.start_date || project.due_date) && (
          <span className={`text-sm flex-shrink-0 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
            {project.start_date && formatDate(project.start_date)}
            {project.start_date && project.due_date && ' → '}
            {project.due_date && formatDate(project.due_date)}
          </span>
        )}

        {/* Bouton ouvrir fiche */}
        <span
          onClick={(e) => { e.stopPropagation(); onOpenModal(project.id) }}
          className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded px-3 py-1 flex-shrink-0 hover:bg-indigo-50 transition-colors"
        >
          Ouvrir
        </span>
      </button>

      {/* Barre de progression */}
      {totalTasks > 0 && (
        <div className="px-6 pb-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Tâches (expanded) */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-2">Aucune tâche assignée</p>
          ) : (
            tasks.map((task, i) => (
              <TaskItem
                key={task.id}
                task={task}
                taskNum={i + 1}
                onCycleStatus={onCycleStatus}
                user={user}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function MonEspacePage() {
  const user = useAuthStore((s) => s.user)

  const [projects,     setProjects]     = useState([])
  const [tasks,        setTasks]        = useState([])
  const [loadingProj,  setLoadingProj]  = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [selectedId,   setSelectedId]   = useState(null)

  useEffect(() => {
    api.get('/users/me/projects').then((r) => {
      setProjects(r.data)
      setLoadingProj(false)
    }).catch(() => setLoadingProj(false))

    api.get('/users/me/tasks').then((r) => {
      setTasks(r.data)
      setLoadingTasks(false)
    }).catch(() => setLoadingTasks(false))
  }, [])

  // Groupe les tâches par projet
  const tasksByProject = {}
  tasks.forEach((t) => {
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = []
    tasksByProject[t.project_id].push(t)
  })

  async function handleCycleStatus(task) {
    const idx = TASK_STATUS_CYCLE.indexOf(task.status)
    const newStatus = TASK_STATUS_CYCLE[(idx + 1) % 3]
    await taskService.patchStatus(task.project_id, task.id, newStatus)
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  const activeTasks  = tasks.filter((t) => t.status !== 'done')
  const doneTasks    = tasks.filter((t) => t.status === 'done')
  const overdueCount = activeTasks.filter((t) => isOverdue(t.due_date)).length
  const loading      = loadingProj || loadingTasks

  return (
    <div className="w-full">
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl uppercase">
            {user?.username?.[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.username}</h1>
            <p className="text-base text-gray-500 capitalize">
              {user?.role === 'admin' ? 'Administrateur' : user?.role === 'lead' ? 'Responsable' : 'Membre'}
              {user?.pole ? ` · Pôle ${POLE_CONFIG[user.pole]?.label || user.pole}` : ''}
            </p>
          </div>
        </div>

        {/* Compteurs */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{projects.length}</p>
              <p className="text-xs text-gray-500">projet{projects.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{activeTasks.length}</p>
              <p className="text-xs text-gray-500">tâche{activeTasks.length !== 1 ? 's' : ''} active{activeTasks.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {doneTasks.length > 0 && (
            <div className="bg-green-50 rounded-lg border border-green-200 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-green-700">{doneTasks.length}</p>
                <p className="text-xs text-green-600">terminée{doneTasks.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}

          {overdueCount > 0 && (
            <div className="bg-red-50 rounded-lg border border-red-200 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-red-700">{overdueCount}</p>
                <p className="text-xs text-red-600">en retard</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Liste projets accordion */}
      <div>
        <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Mes projets & tâches
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Vous n'êtes membre d'aucun projet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((p) => (
              <ProjectAccordion
                key={p.id}
                project={p}
                tasks={tasksByProject[p.id] || []}
                onOpenModal={setSelectedId}
                onCycleStatus={handleCycleStatus}
                user={user}
              />
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <ProjectModal projectId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
