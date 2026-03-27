import { useState } from 'react'
import { DndContext, DragOverlay, pointerWithin, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import Column from './Column'
import ProjectCard from './ProjectCard'
import ProjectModal from '../Project/ProjectModal'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import { POLE_CONFIG, PRIORITY_CONFIG } from '../../utils/format'
import { exportService } from '../../services/exportService'

const STATUSES = ['backlog', 'in_progress', 'on_hold', 'done']

export default function Board() {
  const { getByStatus, moveProject, projects, loading } = useProjectStore()
  const user = useAuthStore((s) => s.user)
  const [activeProject, setActiveProject]   = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  const currentYear = new Date().getFullYear()
  const [boardYear, setBoardYear] = useState(currentYear)
  const isCurrentYear = boardYear === currentYear

  const canDrag    = user?.role === 'admin' || user?.role === 'lead'
  const canExport  = user?.role === 'admin' || user?.role === 'lead'
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try { await exportService.downloadProjects() } finally { setExporting(false) }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  function handleDragStart(event) {
    const project = projects.find((p) => p.id === event.active.id)
    setActiveProject(project || null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveProject(null)
    if (!over) return

    const projectId = active.id
    const newStatus = over.id
    const project = projects.find((p) => p.id === projectId)
    if (!project || project.status === newStatus) return

    const targetCount = getByStatus(newStatus).length
    moveProject(projectId, newStatus, targetCount)
  }

  // Pour une autre année : projets dont une date tombe dans cette année
  const archivedProjects = !isCurrentYear
    ? projects.filter((p) => {
        const yearStr = String(boardYear)
        // Années passées : projets terminés de cette année
        if (boardYear < currentYear) {
          if (p.status !== 'done') return false
        }
        // Pour toutes les années non courantes : filtrer par dates
        return (
          p.due_date?.startsWith(yearStr) ||
          p.start_date?.startsWith(yearStr) ||
          p.updated_at?.startsWith(yearStr) ||
          p.created_at?.startsWith(yearStr)
        )
      })
    : []

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Chargement...
      </div>
    )
  }

  return (
    <>
      {/* Sélecteur d'année + bouton export */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button
          onClick={() => setBoardYear((y) => y - 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-800 w-12 text-center">{boardYear}</span>
        <button
          onClick={() => setBoardYear((y) => y + 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {!isCurrentYear && (
          <button
            onClick={() => setBoardYear(currentYear)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600"
          >
            Année courante
          </button>
        )}
        {!isCurrentYear && (
          <span className="text-sm text-amber-600 font-medium">
            {boardYear < currentYear ? 'Archive' : 'Planifié'} {boardYear} · {archivedProjects.length} projet{archivedProjects.length > 1 ? 's' : ''}
            {boardYear < currentYear && ` terminé${archivedProjects.length > 1 ? 's' : ''}`}
          </span>
        )}

        {/* Bouton export Excel — admin et leads uniquement */}
        {canExport && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Exporter les projets en cours et terminés de ${new Date().getFullYear()} en Excel`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? 'Export...' : 'Export Excel'}
          </button>
        )}
      </div>

      {/* Vue archive (années passées) */}
      {!isCurrentYear ? (
        <div className="space-y-3">
          {archivedProjects.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              {boardYear < currentYear
                ? `Aucun projet terminé trouvé pour ${boardYear}.`
                : `Aucun projet planifié pour ${boardYear}.`}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {archivedProjects.map((p) => {
                const pole     = POLE_CONFIG[p.pole]
                const priority = PRIORITY_CONFIG[p.priority]
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProject(p)}
                    className="text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${priority.dot}`} />
                      <span className="text-sm font-semibold text-gray-800 leading-snug">{p.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${pole.color}`}>{pole.label}</span>
                      {p.due_date && (
                        <span className="px-2 py-0.5 rounded text-xs text-gray-500 bg-gray-100">
                          ✓ {p.due_date}
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">{p.description}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Vue kanban normale */
        <DndContext
          sensors={canDrag ? sensors : []}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full items-start pb-4">
            {STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                projects={getByStatus(status)}
                onCardClick={setSelectedProject}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeProject ? (
              <div className="rotate-2 opacity-90 shadow-2xl w-72">
                <ProjectCard project={activeProject} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {selectedProject && (
        <ProjectModal
          projectId={selectedProject.id}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </>
  )
}
