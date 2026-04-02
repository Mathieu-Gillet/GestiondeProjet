import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { PRIORITY_CONFIG, POLE_CONFIG, formatDate, isOverdue, canManage } from '../../utils/format'
import useAuthStore from '../../store/authStore'

const PRIORITY_BORDER = {
  critical: 'border-l-red-400',
  high:     'border-l-orange-400',
  normal:   'border-l-blue-400',
  low:      'border-l-gray-300',
}

export default function ProjectCard({ project, onClick, isDragging = false }) {
  const user = useAuthStore((s) => s.user)
  const canDrag = canManage(user)

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: project.id,
    disabled: !canDrag,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined

  const priority = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.normal
  const pole = POLE_CONFIG[project.pole]
  const overdue = isOverdue(project.due_date) && project.status !== 'done'
  const borderColor = PRIORITY_BORDER[project.priority] || PRIORITY_BORDER.normal

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 border-l-[3px] ${borderColor} shadow-sm p-3 select-none transition-all hover:shadow-md hover:-translate-y-px ${
        isDragging ? 'opacity-50 rotate-1' : ''
      } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      {/* Header: pole badge + priority label */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pole?.color}`}>
          {pole?.label}
        </span>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${priority.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
          {priority.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-800 leading-snug mb-2 line-clamp-2">
        {project.title}
      </h3>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">{project.description}</p>
      )}

      {/* Tags */}
      {project.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {project.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: tag.color + '22', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: due date + owner */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        {project.due_date ? (
          <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {overdue && <span>⚠</span>}
            {formatDate(project.due_date)}
          </span>
        ) : (
          <span />
        )}
        {project.owner && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-700 uppercase flex-shrink-0">
              {project.owner.username[0]}
            </div>
            <span className="text-xs text-gray-500 font-medium">{project.owner.username}</span>
          </div>
        )}
      </div>
    </div>
  )
}
