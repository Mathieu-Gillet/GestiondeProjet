import { useEffect, useState, useRef, useCallback } from 'react'
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { parseISO, format, getDaysInMonth, getDate } from 'date-fns'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import { POLE_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG } from '../../utils/format'
import ProjectModal from '../Project/ProjectModal'
import { taskService } from '../../services/taskService'

const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSpan(project, year) {
  const startDate = project.start_date ? parseISO(project.start_date) : null
  const dueDate   = project.due_date   ? parseISO(project.due_date)   : null

  if (!startDate && !dueDate) return null

  const startYear = startDate?.getFullYear()
  const endYear   = dueDate?.getFullYear()

  if (startDate && dueDate) {
    if (startYear > year || endYear < year) return null
  } else if (startDate) {
    if (startYear !== year) return null
  } else {
    if (endYear !== year) return null
  }

  const startMonth = startDate ? (startYear < year ? 0  : startDate.getMonth()) : 0
  const endMonth   = dueDate   ? (endYear   > year ? 11 : dueDate.getMonth())   : 11

  if (startMonth > endMonth) return null
  return { startMonth, endMonth, hasStart: !!startDate, hasEnd: !!dueDate }
}

function getTaskSpan(task, year) {
  const startDate = task.start_date ? parseISO(task.start_date) : null
  const dueDate   = task.due_date   ? parseISO(task.due_date)   : null
  if (!startDate && !dueDate) return null

  const startYear = startDate?.getFullYear()
  const endYear   = dueDate?.getFullYear()

  if (startDate && dueDate) {
    if (startYear > year || endYear < year) return null
  } else if (startDate) {
    if (startYear !== year) return null
  } else {
    if (endYear !== year) return null
  }

  const startMonth = startDate ? (startYear < year ? 0 : startDate.getMonth()) : 0
  const endMonth   = dueDate   ? (endYear   > year ? 11 : dueDate.getMonth())  : 11
  if (startMonth > endMonth) return null
  return { startMonth, endMonth }
}

function getConstraintBand(project, year) {
  const earliest = project.earliest_start ? parseISO(project.earliest_start) : null
  const latest   = project.latest_end     ? parseISO(project.latest_end)     : null
  if (!earliest && !latest) return null

  if (earliest && earliest.getFullYear() > year) return null
  if (latest   && latest.getFullYear()   < year) return null

  let startMonth = earliest
    ? (earliest.getFullYear() < year ? 0 : earliest.getMonth())
    : 0
  let endMonth = latest
    ? (latest.getFullYear() > year ? 11 : latest.getMonth())
    : 11

  return { startMonth, endMonth }
}

// ─── En-tête mois (droppable pour chips sans date) ───────────────────────────

function MonthHeaderCell({ monthIndex, isCurrentMonth }) {
  const { setNodeRef, isOver } = useDroppable({ id: `month-${monthIndex}` })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 text-center text-sm py-3 border-r border-gray-100 last:border-0 font-semibold transition-colors select-none ${
        isCurrentMonth ? 'text-amber-600 bg-amber-50/60' : 'text-gray-400'
      } ${isOver ? 'bg-indigo-100 text-indigo-600' : ''}`}
    >
      {MONTHS_SHORT[monthIndex]}
    </div>
  )
}

// ─── Ligne tâche — sous-barre Gantt ──────────────────────────────────────────
// taskNum    : numéro de cette tâche (1-based) dans la liste du projet
// depNum     : numéro de la tâche parente (ou null)

function TaskGanttRow({ task, year, taskNum, depNum }) {
  const span = getTaskSpan(task, year)
  if (!span) return null

  const { startMonth, endMonth } = span
  const barLeftPct  = (startMonth / 12) * 100
  const barRightPct = ((endMonth + 1) / 12) * 100
  const barWidthPct = Math.max(barRightPct - barLeftPct, 100 / 12 * 0.4)

  const statusColor =
    task.status === 'done'        ? '#10B981' :
    task.status === 'in_progress' ? '#6366F1' : '#9CA3AF'

  const startLabel = task.start_date ? format(parseISO(task.start_date), 'd MMM') : null
  const endLabel   = task.due_date   ? format(parseISO(task.due_date),   'd MMM') : null

  return (
    <div className="flex items-center min-h-14 border-b border-gray-100 last:border-0 bg-indigo-50/20">
      {/* Label gauche */}
      <div className="w-56 flex-shrink-0 flex items-center gap-1.5 pl-3 pr-2 py-2 overflow-hidden">
        {/* Numéro de la tâche */}
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ backgroundColor: statusColor + '22', color: statusColor }}
          title={`Tâche n°${taskNum}`}
        >
          {taskNum}
        </span>

        <span className="text-xs text-gray-600 truncate flex-1">{task.title}</span>

        {/* Référence à la tâche parente */}
        {depNum !== null && (
          <span
            className="flex-shrink-0 text-[10px] font-semibold px-1 py-0.5 rounded bg-orange-100 text-orange-600 whitespace-nowrap"
            title={`Commence après la tâche n°${depNum} : ${task.depends_on_title}`}
          >
            → #{depNum}
          </span>
        )}

        <span className="text-[10px] text-gray-400 flex-shrink-0 bg-gray-100 px-1 rounded">{task.duration_days}j</span>
      </div>

      {/* Timeline tâche */}
      <div className="flex-1 relative min-h-[3.5rem]">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full"
          style={{
            left: `${barLeftPct}%`,
            width: `${barWidthPct}%`,
            backgroundColor: statusColor,
            opacity: task.status === 'done' ? 0.4 : 0.75,
          }}
        >
          <span className="absolute inset-0 flex items-center px-2 overflow-hidden pointer-events-none">
            <span className="text-[10px] text-white font-medium truncate">{task.title}</span>
          </span>
        </div>
        {/* Labels dates en dessous */}
        <div className="absolute inset-0 pointer-events-none">
          {startLabel && (
            <span
              className="absolute text-[10px] text-gray-400 whitespace-nowrap"
              style={{ left: `${barLeftPct}%`, top: 'calc(50% + 12px)' }}
            >
              {startLabel}
            </span>
          )}
          {endLabel && barLeftPct !== barRightPct && (
            <span
              className="absolute text-[10px] text-gray-400 whitespace-nowrap"
              style={{ left: `${barRightPct}%`, top: 'calc(50% + 12px)', transform: 'translateX(-100%)' }}
            >
              {endLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Message quand un projet n'a pas de tâches avec dates ────────────────────

function TasksEmptyRow({ tasks }) {
  const withDates = tasks.filter((t) => t.start_date || t.due_date)
  return (
    <div className="flex items-center min-h-8 border-b border-gray-100 bg-indigo-50/20">
      <div className="w-56 flex-shrink-0 px-3 py-1" style={{ paddingLeft: '2rem' }}>
        <span className="text-[10px] text-gray-400 italic">
          {tasks.length === 0
            ? 'Aucune tâche'
            : withDates.length === 0
              ? `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} sans dates`
              : null}
        </span>
      </div>
      <div className="flex-1" />
    </div>
  )
}

// ─── Ligne projet — barre Gantt avec poignées ─────────────────────────────────

function ProjectRow({ project, year, timelineRef, onBarDrag, onRemoveDates, onToggleExpand, onProjectClick, drag, canDrag, isExpanded }) {
  const span = getSpan(project, year)
  if (!span) return null

  const isDragging = drag?.project.id === project.id

  const dispStart = isDragging ? drag.dispStart : span.startMonth
  const dispEnd   = isDragging ? drag.dispEnd   : span.endMonth

  const barStart = Math.min(dispStart, dispEnd)
  const barEnd   = Math.max(dispStart, dispEnd)

  const barLeftPct  = (barStart / 12) * 100
  const barRightPct = ((barEnd + 1) / 12) * 100
  const barWidthPct = Math.max(barRightPct - barLeftPct, 100 / 12 * 0.5)

  const poleColor = project.pole === 'dev' ? '#4F46E5' : '#059669'
  const priority  = PRIORITY_CONFIG[project.priority]

  const band = getConstraintBand(project, year)
  const bandLeftPct  = band ? (band.startMonth / 12) * 100 : null
  const bandRightPct = band ? ((band.endMonth + 1) / 12) * 100 : null

  const startLabel = isDragging && (drag.type === 'start' || drag.type === 'move')
    ? MONTHS_SHORT[drag.dispStart]
    : project.start_date ? format(parseISO(project.start_date), 'd MMM') : null
  const endLabel = isDragging && (drag.type === 'end' || drag.type === 'move')
    ? MONTHS_SHORT[drag.dispEnd]
    : project.due_date ? format(parseISO(project.due_date), 'd MMM') : null

  const canMove    = canDrag && span.hasStart && span.hasEnd
  const hasAllDates = span.hasStart && span.hasEnd

  return (
    <div className={`flex items-center min-h-14 border-b border-gray-50 last:border-0 transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-gray-50/60'} group`}>
      {/* Label gauche */}
      <div className="w-56 flex-shrink-0 flex items-start gap-2 px-3 py-2 overflow-hidden">
        {/* Bouton expand tâches */}
        {hasAllDates && (
          <button
            onClick={() => onToggleExpand(project)}
            className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
              isExpanded
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white border-indigo-300 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-500'
            }`}
            title={isExpanded ? 'Masquer les tâches' : 'Voir les tâches'}
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor" viewBox="0 0 20 20"
            >
              <path d="M6 6l8 4-8 4V6z" />
            </svg>
            {isExpanded ? 'Masquer' : 'Tâches'}
          </button>
        )}
        {!hasAllDates && <div className="w-3 flex-shrink-0" />}

        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${priority.dot}`} />
        <button
          onClick={() => onProjectClick(project)}
          className="flex-1 text-left text-sm text-gray-700 break-words leading-snug hover:text-indigo-600 hover:underline underline-offset-2 transition-colors"
          title="Ouvrir la fiche projet"
        >
          {project.title}
        </button>
        {canDrag && (
          <button
            onClick={() => onRemoveDates(project)}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-lg leading-none transition-opacity flex-shrink-0"
            title="Retirer les dates"
          >
            ×
          </button>
        )}
      </div>

      {/* Zone timeline */}
      <div className="flex-1 relative h-full min-h-[3.5rem]">

        {/* Bande contrainte */}
        {bandLeftPct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-9 rounded-lg border-2 border-dashed pointer-events-none"
            style={{
              left: `${bandLeftPct}%`,
              width: `${Math.max(0, bandRightPct - bandLeftPct)}%`,
              borderColor: poleColor,
              backgroundColor: poleColor + '12',
            }}
            title={`Au plus tôt : ${project.earliest_start || '—'}  ·  Au plus tard : ${project.latest_end || '—'}`}
          />
        )}

        {/* Barre principale */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full select-none"
          style={{
            left: `${barLeftPct}%`,
            width: `${barWidthPct}%`,
            backgroundColor: poleColor,
            opacity: isDragging ? 0.75 : 1,
            transition: isDragging ? 'none' : 'left 0.05s, width 0.05s',
          }}
        >
          {/* Poignée gauche */}
          <div
            className="absolute left-0 top-0 h-full w-5 rounded-l-full flex items-center justify-center hover:brightness-75 z-10"
            style={{ cursor: canDrag ? 'ew-resize' : 'default' }}
            onPointerDown={canDrag
              ? (e) => { e.stopPropagation(); onBarDrag(e, project, 'start') }
              : undefined}
            title="Glisser pour changer la date de début"
          >
            <div className="w-px h-3 bg-white/70 rounded-full" />
            <div className="w-px h-3 bg-white/40 rounded-full ml-0.5" />
          </div>

          {/* Zone centrale */}
          {canMove && (
            <div
              className="absolute inset-0 mx-5 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => { e.stopPropagation(); onBarDrag(e, project, 'move') }}
              title="Glisser pour déplacer le projet"
            />
          )}

          {/* Poignée droite */}
          <div
            className="absolute right-0 top-0 h-full w-5 rounded-r-full flex items-center justify-center hover:brightness-75 z-10"
            style={{ cursor: canDrag ? 'ew-resize' : 'default' }}
            onPointerDown={canDrag
              ? (e) => { e.stopPropagation(); onBarDrag(e, project, 'end') }
              : undefined}
            title="Glisser pour changer la date de fin"
          >
            <div className="w-px h-3 bg-white/40 rounded-full mr-0.5" />
            <div className="w-px h-3 bg-white/70 rounded-full" />
          </div>
        </div>

        {/* Labels dates */}
        <div className="absolute inset-0 pointer-events-none">
          {startLabel && (
            <span
              className="absolute text-xs text-gray-500 font-medium whitespace-nowrap"
              style={{ left: `${barLeftPct}%`, top: 'calc(50% + 15px)' }}
            >
              {startLabel}
            </span>
          )}
          {endLabel && barLeftPct !== barRightPct && (
            <span
              className="absolute text-xs text-gray-500 font-medium whitespace-nowrap"
              style={{
                left: `${barRightPct}%`,
                top: 'calc(50% + 15px)',
                transform: 'translateX(-100%)',
              }}
            >
              {endLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chip non planifié (draggable @dnd-kit) ───────────────────────────────────

function UnplannedChip({ project, onClick }) {
  const user    = useAuthStore((s) => s.user)
  const canDrag = user?.role === 'admin' || user?.role === 'lead'

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unplanned-${project.id}`,
    disabled: !canDrag,
    data: { project },
  })
  const style    = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const pole     = POLE_CONFIG[project.pole]
  const priority = PRIORITY_CONFIG[project.priority]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      onClick={(e) => { e.stopPropagation(); onClick(project) }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border select-none transition-all ${pole.color} ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40' : 'hover:shadow-sm hover:-translate-y-px'}`}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`} />
      <span className="max-w-[200px] truncate">{project.title}</span>
    </div>
  )
}

// ─── Zone sans date (droppable @dnd-kit) ─────────────────────────────────────

function UnplannedZone({ projects, onProjectClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unplanned' })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-4 flex-shrink-0 min-h-[76px] transition-all ${
        isOver ? 'border-red-400 bg-red-50 scale-[1.005]' : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
    >
      <p className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isOver ? 'text-red-500' : 'text-gray-400'}`}>
        {isOver
          ? '↓ Relâcher pour retirer les dates'
          : `Sans date${projects.length > 0 ? ` · ${projects.length} projet${projects.length > 1 ? 's' : ''}` : ''} · glisser ici pour retirer les dates`}
      </p>
      <div className="flex flex-wrap gap-2 min-h-[24px]">
        {projects.map((p) => (
          <UnplannedChip key={p.id} project={p} onClick={onProjectClick} />
        ))}
        {projects.length === 0 && !isOver && (
          <span className="text-sm text-gray-300 italic self-center">Aucun projet non planifié</span>
        )}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CalendarPage() {
  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const today        = new Date()

  const [year, setYear]               = useState(currentYear)
  const [selected, setSelected]       = useState(null)
  const [expandedId, setExpandedId]   = useState(null)
  const [tasksCache, setTasksCache]   = useState({}) // { [projectId]: tasks[] }
  const [loadingTasks, setLoadingTasks] = useState(false)
  // drag = { project, type, dispStart, dispEnd, origStart?, origEnd?, anchorPct? }
  const [drag, setDrag]               = useState(null)

  const { projects, fetchProjects, updateProject, filters } = useProjectStore()
  const user    = useAuthStore((s) => s.user)
  const canDrag = user?.role === 'admin' || user?.role === 'lead'
  const timelineRef = useRef()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => { fetchProjects() }, [])

  const filteredProjects = projects.filter(
    (p) => p.status !== 'done' && (filters.pole === 'all' || p.pole === filters.pole)
  )

  const plannedProjects   = filteredProjects.filter((p) => getSpan(p, year) !== null)
  const unplannedProjects = filteredProjects.filter((p) => !p.start_date && !p.due_date)

  function projectsByPole(pole) {
    return plannedProjects
      .filter((p) => p.pole === pole)
      .sort((a, b) => (a.start_date || a.due_date || '') < (b.start_date || b.due_date || '') ? -1 : 1)
  }

  // ─── Toggle expansion tâches ──────────────────────────────────────────────

  async function handleToggleExpand(project) {
    if (expandedId === project.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(project.id)
    if (!tasksCache[project.id]) {
      setLoadingTasks(true)
      try {
        const tasks = await taskService.list(project.id)
        setTasksCache((prev) => ({ ...prev, [project.id]: tasks }))
      } catch (_) { /* ignore */ }
      setLoadingTasks(false)
    }
  }

  // ─── Drag barre (pointer events) ─────────────────────────────────────────

  function handleBarDrag(e, project, type) {
    e.preventDefault()
    const span = getSpan(project, year)
    const startM = span?.startMonth ?? 0
    const endM   = span?.endMonth ?? 11

    if (type === 'move') {
      if (!timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const anchorPct = ((e.clientX - rect.left) / rect.width) * 100
      setDrag({ project, type: 'move', dispStart: startM, dispEnd: endM, origStart: startM, origEnd: endM, anchorPct })
    } else {
      setDrag({ project, type, dispStart: startM, dispEnd: endM, origStart: startM, origEnd: endM, anchorPct: 0 })
    }
  }

  const handlePointerMove = useCallback((e) => {
    if (!drag || !timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const newMonth = Math.max(0, Math.min(11, Math.floor(((e.clientX - rect.left) / rect.width) * 12)))

    if (drag.type === 'start') {
      setDrag((d) => d ? { ...d, dispStart: newMonth } : null)
    } else if (drag.type === 'end') {
      setDrag((d) => d ? { ...d, dispEnd: newMonth } : null)
    } else {
      const currentPct = ((e.clientX - rect.left) / rect.width) * 100
      const deltaMonths = Math.round((currentPct - drag.anchorPct) / (100 / 12))
      const duration = drag.origEnd - drag.origStart
      const newStart = Math.max(0, Math.min(11 - Math.max(0, duration), drag.origStart + deltaMonths))
      const newEnd   = Math.min(11, newStart + Math.max(0, duration))
      setDrag((d) => d ? { ...d, dispStart: newStart, dispEnd: newEnd } : null)
    }
  }, [drag])

  const handlePointerUp = useCallback(async () => {
    if (!drag) return
    const { project, type, dispStart, dispEnd, origStart } = drag
    setDrag(null)

    const span = getSpan(project, year)
    const updates = {}

    if (type === 'move') {
      const sDay = project.start_date ? getDate(parseISO(project.start_date)) : 1
      const eDay = project.due_date   ? getDate(parseISO(project.due_date))   : getDaysInMonth(new Date(year, dispEnd))
      updates.start_date = format(new Date(year, dispStart, Math.min(sDay, getDaysInMonth(new Date(year, dispStart)))), 'yyyy-MM-dd')
      updates.due_date   = format(new Date(year, dispEnd,   Math.min(eDay, getDaysInMonth(new Date(year, dispEnd)))),   'yyyy-MM-dd')

      // Décaler les tâches du même delta mois
      const deltaMonths = dispStart - origStart
      if (deltaMonths !== 0) {
        const projectTasks = tasksCache[project.id] || []
        const tasksToUpdate = projectTasks.filter((t) => t.start_date || t.due_date)
        if (tasksToUpdate.length > 0) {
          const updatedTasks = await Promise.all(
            tasksToUpdate.map((t) => {
              const taskUpdates = {}
              if (t.start_date) {
                const d = parseISO(t.start_date)
                taskUpdates.start_date = format(new Date(d.getFullYear(), d.getMonth() + deltaMonths, d.getDate()), 'yyyy-MM-dd')
              }
              if (t.due_date) {
                const d = parseISO(t.due_date)
                taskUpdates.due_date = format(new Date(d.getFullYear(), d.getMonth() + deltaMonths, d.getDate()), 'yyyy-MM-dd')
              }
              return taskService.update(project.id, t.id, taskUpdates)
            })
          )
          setTasksCache((prev) => {
            const existing = prev[project.id] || []
            const byId = {}
            updatedTasks.forEach((t) => { byId[t.id] = t })
            return { ...prev, [project.id]: existing.map((t) => byId[t.id] || t) }
          })
        }
      }
    } else if (type === 'start') {
      const otherMonth = span?.hasEnd ? parseISO(project.due_date).getMonth() : null
      const currentMonth = dispStart
      if (otherMonth !== null && currentMonth > otherMonth) {
        const sDay = project.start_date ? getDate(parseISO(project.start_date)) : 1
        const eDay = project.due_date   ? getDate(parseISO(project.due_date))   : getDaysInMonth(new Date(year, currentMonth))
        updates.start_date = format(new Date(year, otherMonth,   Math.min(eDay, getDaysInMonth(new Date(year, otherMonth)))),   'yyyy-MM-dd')
        updates.due_date   = format(new Date(year, currentMonth, Math.min(sDay, getDaysInMonth(new Date(year, currentMonth)))), 'yyyy-MM-dd')
      } else {
        const day = project.start_date
          ? Math.min(getDate(parseISO(project.start_date)), getDaysInMonth(new Date(year, currentMonth)))
          : 1
        updates.start_date = format(new Date(year, currentMonth, day), 'yyyy-MM-dd')
      }
    } else {
      const otherMonth = span?.hasStart ? parseISO(project.start_date).getMonth() : null
      const currentMonth = dispEnd
      if (otherMonth !== null && currentMonth < otherMonth) {
        const sDay = project.start_date ? getDate(parseISO(project.start_date)) : 1
        const eDay = project.due_date   ? getDate(parseISO(project.due_date))   : getDaysInMonth(new Date(year, currentMonth))
        updates.start_date = format(new Date(year, currentMonth, Math.min(eDay, getDaysInMonth(new Date(year, currentMonth)))), 'yyyy-MM-dd')
        updates.due_date   = format(new Date(year, otherMonth,   Math.min(sDay, getDaysInMonth(new Date(year, otherMonth)))),   'yyyy-MM-dd')
      } else {
        const day = project.due_date
          ? Math.min(getDate(parseISO(project.due_date)), getDaysInMonth(new Date(year, currentMonth)))
          : getDaysInMonth(new Date(year, currentMonth))
        updates.due_date = format(new Date(year, currentMonth, day), 'yyyy-MM-dd')
      }
    }

    await updateProject(project.id, updates)
  }, [drag, year, updateProject, tasksCache])

  useEffect(() => {
    if (!drag) return
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup',   handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup',   handlePointerUp)
    }
  }, [drag, handlePointerMove, handlePointerUp])

  // ─── DnD Kit drag (unplanned chips → months ou zone sans date) ───────────

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return

    const rawId     = String(active.id)
    const projectId = rawId.replace('unplanned-', '')
    const project   = projects.find((p) => String(p.id) === projectId)
    if (!project) return

    if (over.id === 'unplanned') {
      if (!project.start_date && !project.due_date) return
      await updateProject(project.id, { start_date: null, due_date: null })
      return
    }

    if (String(over.id).startsWith('month-')) {
      const targetMonth = parseInt(over.id.replace('month-', ''), 10)
      if (isNaN(targetMonth)) return
      const lastDay = getDaysInMonth(new Date(year, targetMonth))
      await updateProject(project.id, {
        start_date: format(new Date(year, targetMonth, 1), 'yyyy-MM-dd'),
        due_date:   format(new Date(year, targetMonth, lastDay), 'yyyy-MM-dd'),
      })
    }
  }

  async function handleRemoveDates(project) {
    await updateProject(project.id, { start_date: null, due_date: null })
  }

  const todayPct = year === currentYear
    ? ((today.getMonth() + (today.getDate() - 1) / getDaysInMonth(today)) / 12) * 100
    : null

  // ─── Rendu ────────────────────────────────────────────────────────────────

  function renderPoleSection(pole, isFirst) {
    const rows = projectsByPole(pole)
    if (rows.length === 0) return null

    const cfg = POLE_CONFIG[pole]
    const accentColor = pole === 'dev' ? '#4F46E5' : '#059669'

    return (
      <div key={pole}>
        {!isFirst && (
          <div className="h-3 bg-gray-100 border-y border-gray-200" />
        )}

        <div
          className="flex items-center h-10 border-b border-gray-200"
          style={{ borderLeftWidth: 4, borderLeftColor: accentColor, borderLeftStyle: 'solid' }}
        >
          <div className="w-56 flex-shrink-0 flex items-center gap-2 px-3">
            <span className={`text-sm font-bold px-2.5 py-1 rounded-md ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400">
              {rows.length} projet{rows.length > 1 ? 's' : ''}
            </span>
          </div>
          <div
            className="flex-1 h-0.5 opacity-20"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {rows.map((p) => {
          const isExpanded = expandedId === p.id
          const tasks = tasksCache[p.id] || []
          const tasksWithDates = tasks.filter((t) => getTaskSpan(t, year) !== null)

          return (
            <div key={p.id}>
              <ProjectRow
                project={p}
                year={year}
                timelineRef={timelineRef}
                onBarDrag={handleBarDrag}
                onRemoveDates={handleRemoveDates}
                onToggleExpand={handleToggleExpand}
                onProjectClick={setSelected}
                drag={drag}
                canDrag={canDrag}
                isExpanded={isExpanded}
              />

              {/* Sous-lignes tâches */}
              {isExpanded && (
                <div className="border-l-2 border-indigo-200 ml-4 relative">
                  {loadingTasks && tasks.length === 0 ? (
                    <div className="flex items-center min-h-8 bg-indigo-50/20 px-8">
                      <span className="text-[10px] text-gray-400 italic">Chargement des tâches…</span>
                    </div>
                  ) : tasksWithDates.length === 0 ? (
                    <TasksEmptyRow tasks={tasks} />
                  ) : (
                    <>
                      {tasksWithDates.map((task, i) => {
                        const taskNum = i + 1
                        const depNum  = task.depends_on
                          ? (() => {
                              const idx = tasksWithDates.findIndex((t) => t.id === task.depends_on)
                              return idx >= 0 ? idx + 1 : null
                            })()
                          : null
                        return (
                          <TaskGanttRow key={task.id} task={task} year={year} taskNum={taskNum} depNum={depNum} />
                        )
                      })}
                    </>
                  )}
                  {/* Légende statuts tâches */}
                  {tasksWithDates.length > 0 && (
                    <div className="flex items-center gap-3 px-8 py-1 bg-indigo-50/10 border-t border-indigo-100">
                      {[
                        { status: 'todo', color: '#9CA3AF', label: 'À faire' },
                        { status: 'in_progress', color: '#6366F1', label: 'En cours' },
                        { status: 'done', color: '#10B981', label: 'Terminé' },
                      ].map(({ color, label }) => (
                        <span key={label} className="flex items-center gap-1 text-[10px] text-gray-400">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                          {label}
                        </span>
                      ))}
                      <span className="text-[10px] text-gray-300 ml-1">⛓ = dépendance</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calendrier des projets</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {plannedProjects.length} projet{plannedProjects.length > 1 ? 's' : ''} planifié{plannedProjects.length > 1 ? 's' : ''} en {year}
            {unplannedProjects.length > 0 && ` · ${unplannedProjects.length} sans date`}
            {canDrag && ' · Glisser la barre pour déplacer · les poignées pour redimensionner'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-bold text-gray-800 w-12 text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {year !== currentYear && (
            <button onClick={() => setYear(currentYear)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600">
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">

          {/* Grille Gantt */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-shrink-0">

            {/* En-tête mois */}
            <div className="flex border-b-2 border-gray-200">
              <div className="w-56 flex-shrink-0 px-3 py-3 text-sm font-semibold text-gray-400 uppercase tracking-wider border-r border-gray-200">
                Projet
              </div>
              <div className="flex-1 flex" ref={timelineRef}>
                {Array.from({ length: 12 }, (_, i) => (
                  <MonthHeaderCell key={i} monthIndex={i} isCurrentMonth={i === currentMonth && year === currentYear} />
                ))}
              </div>
            </div>

            {/* Corps */}
            <div className="relative">
              {Array.from({ length: 12 }, (_, i) => {
                const leftPct  = (i / 12) * 100
                const widthPct = (1 / 12) * 100
                return (
                  <div
                    key={i}
                    className={`absolute top-0 bottom-0 border-r border-gray-50 pointer-events-none ${
                      i === currentMonth && year === currentYear ? 'bg-amber-50/25' : i % 2 === 0 ? '' : 'bg-gray-50/30'
                    }`}
                    style={{ left: `calc(224px + ${leftPct}% * (100% - 224px) / 100)`, width: `calc(${widthPct}% * (100% - 224px) / 100)` }}
                  />
                )
              })}

              {todayPct !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-400/60 pointer-events-none z-20"
                  style={{ left: `calc(224px + ${todayPct}% * (100% - 224px) / 100)` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-400 rounded-full" />
                </div>
              )}

              {plannedProjects.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Aucun projet planifié pour {year}.
                </div>
              ) : (
                <>
                  {renderPoleSection('dev', true)}
                  {renderPoleSection('network', false)}
                </>
              )}
            </div>
          </div>

          <UnplannedZone projects={unplannedProjects} onProjectClick={setSelected} />
        </div>

        <DragOverlay dropAnimation={null}>{null}</DragOverlay>
      </DndContext>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 flex-shrink-0 text-sm pb-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Pôle :</span>
          {Object.entries(POLE_CONFIG).map(([k, v]) => (
            <span key={k} className={`px-2 py-0.5 rounded-full font-medium ${v.color}`}>{v.label}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Priorité :</span>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full ${v.dot}`} />
              <span className="text-gray-500">{v.label}</span>
            </span>
          ))}
        </div>
        {canDrag && (
          <span className="text-gray-300">
            · ▶ Cliquer sur un projet planifié pour voir ses tâches · Glisser la barre pour déplacer · poignées ▎ pour redimensionner
          </span>
        )}
        <span className="text-gray-400 flex items-center gap-1">
          <span className="w-4 h-3 border border-dashed border-gray-400 rounded inline-block" />
          Contrainte temporelle
        </span>
        <span className="text-amber-600 ml-auto">◆ mois actuel</span>
      </div>

      {selected && (
        <ProjectModal projectId={selected.id} onClose={() => { setSelected(null); fetchProjects() }} />
      )}
    </div>
  )
}
