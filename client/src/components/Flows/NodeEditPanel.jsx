import { useState, useEffect } from 'react'

const PRESET_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#6b7280',
]

const TYPE_LABELS = {
  process:  'Processus',
  service:  'Service / API',
  actor:    'Acteur / Rôle',
  database: 'Base de données',
  decision: 'Décision',
  start:    'Début',
  end:      'Fin',
}

export default function NodeEditPanel({ node, onUpdate, onDelete }) {
  const [label,       setLabel]       = useState('')
  const [description, setDescription] = useState('')
  const [color,       setColor]       = useState('#6B7280')

  useEffect(() => {
    if (node) {
      setLabel(node.data.label || '')
      setDescription(node.data.description || '')
      setColor(node.data.color || '#6B7280')
    }
  }, [node?.id])

  if (!node) {
    return (
      <aside className="w-56 flex-shrink-0 bg-white border-l border-gray-200 flex items-center justify-center">
        <p className="text-xs text-gray-400 text-center px-4">
          Cliquez sur un nœud pour l'éditer
        </p>
      </aside>
    )
  }

  function handleSave() {
    onUpdate(node.id, { label, description, color })
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {TYPE_LABELS[node.type] || node.type}
        </p>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Nom du nœud"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            placeholder="Description courte…"
          />
        </div>

        {/* Couleur */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Couleur</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); onUpdate(node.id, { label, description, color: c }) }}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: color === c ? '#1e293b' : 'transparent',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              onBlur={handleSave}
              className="w-7 h-7 rounded cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              onBlur={handleSave}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Aperçu couleur */}
        <div
          className="h-6 rounded-md border-2 transition-colors"
          style={{ borderColor: color, background: `${color}18` }}
        />

        {/* Supprimer */}
        <button
          onClick={() => onDelete(node.id)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Supprimer ce nœud
        </button>
      </div>
    </aside>
  )
}
