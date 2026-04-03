import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userService } from '../../services/userService'
import useAuthStore from '../../store/authStore'
import { SERVICE_CONFIG, VALID_SERVICES, ROLE_CONFIG } from '../../utils/format'

const EMPTY_FORM = {
  username: '',
  email: '',
  password: '',
  role: 'membre',
  service: 'dev',
  pole: 'dev',
}

function UserForm({ user, onSave, onClose }) {
  const isEdit = !!user
  const [form, setForm] = useState(
    isEdit
      ? {
          username: user.username,
          email: user.email,
          password: '',
          role: user.role,
          service: user.service || user.pole || 'dev',
          pole: user.pole || 'dev',
        }
      : { ...EMPTY_FORM }
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Synchronise pole avec service pour la compat backend
  function handleServiceChange(value) {
    setForm((prev) => ({
      ...prev,
      service: value,
      pole: value === 'network' ? 'network' : 'dev',
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        username: form.username,
        email: form.email,
        role: form.role,
        service: form.service,
        pole: form.service === 'network' ? 'network' : 'dev',
      }
      if (form.password) payload.password = form.password
      if (!isEdit && !form.password) {
        setError('Le mot de passe est requis.')
        setLoading(false)
        return
      }

      if (isEdit) {
        await userService.update(user.id, payload)
      } else {
        await userService.create(payload)
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
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifier le compte' : 'Créer un compte'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant *</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setField('username', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex: j.dupont"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="prenom.nom@entreprise.fr"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe {isEdit && <span className="text-gray-400 font-normal">(laisser vide pour ne pas changer)</span>}
              {!isEdit && '*'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={isEdit ? '••••••••' : 'Minimum 6 caractères'}
              minLength={form.password ? 6 : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
              <select
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="membre">Membre</option>
                <option value="responsable">Responsable</option>
                <option value="directeur">Directeur</option>
                <option value="dsi">DSI</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
              <select
                value={form.service}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={form.role === 'admin'}
                title={form.role === 'admin' ? 'L\'admin a accès à tous les services' : ''}
              >
                {VALID_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_CONFIG[s]?.icon} {SERVICE_CONFIG[s]?.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.role === 'dsi' && (
            <p className="text-xs text-cyan-700 bg-cyan-50 px-3 py-2 rounded-lg">
              DSI — droits directeur (créer, modifier, supprimer) sur les services Développement et Réseau.
            </p>
          )}
          {form.role === 'admin' && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
              Les comptes Administrateur ont accès à tout le système (réservé au compte local).
            </p>
          )}
          {form.role === 'directeur' && form.service === 'direction_generale' && (
            <p className="text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
              Directeur en Direction Générale — tous droits sur tous les services.
            </p>
          )}
          {form.role === 'directeur' && form.service !== 'direction_generale' && (
            <p className="text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
              Directeur — tous droits (créer, modifier, supprimer) sur son service.
            </p>
          )}
          {form.role === 'responsable' && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              Responsable — peut créer et modifier dans son service, mais pas supprimer.
            </p>
          )}

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
              {loading ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const navigate  = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [form,       setForm]       = useState(null)
  const [search,     setSearch]     = useState('')
  const [serviceTab, setServiceTab] = useState('all')

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') navigate('/')
  }, [currentUser])

  async function load() {
    setLoading(true)
    const data = await userService.list()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(user) {
    if (!confirm(`Supprimer le compte « ${user.username} » ?`)) return
    await userService.remove(user.id)
    setUsers((prev) => prev.filter((u) => u.id !== user.id))
  }

  // Services présents dans la liste, dans l'ordre de SERVICE_CONFIG
  const presentServices = VALID_SERVICES.filter((s) => users.some((u) => (u.service || u.pole) === s))

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchService = serviceTab === 'all' || (u.service || u.pole) === serviceTab
    return matchSearch && matchService
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des comptes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} compte{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setForm({})}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau compte
        </button>
      </div>

      {/* Sous-onglets par service */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button
          onClick={() => setServiceTab('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            serviceTab === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tous
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${serviceTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
            {users.length}
          </span>
        </button>
        {presentServices.map((s) => {
          const cfg   = SERVICE_CONFIG[s]
          const count = users.filter((u) => (u.service || u.pole) === s).length
          const active = serviceTab === s
          return (
            <button
              key={s}
              onClick={() => setServiceTab(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active ? `${cfg.color} ring-1 ring-current` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{cfg.icon}</span>
              {cfg.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/40' : 'bg-gray-200 text-gray-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisateur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Créé le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Chargement...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                {serviceTab !== 'all'
                  ? `Aucun compte dans ${SERVICE_CONFIG[serviceTab]?.label || serviceTab}${search ? ' pour cette recherche' : ''}.`
                  : 'Aucun compte trouvé.'}
              </td></tr>
            )}
            {filtered.map((u) => {
              const role = ROLE_CONFIG[u.role] || { label: u.role, color: 'bg-gray-100 text-gray-600' }
              const svc = u.service || u.pole
              const svcCfg = SERVICE_CONFIG[svc]
              const isSelf = u.id === currentUser?.id
              return (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${isSelf ? 'bg-indigo-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold uppercase flex-shrink-0">
                        {u.username[0]}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{u.username}</span>
                        {isSelf && <span className="ml-2 text-xs text-indigo-500">(vous)</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${role.color}`}>
                      {role.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {svcCfg ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${svcCfg.color}`}>
                        {svcCfg.icon} {svcCfg.label}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setForm({ user: u })}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isSelf}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={isSelf ? 'Vous ne pouvez pas supprimer votre propre compte' : ''}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {form !== null && (
        <UserForm
          user={form.user || null}
          onSave={() => { setForm(null); load() }}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}
