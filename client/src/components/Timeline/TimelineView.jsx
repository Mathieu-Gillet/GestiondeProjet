import { useState } from 'react'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
  differenceInDays,
  max,
  min,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import useProjectStore from '../../store/projectStore'
import { PRIORITY_CONFIG, POLE_CONFIG, STATUS_CONFIG } from '../../utils/format'
import ProjectModal from '../Project/ProjectModal'

const MONTHS_VISIBLE = 3

const STATUS_BAR_COLOR = {
  backlog:     'bg-gray-300 text-gray-700',
  in_progress: 'bg-blue-400 text-white',
  on_hold:     'bg-amber-400 text-white',
  done:        'bg-green-400 text-white',
}

export default function TimelineView() {
  const { projects, loading } = useProjectStore()
  const [selectedProject, setSelectedProject] = useState(null)
  const [startMonth, setStartMonth] = useState(startOfMonth(new Date()))

  const visibleStart = startMonth
  const visibleEnd = endOfMonth(addMonths(startMonth, MONTHS_VISIBLE - 1))
  const totalDays = differenceInDays(visibleEnd, visibleStart) + 1

  const months = Array.from({ length: MONTHS_VISIBLE }, (_, i) => addMonths(startMonth, i))

  const projectsWithDates = projects.filter((p) => p.due_date)

  const sorted = [...projectsWithDates].sort((a, b) => {
    const order = { in_progress: 0, backlog: 1, on_hold: 2, done: 3 }
    if (a.status !== b.status) return order[a.status] - order[b.status]
    return a.due_date < b.due_date ? -1 : 1
  })

  function getBarStyle(project) {
    const barStart = project.start_date ? parseISO(project.start_date) : parseISO(project.due_date)
    const barEnd = parseISO(project.due_date)

    const clampedStart = max([barStart, visibleStart])
    const clampedEnd = min([barEnd, visibleEnd])

    if (clampedStart > visibleEnd || clampedEnd < visibleStart) return null

    const leftDays = differenceInDays(clampedStart, visibleStart)
    const widthDays = Math.max(differenceInDays(clampedEnd, clampedStart) + 1, 1)

    return {
      left: `${(leftDays / totalDays) * 100}%`,
      width: `${Math.max((widthDays / totalDays) * 100, 0.8)}%`,
    }
  }

  const todayOffset = differenceInDays(new Date(), visibleStart)
  const showToday = todayOffset >= 0 && todayOffset <= totalDays

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Chargement...
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStartMonth((m) => addMonths(m, -1))}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-700 capitalize">
              {format(visibleStart, 'MMM yyyy', { locale: fr })}
              {' — '}
              {format(visibleEnd, 'MMM yyyy', { locale: fr })}
            </span>
            <button
              onClick={() => setStartMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => setStartMonth(startOfMonth(new Date()))}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
            >
              Aujourd'hui
            </button>
          </div>
          <span className="text-xs text-gray-400">
            {projectsWithDates.length} projet{projectsWithDates.length !== 1 ? 's' : ''} avec échéance
          </span>
        </div>

        {/* Grid */}
        <div className="flex overflow-x-auto">
          {/* Left panel: project names */}
          <div className="w-60 flex-shrink-0 border-r border-gray-200">
            {/* Spacer for month headers */}
            <div className="h-10 bg-gray-50 border-b border-gray-200" />

            {sorted.map((p) => {
              const priority = PRIORITY_CONFIG[p.priority]
              const pole = POLE_CONFIG[p.pole]
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  style={{ height: 44 }}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`} />
                  <span className="text-xs font-medium text-gray-800 truncate flex-1 min-w-0">
                    {p.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${pole.color}`}>
                    {p.pole === 'dev' ? 'Dev' : 'Rés.'}
                  </span>
                </div>
              )
            })}

            {sorted.length === 0 && (
              <div className="px-3 py-6 text-xs text-gray-400 italic text-center">
                Aucun projet avec date d'échéance
              </div>
            )}
          </div>

          {/* Right panel: Gantt bars */}
          <div className="flex-1 min-w-0">
            {/* Month headers */}
            <div className="flex h-10 bg-gray-50 border-b border-gray-200">
              {months.map((m) => {
                const daysInMonth = differenceInDays(endOfMonth(m), startOfMonth(m)) + 1
                return (
                  <div
                    key={m.toISOString()}
                    style={{ width: `${(daysInMonth / totalDays) * 100}%` }}
                    className="flex-shrink-0 flex items-center justify-center text-xs font-semibold text-gray-500 border-r border-gray-200 capitalize"
                  >
                    {format(m, 'MMMM yyyy', { locale: fr })}
                  </div>
                )
              })}
            </div>

            {/* Rows */}
            {sorted.map((p) => {
              const barStyle = getBarStyle(p)
              const barColor = STATUS_BAR_COLOR[p.status]

              return (
                <div
                  key={p.id}
                  className="relative border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  style={{ height: 44 }}
                >
                  {/* Month dividers */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {months.map((m) => {
                      const daysInMonth = differenceInDays(endOfMonth(m), startOfMonth(m)) + 1
                      return (
                        <div
                          key={m.toISOString()}
                          style={{ width: `${(daysInMonth / totalDays) * 100}%` }}
                          className="flex-shrink-0 border-r border-gray-100"
                        />
                      )
                    })}
                  </div>

                  {/* Today marker */}
                  {showToday && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 z-10 opacity-70 pointer-events-none"
                      style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                    />
                  )}

                  {/* Gantt bar */}
                  {barStyle && (
                    <button
                      onClick={() => setSelectedProject(p)}
                      className={`absolute top-2.5 bottom-2.5 rounded-md px-2 flex items-center overflow-hidden z-20 ${barColor} hover:opacity-80 transition-opacity shadow-sm`}
                      style={barStyle}
                    >
                      <span className="text-xs font-medium truncate">{p.title}</span>
                    </button>
                  )}
                </div>
              )
            })}

            {sorted.length === 0 && (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Ajoutez des dates d'échéance à vos projets pour les voir ici
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-400 font-medium">Statut :</span>
          {Object.entries(STATUS_CONFIG ?? {}).map(() => null)}
          {[
            { label: 'Idées', color: 'bg-gray-300' },
            { label: 'En cours', color: 'bg-blue-400' },
            { label: 'En attente', color: 'bg-amber-400' },
            { label: 'Terminé', color: 'bg-green-400' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className={`w-3 h-2 rounded-sm ${s.color}`} />
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
          ))}
          {showToday && (
            <>
              <div className="w-px h-3 bg-gray-200 mx-1" />
              <div className="flex items-center gap-1.5">
                <div className="w-px h-3 bg-red-400" />
                <span className="text-xs text-gray-500">Aujourd'hui</span>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedProject && (
        <ProjectModal projectId={selectedProject.id} onClose={() => setSelectedProject(null)} />
      )}
    </>
  )
}
