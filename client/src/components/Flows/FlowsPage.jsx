import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useFlowStore from '../../store/flowStore'

const POLE_LABELS = { dev: 'Dev', network: 'Réseau', all: 'Tous pôles' }
const POLE_COLORS = {
  dev:     'bg-indigo-100 text-indigo-700',
  network: 'bg-cyan-100 text-cyan-700',
  all:     'bg-gray-100 text-gray-600',
}

function NewDiagramModal({ onClose, onCreate }) {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [pole,        setPole]        = useState('all')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est obligatoire'); return }
    setLoading(true)
    try {
      await onCreate({ title: title.trim(), description: description.trim(), pole })
      onClose()
    } catch {
      setError('Erreur lors de la création')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Nouveau diagramme de flux</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Flux de validation des tickets"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Description du diagramme…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pôle</label>
            <select
              value={pole}
              onChange={(e) => setPole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tous les pôles</option>
              <option value="dev">Dev</option>
              <option value="network">Réseau</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FlowsPage() {
  const navigate      = useNavigate()
  const user          = useAuthStore((s) => s.user)
  const { diagrams, loading, fetchDiagrams, createDiagram, deleteDiagram } = useFlowStore()
  const [showNew,     setShowNew]     = useState(false)
  const [deleting,    setDeleting]    = useState(null)

  const canEdit = user?.role === 'admin' || user?.role === 'lead'

  useEffect(() => { fetchDiagrams() }, [])

  async function handleCreate(data) {
    const diagram = await createDiagram(data)
    navigate(`/flows/${diagram.id}`)
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!window.confirm('Supprimer ce diagramme ? Cette action est irréversible.')) return
    setDeleting(id)
    try {
      await deleteDiagram(id)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cartographie des flux métiers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visualisez et documentez vos processus IT</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau diagramme
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : diagrams.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-14 h-14 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p className="font-medium text-gray-500">Aucun diagramme</p>
          {canEdit && (
            <p className="text-sm mt-1">
              Créez votre premier diagramme de flux métiers.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {diagrams.map((d) => (
            <div
              key={d.id}
              onClick={() => navigate(`/flows/${d.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                    {d.title}
                  </h3>
                  {d.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{d.description}</p>
                  )}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${POLE_COLORS[d.pole] || POLE_COLORS.all}`}>
                  {POLE_LABELS[d.pole] || d.pole}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {d.author ? `Par ${d.author}` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <span>{new Date(d.updated_at).toLocaleDateString('fr-FR')}</span>
                  {canEdit && (
                    <button
                      onClick={(e) => handleDelete(e, d.id)}
                      disabled={deleting === d.id}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Preview placeholder */}
              <div className="mt-3 h-16 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewDiagramModal
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
