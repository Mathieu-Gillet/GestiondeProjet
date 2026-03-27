import { useState } from 'react'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import ProjectModal from '../Project/ProjectModal'
import ProjectForm from '../Project/ProjectForm'
import { PRIORITY_CONFIG, POLE_CONFIG, STATUS_CONFIG, formatDate, isOverdue } from '../../utils/format'

const STATUS_INDICATOR = {
  backlog:     'bg-gray-300',
  in_progress: 'bg-blue-400',
  on_hold:     'bg-amber-400',
  done:        'bg-green-400',
}

const STATUSES = ['backlog', 'in_progress', 'on_hold', 'done']

function ListRow({ project, onClick }) {
  const priority = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.normal
  const pole = POLE_CONFIG[project.pole]
  const overdue = isOverdue(project.due_date) && project.status !== 'done'

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 group transition-colors"
    >
      {/* Status indicator — carré coloré non interactif */}
      <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${STATUS_INDICATOR[project.status] || 'bg-gray-300'}`} />

      {/* Title */}
      <span className="flex-1 text-sm text-gray-800 font-medium truncate min-w-0">
        {project.title}
      </span>

      {/* Tags (max 2) */}
      {project.tags?.length > 0 && (
        <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
          {project.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: tag.color + '22', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Assignee */}
      <div className="w-32 flex items-center gap-1.5 flex-shrink-0">
        {project.owner ? (
          <>
            <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-700 uppercase flex-shrink-0">
              {project.owner.username[0]}
            </div>
            <span className="text-xs text-gray-500 truncate">{project.owner.username}</span>
          </>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      {/* Due date */}
      <div className="w-28 flex-shrink-0">
        {project.due_date ? (
          <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
            {overdue && '⚠ '}
            {formatDate(project.due_date)}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      {/* Priority */}
      <div className="w-24 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priority.dot}`} />
          {priority.label}
        </span>
      </div>

      {/* Pole */}
      <div className="w-28 flex-shrink-0">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${pole?.color}`}>
          {pole?.label}
        </span>
      </div>
    </div>
  )
}

function ListSection({ status, projects, onRowClick, onAddClick }) {
  const [collapsed, setCollapsed] = useState(false)
  const config = STATUS_CONFIG[status]
  const user = useAuthStore((s) => s.user)
  const canCreate = user?.role === 'admin' || user?.role === 'lead'

  return (
    <div>
      {/* Section header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 select-none transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
          {config.label}
        </span>
        <span className="text-xs text-gray-400 font-medium">{projects.length}</span>
      </div>

      {/* Rows */}
      {!collapsed && (
        <>
          {projects.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 italic border-b border-gray-100">
              Aucun projet dans cette section
            </div>
          )}
          {projects.map((p) => (
            <ListRow key={p.id} project={p} onClick={() => onRowClick(p)} />
          ))}
          {canCreate && (
            <div
              onClick={onAddClick}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter un projet
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ListView() {
  const { getByStatus, loading, projects } = useProjectStore()
  const [selectedProject, setSelectedProject] = useState(null)
  const [showForm, setShowForm] = useState(false)

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Chargement...
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <div className="w-4 flex-shrink-0" />
          <div className="flex-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nom</div>
          <div className="hidden lg:block text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ width: 80 }}>Tags</div>
          <div className="w-32 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigné</div>
          <div className="w-28 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">Échéance</div>
          <div className="w-24 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">Priorité</div>
          <div className="w-28 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">Pôle</div>
        </div>

        {STATUSES.map((status) => (
          <ListSection
            key={status}
            status={status}
            projects={getByStatus(status)}
            onRowClick={setSelectedProject}
            onAddClick={() => setShowForm(true)}
          />
        ))}
      </div>

      {selectedProject && (
        <ProjectModal projectId={selectedProject.id} onClose={() => setSelectedProject(null)} />
      )}
      {showForm && <ProjectForm onClose={() => setShowForm(false)} />}
    </>
  )
}
