import { useDroppable } from '@dnd-kit/core'
import { STATUS_CONFIG } from '../../utils/format'
import ProjectCard from './ProjectCard'

export default function Column({ status, projects, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = STATUS_CONFIG[status]

  return (
    <div className="flex flex-col flex-1 min-w-64">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-lg border-b-2 ${config.header}`}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">{config.label}</h2>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-xs font-bold text-gray-600 shadow-sm">
            {projects.length}
          </span>
        </div>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 bg-gray-100 rounded-b-lg p-2 space-y-2 min-h-[200px] transition-colors ${
          isOver ? 'bg-indigo-50 ring-2 ring-indigo-300 ring-inset' : ''
        }`}
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => onCardClick(project)}
          />
        ))}

        {projects.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 text-xs text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
            Déposer ici
          </div>
        )}
      </div>
    </div>
  )
}
