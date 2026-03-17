import { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import api from '../../services/api'
import { taskService } from '../../services/taskService'
import { formatDate, isOverdue, POLE_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG } from '../../utils/format'
import ProjectModal from '../Project/ProjectModal'

// ─── Helpers ────────────────────────────────────────────────────────────────

const TASK_STATUS = {
  todo:        { label: 'À faire',  color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  done:        { label: 'Terminé',  color: 'bg-green-100 text-green-700' },
}

// ─── Composants ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-gray-400">{icon}</span>
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      {count != null && (
        <span className="ml-1 text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  )
}

function ProjectCard({ project, onOpen }) {
  const statusCfg = STATUS_CONFIG[project.status]   || {}
  const poleCfg   = POLE_CONFIG[project.pole]       || {}
  const prioCfg   = PRIORITY_CONFIG[project.priority] || {}
  const overdue   = isOverdue(project.due_date) && project.status !== 'done'

  return (
    <div
      onClick={() => onOpen(project.id)}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${prioCfg.dot || 'bg-gray-300'}`} />
        <h3 className="flex-1 font-medium text-sm text-gray-900 group-hover:text-indigo-700 transition-colors leading-snug">
          {project.title}
        </h3>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${poleCfg.color || 'bg-gray-100 text-gray-600'}`}>
          {poleCfg.label || project.pole}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCfg.color || 'bg-gray-100 text-gray-600'}`}>
          {statusCfg.label || project.status}
        </span>
        {project.tags?.map((t) => (
          <span
            key={t.id}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
            style={{ background: t.color }}
          >
            {t.name}
          </span>
        ))}
      </div>

      {(project.due_date || project.start_date) && (
        <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {project.start_date && <span>{formatDate(project.start_date)}</span>}
          {project.start_date && project.due_date && <span>→</span>}
          {project.due_date && <span>{formatDate(project.due_date)}{overdue ? ' (en retard)' : ''}</span>}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onToggleDone, onSaveNotes }) {
  const [toggling,      setToggling]      = useState(false)
  const [showNotes,     setShowNotes]     = useState(false)
  const [notesValue,    setNotesValue]    = useState(task.notes || '')
  const poleCfg  = POLE_CONFIG[task.project_pole] || {}
  const overdue  = isOverdue(task.due_date) && task.status !== 'done'
  const isDone   = task.status === 'done'

  async function handleToggle(e) {
    e.stopPropagation()
    setToggling(true)
    try { await onToggleDone(task) } finally { setToggling(false) }
  }

  async function handleBlurNotes() {
    if (notesValue === (task.notes || '')) return
    await onSaveNotes(task, notesValue || null)
  }

  return (
    <div className={`rounded-lg border transition-colors ${isDone ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
      <div className="flex items-center gap-3 p-3">
        {/* Bouton statut */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={isDone ? 'Marquer comme à faire' : 'Changer le statut'}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isDone
              ? 'bg-green-100 border-green-400 hover:bg-green-200'
              : task.status === 'in_progress'
              ? 'bg-blue-50 border-blue-400 hover:bg-blue-100'
              : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
          } ${toggling ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isDone && (
            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {task.status === 'in_progress' && !isDone && (
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
              <span className="truncate max-w-[160px]">{task.project_title}</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${poleCfg.color || 'bg-gray-100 text-gray-500'}`}>
              {poleCfg.label || task.project_pole}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            {task.due_date && (
              <p className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                {overdue ? '⚠ ' : ''}{formatDate(task.due_date)}
              </p>
            )}
            {task.duration_days > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">{task.duration_days}j</p>
            )}
          </div>
          {/* Bouton notes */}
          <button
            onClick={() => setShowNotes((v) => !v)}
            title={showNotes ? 'Masquer les notes' : 'Afficher / ajouter des notes'}
            className={`p-1 rounded transition-colors ${
              showNotes ? 'text-indigo-600' : task.notes ? 'text-amber-500 hover:text-amber-700' : 'text-gray-300 hover:text-gray-500'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notes expandables */}
      {showNotes && (
        <div className="px-3 pb-3">
          <textarea
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-indigo-50/30"
            rows={4}
            placeholder="Notes, avancement, points de blocage..."
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            onBlur={handleBlurNotes}
            autoFocus
          />
          <p className="text-[10px] text-gray-400 mt-1">Sauvegardé automatiquement à la perte du focus.</p>
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
  const [selectedId,   setSelectedId]   = useState(null)   // projectId for modal
  const [taskFilter,   setTaskFilter]   = useState('active') // 'active' | 'all'

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

  // Cycle statut todo → in_progress → done → todo
  const STATUS_CYCLE = ['todo', 'in_progress', 'done']
  async function handleToggleDone(task) {
    const idx = STATUS_CYCLE.indexOf(task.status)
    const newStatus = STATUS_CYCLE[(idx + 1) % 3]
    await taskService.patchStatus(task.project_id, task.id, newStatus)
    setTasks((prev) =>
      prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t)
    )
  }

  async function handleSaveNotes(task, notes) {
    const updated = await taskService.patchNotes(task.project_id, task.id, notes)
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, notes: updated.notes } : t))
  }

  const activeTasks  = tasks.filter((t) => t.status !== 'done')
  const doneTasks    = tasks.filter((t) => t.status === 'done')
  const visibleTasks = taskFilter === 'active' ? activeTasks : tasks
  const overdueCount = activeTasks.filter((t) => isOverdue(t.due_date)).length

  return (
    <div className="max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg uppercase">
            {user?.username?.[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{user?.username}</h1>
            <p className="text-sm text-gray-500 capitalize">
              {user?.role === 'admin' ? 'Administrateur' : user?.role === 'lead' ? 'Responsable' : 'Membre'}
              {user?.pole ? ` · Pôle ${POLE_CONFIG[user.pole]?.label || user.pole}` : ''}
            </p>
          </div>
        </div>

        {/* Compteurs */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Mes projets ─────────────────────────────────── */}
        <section>
          <SectionTitle
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            }
            title="Mes projets"
            count={projects.length}
          />

          {loadingProj ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
              <p className="text-sm">Vous n'êtes membre d'aucun projet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={setSelectedId} />
              ))}
            </div>
          )}
        </section>

        {/* ── Mes tâches ──────────────────────────────────── */}
        <section>
          <div className="flex items-start justify-between mb-4">
            <SectionTitle
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
              title="Mes tâches"
              count={activeTasks.length}
            />
            {doneTasks.length > 0 && (
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTaskFilter('active')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${taskFilter === 'active' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Actives
                </button>
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${taskFilter === 'all' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Toutes
                </button>
              </div>
            )}
          </div>

          {loadingTasks ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-sm">Aucune tâche assignée.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleTasks.map((t) => (
                <TaskRow key={t.id} task={t} onToggleDone={handleToggleDone} onSaveNotes={handleSaveNotes} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal projet */}
      {selectedId && (
        <ProjectModal
          projectId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
