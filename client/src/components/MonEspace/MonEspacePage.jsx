import { useEffect, useState, useRef } from 'react'
import {
  format, parseISO,
  addDays, subDays, differenceInDays,
  startOfDay, isSameDay, startOfMonth, endOfMonth,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import useAuthStore from '../../store/authStore'
import api from '../../services/api'
import { taskService } from '../../services/taskService'
import { formatDate, isOverdue, SERVICE_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG, formatDuration } from '../../utils/format'
import ProjectModal from '../Project/ProjectModal'

const TASK_STATUS_CFG = {
  todo:        { label: 'À faire',  cls: 'bg-gray-100 text-gray-600 border-gray-300' },
  in_progress: { label: 'En cours', cls: 'bg-blue-100 text-blue-700 border-blue-400' },
  done:        { label: 'Terminé',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-500' },
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

        {/* Sélecteur statut */}
        <select
          value={task.status}
          onChange={(e) => onCycleStatus(task, e.target.value)}
          title="Changer le statut"
          className={`flex-shrink-0 rounded border-2 text-xs font-semibold px-1 py-0.5 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${cfg.cls}`}
        >
          <option value="todo">À faire</option>
          <option value="in_progress">En cours</option>
          <option value="done">Terminé</option>
        </select>

        <div className="flex-1" />

        {/* Titre + notes */}
        <div className="flex-[3] min-w-0">
          <span className={`text-base ${
            task.status === 'done' ? 'line-through text-gray-400' :
            task.status === 'in_progress' ? 'text-blue-700 font-medium' : 'text-gray-800'
          }`}>
            {task.title}
          </span>
          {task.notes && (
            <p className="mt-0.5 text-xs text-gray-500 italic leading-snug">{task.notes}</p>
          )}
        </div>

        {/* Durée */}
        {(task.duration_days > 0 || task.duration_hours > 0) && (
          <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
            {formatDuration(task.duration_days, task.duration_hours)}
          </span>
        )}

        {/* Dates */}
        <div className="flex-shrink-0 w-36 text-right">
          {(task.start_date || task.due_date) ? (
            <span className={`text-xs font-bold leading-tight ${overdue ? 'text-red-600' : 'text-gray-700'}`}>
              {overdue && '⚠ '}
              {task.start_date && formatDate(task.start_date)}
              {task.start_date && task.due_date && ' → '}
              {task.due_date && formatDate(task.due_date)}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>
      </div>

      <TaskDiscussion task={task} user={user} />
    </div>
  )
}

// ─── Accordéon projet ────────────────────────────────────────────────────────

function ProjectAccordion({ project, tasks, onOpenModal, onCycleStatus, user }) {
  const [expanded, setExpanded] = useState(false)
  const statusCfg  = STATUS_CONFIG[project.status]    || {}
  const svcCfg     = SERVICE_CONFIG[project.service]  || SERVICE_CONFIG.dev
  const prioCfg    = PRIORITY_CONFIG[project.priority] || {}
  const doneTasks  = tasks.filter((t) => t.status === 'done').length
  const totalTasks = tasks.length
  const progress   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const totalHours = tasks.reduce((s, t) => s + (t.duration_days || 0) * 8 + (t.duration_hours || 0), 0)
  const doneHours  = tasks.filter((t) => t.status === 'done').reduce((s, t) => s + (t.duration_days || 0) * 8 + (t.duration_hours || 0), 0)
  const hoursProgress = totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0
  const overdue    = isOverdue(project.due_date) && project.status !== 'done'

  return (
    <div className={`rounded-xl border transition-all ${expanded ? 'border-indigo-200 shadow-sm' : 'border-gray-200 hover:border-indigo-200'}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-4 text-left"
      >
        <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 6l8 4-8 4V6z" />
        </svg>
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${prioCfg.dot || 'bg-gray-300'}`} />
        <span className="flex-1 font-semibold text-gray-900 text-base text-left">{project.title}</span>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${svcCfg.color}`}>{svcCfg.icon} {svcCfg.label}</span>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusCfg.color || ''}`}>{statusCfg.label || project.status}</span>
        {totalTasks > 0 && (
          <span className="text-sm text-gray-400 flex-shrink-0">{doneTasks}/{totalTasks}</span>
        )}
        {(project.start_date || project.due_date) && (
          <span className={`text-sm flex-shrink-0 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
            {project.start_date && formatDate(project.start_date)}
            {project.start_date && project.due_date && ' → '}
            {project.due_date && formatDate(project.due_date)}
          </span>
        )}
        <span
          onClick={(e) => { e.stopPropagation(); onOpenModal(project.id) }}
          className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded px-3 py-1 flex-shrink-0 hover:bg-indigo-50 transition-colors"
        >
          Ouvrir
        </span>
      </button>

      {totalTasks > 0 && (
        <div className="px-6 pb-2 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>{doneTasks}/{totalTasks} tâche{totalTasks > 1 ? 's' : ''}</span>
            {totalHours > 0 && <span className="font-medium text-gray-500">{doneHours}h / {totalHours}h</span>}
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden" title={`${progress}% des tâches terminées`}>
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          {totalHours > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden" title={`${hoursProgress}% des heures complétées`}>
              <div className="h-full bg-indigo-300 rounded-full transition-all" style={{ width: `${hoursProgress}%` }} />
            </div>
          )}
        </div>
      )}

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

// ─── Gantt Timeline (Chronologie Asana-style) ────────────────────────────────

const DAY_W    = 42    // px per day column
const ROW_H    = 40    // px per task row
const SEC_H    = 34    // px per section header
const LEFT_W   = 180   // px for the label panel
const HDR_MO_H = 26    // px for month header row
const HDR_DY_H = 24    // px for day header row
const DAYS_N   = 70    // total days in view window

const GANTT_SECTIONS = [
  { id: 'todo',        label: 'À faire',  barBg: '#99f6e4', barBorder: '#2dd4bf' },
  { id: 'in_progress', label: 'En cours', barBg: '#fde68a', barBorder: '#f59e0b' },
  { id: 'done',        label: 'Terminé',  barBg: '#fca5a5', barBorder: '#f87171' },
]

function toISO(d) { return format(d, 'yyyy-MM-dd') }

function GanttTimeline({ projects, allTasks, onTaskDatesChange }) {
  const today    = startOfDay(new Date())
  const [selId,  setSelId]  = useState(null)
  const [menuOpen, setMenu] = useState(false)
  const [viewStart, setVS]  = useState(subDays(today, 7))
  const [coll,   setColl]   = useState({})
  const [lTasks, setLTasks] = useState([])
  const lRef    = useRef([])
  const dragRef = useRef(null)
  const [dragId, setDragId] = useState(null)

  const viewEnd = addDays(viewStart, DAYS_N - 1)
  const sel     = projects.find((p) => p.id === selId)

  useEffect(() => { lRef.current = lTasks }, [lTasks])

  useEffect(() => {
    if (!selId) { setLTasks([]); return }
    setLTasks(allTasks.filter((t) => t.project_id === selId))
  }, [selId, allTasks])

  // Day array + month groups
  const days = Array.from({ length: DAYS_N }, (_, i) => addDays(viewStart, i))
  const months = []
  days.forEach((d, i) => {
    const key = format(d, 'yyyy-MM')
    if (!months.length || months[months.length - 1].key !== key) {
      months.push({ key, label: format(d, 'MMMM yyyy', { locale: fr }), count: 1 })
    } else {
      months[months.length - 1].count++
    }
  })

  const todayOff = differenceInDays(today, viewStart)

  // Flat row list
  const rows = []
  GANTT_SECTIONS.forEach((s) => {
    rows.push({ type: 'section', id: s.id, label: s.label })
    if (!coll[s.id]) {
      lTasks.filter((t) => t.status === s.id).forEach((t) =>
        rows.push({ type: 'task', task: t, sectionId: s.id })
      )
    }
  })

  function barOf(task) {
    const s = task.start_date ? parseISO(task.start_date) : null
    const e = task.due_date   ? parseISO(task.due_date)   : null
    if (!s && !e) return null
    const from = s || e, to = e || s
    return {
      left:  differenceInDays(from, viewStart) * DAY_W,
      width: Math.max((differenceInDays(to, from) + 1) * DAY_W, DAY_W),
    }
  }

  // Pointer drag
  function onBarDown(e, task, type) {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      taskId: task.id, pid: task.project_id, type,
      x0: e.clientX, lastDelta: null,
      s0: task.start_date ? parseISO(task.start_date) : null,
      e0: task.due_date   ? parseISO(task.due_date)   : null,
    }
    setDragId(task.id)
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current) return
      const { taskId, type, x0, s0, e0 } = dragRef.current
      const delta = Math.round((e.clientX - x0) / DAY_W)
      if (delta === dragRef.current.lastDelta) return
      dragRef.current.lastDelta = delta

      setLTasks((prev) => prev.map((t) => {
        if (t.id !== taskId) return t
        let ns = s0 ? new Date(s0) : null
        let ne = e0 ? new Date(e0) : null
        if (type === 'move') {
          if (ns) ns = addDays(ns, delta)
          if (ne) ne = addDays(ne, delta)
        } else if (type === 'left' && ns) {
          ns = addDays(ns, delta)
          if (ne && ns > ne) ns = new Date(ne)
        } else if (type === 'right' && ne) {
          ne = addDays(ne, delta)
          if (ns && ne < ns) ne = new Date(ns)
        }
        return {
          ...t,
          start_date: ns ? toISO(ns) : t.start_date,
          due_date:   ne ? toISO(ne) : t.due_date,
        }
      }))
    }

    async function onUp() {
      if (!dragRef.current) return
      const { taskId, pid } = dragRef.current
      dragRef.current = null
      setDragId(null)
      const task = lRef.current.find((t) => t.id === taskId)
      if (task) {
        await taskService.update(pid, taskId, task)
        onTaskDatesChange(task)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onTaskDatesChange])

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden select-none" style={{ cursor: dragId ? 'grabbing' : 'default' }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        {/* Project selector */}
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            <span className="max-w-[160px] truncate">{sel ? sel.title : 'Choisir un projet'}</span>
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[240px] max-h-64 overflow-y-auto py-1">
              {projects.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 italic">Aucun projet disponible</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelId(p.id); setMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      selId === p.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p.title}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <button onClick={() => setVS((v) => subDays(v, 7))} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors" title="Semaine précédente">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button
          onClick={() => setVS(subDays(today, 7))}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 font-medium transition-colors"
        >
          Aujourd'hui
        </button>
        <button onClick={() => setVS((v) => addDays(v, 7))} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors" title="Semaine suivante">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <span className="ml-auto text-xs text-gray-400 font-medium">Jours</span>
      </div>

      {/* ── Empty state ── */}
      {!selId ? (
        <div className="py-16 text-center text-gray-400" onClick={() => setMenu(false)}>
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Sélectionnez un projet pour afficher sa chronologie</p>
          <p className="text-xs text-gray-400 mt-1">Les tâches apparaîtront en barres Gantt déplaçables</p>
        </div>
      ) : (
        /* ── Main split ── */
        <div className="flex overflow-hidden" onClick={() => menuOpen && setMenu(false)} style={{ minHeight: 300 }}>

          {/* ── Left label panel ── */}
          <div className="flex-shrink-0 border-r border-gray-200 bg-white overflow-hidden" style={{ width: LEFT_W }}>
            {/* Header spacer */}
            <div style={{ height: HDR_MO_H + HDR_DY_H }} className="border-b border-gray-200 bg-gray-50 flex items-end px-3 pb-1.5">
              <span className="text-[11px] font-semibold text-indigo-600 truncate">{sel.title}</span>
            </div>
            {/* Rows */}
            {rows.map((row, i) => (
              <div
                key={i}
                style={{ height: row.type === 'section' ? SEC_H : ROW_H }}
                className={`flex items-center px-3 border-b border-gray-100 overflow-hidden ${
                  row.type === 'section' ? 'bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors' : ''
                }`}
                onClick={row.type === 'section' ? () => setColl((c) => ({ ...c, [row.id]: !c[row.id] })) : undefined}
              >
                {row.type === 'section' ? (
                  <>
                    <svg
                      className={`w-3 h-3 text-gray-400 mr-1.5 flex-shrink-0 transition-transform ${coll[row.id] ? '-rotate-90' : ''}`}
                      fill="currentColor" viewBox="0 0 20 20"
                    >
                      <path d="M6 6l8 4-8 4V6z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-600">{row.label}</span>
                    <span className="ml-auto text-[10px] text-gray-400 font-medium">
                      {lTasks.filter((t) => t.status === row.id).length}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-700 truncate pl-4">{row.task.title}</span>
                )}
              </div>
            ))}
          </div>

          {/* ── Right timeline (horizontal scroll) ── */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden relative">
            <div style={{ width: DAYS_N * DAY_W, minHeight: '100%', position: 'relative' }}>

              {/* Month header */}
              <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: HDR_MO_H }}>
                {months.map((m) => (
                  <div key={m.key} className="flex-shrink-0 border-r border-gray-200 flex items-center px-2" style={{ width: m.count * DAY_W }}>
                    <span className="text-[11px] font-semibold text-gray-600 capitalize">{m.label}</span>
                  </div>
                ))}
              </div>

              {/* Day header */}
              <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: HDR_DY_H }}>
                {days.map((d, i) => {
                  const isToday = isSameDay(d, today)
                  return (
                    <div key={i} className={`flex-shrink-0 border-r border-gray-100 flex items-center justify-center ${isToday ? 'bg-indigo-50' : ''}`} style={{ width: DAY_W }}>
                      <span className={`text-[10px] font-medium ${isToday ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                        {format(d, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Task rows */}
              {rows.map((row, ri) => {
                const h = row.type === 'section' ? SEC_H : ROW_H
                const sectionCfg = GANTT_SECTIONS.find((s) => s.id === (row.type === 'section' ? row.id : row.sectionId))

                return (
                  <div key={ri} style={{ height: h }} className={`relative border-b border-gray-100 flex ${row.type === 'section' ? 'bg-gray-50/60' : ''}`}>

                    {/* Day grid cells */}
                    {days.map((d, i) => {
                      const isToday = isSameDay(d, today)
                      return (
                        <div key={i} className={`flex-shrink-0 border-r border-gray-100 h-full ${isToday ? 'bg-indigo-50/25' : ''}`} style={{ width: DAY_W }} />
                      )
                    })}

                    {/* Today vertical line */}
                    {todayOff >= 0 && todayOff < DAYS_N && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-indigo-400/70 z-10 pointer-events-none"
                        style={{ left: (todayOff + 0.5) * DAY_W }}
                      />
                    )}

                    {/* Gantt bar (task rows only) */}
                    {row.type === 'task' && (() => {
                      const m = barOf(row.task)
                      if (!m) return (
                        <div className="absolute inset-y-0 flex items-center pointer-events-none" style={{ left: Math.max(todayOff, 2) * DAY_W }}>
                          <span className="text-[10px] text-gray-300 italic">pas de dates</span>
                        </div>
                      )
                      const isActive = dragId === row.task.id
                      return (
                        <div
                          className={`absolute z-20 rounded flex items-center overflow-hidden transition-shadow ${isActive ? 'shadow-xl' : 'shadow-sm hover:shadow-md'}`}
                          style={{
                            left: m.left, width: m.width,
                            top: 5, bottom: 5,
                            background: sectionCfg?.barBg || '#d1d5db',
                            border: `1.5px solid ${sectionCfg?.barBorder || '#9ca3af'}`,
                            cursor: isActive ? 'grabbing' : 'grab',
                          }}
                          onPointerDown={(e) => onBarDown(e, row.task, 'move')}
                        >
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-3 flex items-center justify-center z-30 cursor-ew-resize"
                            onPointerDown={(e) => { e.stopPropagation(); onBarDown(e, row.task, 'left') }}
                          >
                            <div className="w-0.5 h-3.5 rounded-full bg-black/25" />
                          </div>

                          {/* Title */}
                          <span className="flex-1 text-[11px] font-semibold text-gray-800 truncate px-4 pointer-events-none">
                            {row.task.title}
                          </span>

                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center z-30 cursor-ew-resize"
                            onPointerDown={(e) => { e.stopPropagation(); onBarDown(e, row.task, 'right') }}
                          >
                            <div className="w-0.5 h-3.5 rounded-full bg-black/25" />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
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
  const [view,         setView]         = useState('list') // 'list' | 'timeline'

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

  const tasksByProject = {}
  tasks.forEach((t) => {
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = []
    tasksByProject[t.project_id].push(t)
  })

  async function handleCycleStatus(task, newStatus) {
    await taskService.patchStatus(task.project_id, task.id, newStatus)
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  function handleTaskDatesChange(updatedTask) {
    setTasks((prev) => prev.map((t) => t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
  }

  const activeTasks  = tasks.filter((t) => t.status !== 'done')
  const doneTasks    = tasks.filter((t) => t.status === 'done')
  const overdueCount = activeTasks.filter((t) => isOverdue(t.due_date)).length
  const loading      = loadingProj || loadingTasks

  // Taux horaire du mois en cours : total des heures des tâches actives de l'utilisateur
  const thisMonthStart = startOfMonth(new Date())
  const thisMonthEnd   = endOfMonth(new Date())
  const monthlyHours = activeTasks
    .filter((t) => {
      const ref = t.due_date || t.start_date
      if (!ref) return false
      const d = parseISO(ref)
      return d >= thisMonthStart && d <= thisMonthEnd
    })
    .reduce((sum, t) => {
      const days  = (t.duration_days  || 0) * 8  // 1 jour = 8h par convention
      const hours = t.duration_hours || 0
      return sum + days + hours
    }, 0)

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
              {user?.service && SERVICE_CONFIG[user.service] ? ` · ${SERVICE_CONFIG[user.service].icon} ${SERVICE_CONFIG[user.service].label}` : ''}
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

          {monthlyHours > 0 && (
            <div className="bg-purple-50 rounded-lg border border-purple-200 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-purple-700">{monthlyHours}h</p>
                <p className="text-xs text-purple-600">ce mois-ci</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle de vue */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'list'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Liste
        </button>
        <button
          onClick={() => setView('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === 'timeline'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Chronologie
        </button>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'timeline' ? (
        <GanttTimeline projects={projects} allTasks={tasks} onTaskDatesChange={handleTaskDatesChange} />
      ) : (
        <div>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Mes projets &amp; tâches
          </h2>
          {projects.length === 0 ? (
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
      )}

      {selectedId && (
        <ProjectModal projectId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
