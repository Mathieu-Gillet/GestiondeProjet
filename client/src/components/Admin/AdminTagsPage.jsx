import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tagService } from '../../services/tagService'
import useAuthStore from '../../store/authStore'

const PRESET_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#6B7280',
]

function TagForm({ tag, onSave, onClose }) {
  const isEdit = !!tag
  const [name,  setName]  = useState(tag?.name  || '')
  const [color, setColor] = useState(tag?.color || '#6366F1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setLoading(true)
    try {
      if (isEdit) {
        await tagService.update(tag.id, name.trim(), color)
      } else {
        await tagService.create(name.trim(), color)
      }
      onSave()
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifier le tag' : 'Nouveau tag'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du tag *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex: Urgent, Infrastructure, API..."
              required
              autoFocus
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
            {/* Couleurs prédéfinies */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            {/* Saisie hex */}
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v)
                }}
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="#6B7280"
              />
              {/* Aperçu */}
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: color + '22', color }}
              >
                {name || 'Aperçu'}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors"
            >
              {loading ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminTagsPage() {
  const navigate    = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const [tags,    setTags]    = useState([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState(null) // null | {} | { tag }

  // Redirection si simple membre
  useEffect(() => {
    if (currentUser && currentUser.role === 'member') navigate('/')
  }, [currentUser])

  async function load() {
    setLoading(true)
    const data = await tagService.list()
    setTags(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(tag) {
    if (!confirm(`Supprimer le tag « ${tag.name} » ? Il sera retiré de tous les projets.`)) return
    await tagService.remove(tag.id)
    setTags((prev) => prev.filter((t) => t.id !== tag.id))
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des tags</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tags.length} tag{tags.length > 1 ? 's' : ''} · visible par tous, éditable par admin et responsables
          </p>
        </div>
        <button
          onClick={() => setForm({})}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau tag
        </button>
      </div>

      {/* Grille de tags */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Chargement...</div>
        ) : tags.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Aucun tag créé. Créez votre premier tag pour commencer.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Couleur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aperçu</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{tag.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-mono text-xs text-gray-500">{tag.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: tag.color + '22', color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setForm({ tag })}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(tag)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form !== null && (
        <TagForm
          tag={form.tag || null}
          onSave={() => { setForm(null); load() }}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}
