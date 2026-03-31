import { useState, useEffect } from 'react'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import { POLE_CONFIG, PRIORITY_CONFIG, formatDate } from '../../utils/format'
import ProjectModal from '../Project/ProjectModal'

// Détermine l'année de clôture d'un projet terminé
function getCompletionYear(project) {
  if (project.due_date)    return parseInt(project.due_date.slice(0, 4), 10)
  if (project.updated_at)  return parseInt(project.updated_at.slice(0, 4), 10)
  return parseInt(project.created_at.slice(0, 4), 10)
}

export default function ArchivesPage() {
  const { projects, fetchProjects, filters } = useProjectStore()
  const user = useAuthStore((s) => s.user)
  const [selected, setSelected]   = useState(null)
  const [openYears, setOpenYears] = useState({})

  useEffect(() => { fetchProjects() }, [])

  // Projets terminés, filtrés par pôle
  const done = projects.filter((p) => {
    if (p.status !== 'done') return false
    if (filters.service !== 'all' && p.service !== filters.service) return false
    return true
  })

  // Regrouper par année de clôture, ordre décroissant
  const byYear = done.reduce((acc, p) => {
    const y = getCompletionYear(p)
    if (!acc[y]) acc[y] = []
    acc[y].push(p)
    return acc
  }, {})

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)

  // Ouvrir l'année la plus récente par défaut
  useEffect(() => {
    if (years.length > 0 && Object.keys(openYears).length === 0) {
      setOpenYears({ [years[0]]: true })
    }
  }, [years.length])

  function toggleYear(y) {
    setOpenYears((prev) => ({ ...prev, [y]: !prev[y] }))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Archives</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {done.length} projet{done.length > 1 ? 's' : ''} terminé{done.length > 1 ? 's' : ''}
          {years.length > 0 && ` · ${years.length} année${years.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {done.length === 0 && (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          Aucun projet terminé pour l'instant.
        </div>
      )}

      {/* Sections par année */}
      {years.map((year) => {
        const yearProjects = byYear[year].sort((a, b) => {
          const da = a.due_date || a.updated_at || a.created_at
          const db = b.due_date || b.updated_at || b.created_at
          return db < da ? -1 : 1
        })
        const isOpen = !!openYears[year]

        return (
          <div key={year} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* En-tête de l'année (cliquable pour plier/déplier) */}
            <button
              onClick={() => toggleYear(year)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-800">{year}</span>
                <span className="text-sm text-gray-400">
                  {yearProjects.length} projet{yearProjects.length > 1 ? 's' : ''}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Grille de projets */}
            {isOpen && (
              <div className="border-t border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {yearProjects.map((p) => {
                  const pole     = POLE_CONFIG[p.pole]
                  const priority = PRIORITY_CONFIG[p.priority]

                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="text-left bg-gray-50 hover:bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-md rounded-xl p-4 transition-all group"
                    >
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${pole.color}`}>
                          {pole.label}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          Terminé
                        </span>
                      </div>

                      {/* Titre */}
                      <div className="flex items-start gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${priority.dot}`} />
                        <span className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-indigo-700 transition-colors">
                          {p.title}
                        </span>
                      </div>

                      {/* Description */}
                      {p.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mb-2 ml-4">
                          {p.description}
                        </p>
                      )}

                      {/* Dates */}
                      <div className="ml-4 flex items-center gap-1.5 text-xs text-gray-400">
                        {p.start_date && (
                          <>
                            <span>{formatDate(p.start_date)}</span>
                            {p.due_date && <span>→</span>}
                          </>
                        )}
                        {p.due_date && (
                          <span className="font-medium text-emerald-600">
                            ✓ {formatDate(p.due_date)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {selected && (
        <ProjectModal
          projectId={selected.id}
          onClose={() => { setSelected(null); fetchProjects() }}
        />
      )}
    </div>
  )
}
