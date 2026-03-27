const NODE_TYPES = [
  {
    type: 'process',
    label: 'Processus',
    color: '#6366f1',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
      </svg>
    ),
    preview: 'rounded-md border-2 border-indigo-500 bg-white',
  },
  {
    type: 'service',
    label: 'Service / API',
    color: '#0ea5e9',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      </svg>
    ),
    preview: 'rounded-md border-2 border-sky-500 bg-white',
  },
  {
    type: 'actor',
    label: 'Acteur / Rôle',
    color: '#10b981',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    preview: 'rounded-full border-2 border-emerald-500 bg-emerald-50',
  },
  {
    type: 'database',
    label: 'Base de données',
    color: '#f59e0b',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    preview: 'rounded-sm border-2 border-amber-500 bg-amber-50',
  },
  {
    type: 'decision',
    label: 'Décision',
    color: '#8b5cf6',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    preview: 'rotate-45 border-2 border-violet-500 bg-violet-50',
  },
  {
    type: 'start',
    label: 'Début',
    color: '#22c55e',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    preview: 'rounded-full border-2 border-green-500 bg-green-500',
  },
  {
    type: 'end',
    label: 'Fin',
    color: '#ef4444',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    preview: 'rounded-full border-2 border-red-500 bg-red-500',
  },
]

export { NODE_TYPES }

export default function NodePalette({ canEdit }) {
  function onDragStart(e, nodeType) {
    e.dataTransfer.setData('application/reactflow-type', nodeType.type)
    e.dataTransfer.setData('application/reactflow-color', nodeType.color)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="w-48 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Éléments</p>
        {!canEdit && (
          <p className="text-[10px] text-amber-600 mt-0.5">Mode lecture seule</p>
        )}
      </div>
      <div className="flex flex-col gap-1 p-2">
        {NODE_TYPES.map((nt) => (
          <div
            key={nt.type}
            draggable={canEdit}
            onDragStart={(e) => canEdit && onDragStart(e, nt)}
            className={`flex items-center gap-2 px-2 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-700 select-none transition-colors ${canEdit ? 'cursor-grab hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 active:cursor-grabbing' : 'opacity-50 cursor-not-allowed'}`}
          >
            <span style={{ color: nt.color }}>{nt.icon}</span>
            <span className="text-xs font-medium">{nt.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto p-3 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
        Glissez un élément sur le canvas pour l'ajouter. Reliez deux nœuds en tirant un handle.
      </div>
    </aside>
  )
}
