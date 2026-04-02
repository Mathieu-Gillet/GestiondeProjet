import { useState, useEffect } from 'react'
import api from '../../services/api'

/* ─────────────────────────── Constantes ─────────────────────────── */

const GROUP_LABELS = {
  group_dev:     'Groupe Développement',
  group_network: 'Groupe Réseau',
  group_rh:      'Groupe RH',
  group_dg:      'Groupe Direction Générale',
  group_tech:    'Groupe Services Techniques',
  group_achats:  'Groupe Achats',
  group_admin:   'Groupe Administrateurs',
  group_dsi:     'Groupe DSI',
}

const SERVICE_LABELS = {
  dev:                 'Développement',
  network:             'Réseau',
  rh:                  'RH',
  direction_generale:  'Direction',
  services_techniques: 'Technique',
  achats:              'Achats',
}

const defaultForm = {
  enabled: false,
  url: '',
  base_dn: '',
  bind_dn: '',
  bind_password: '',
  user_search_base: '',
  user_search_filter: '(sAMAccountName={{username}})',
  tls_reject_unauthorized: true,
  use_starttls: false,
  group_dev: '',
  group_network: '',
  group_rh: '',
  group_dg: '',
  group_tech: '',
  group_achats: '',
  group_admin: '',
  group_dsi: '',
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono'

/* ─────────────────────────── Composant principal ─────────────────────────── */

export default function AdminLdapPage() {
  const [tab, setTab] = useState('config')

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* En-tête */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          LDAP / Active Directory
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configuration de l'annuaire et import des utilisateurs. Accessible uniquement à l'administrateur local.
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabButton active={tab === 'config'} onClick={() => setTab('config')}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />}
          label="Configuration"
        />
        <TabButton active={tab === 'import'} onClick={() => setTab('import')}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />}
          label="Importer des utilisateurs"
        />
        <TabButton active={tab === 'imported'} onClick={() => setTab('imported')}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />}
          label="Utilisateurs importés"
        />
      </div>

      {tab === 'config'   && <ConfigTab />}
      {tab === 'import'   && <ImportTab />}
      {tab === 'imported' && <ImportedUsersTab />}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon}
      </svg>
      {label}
    </button>
  )
}

/* ─────────────────────────── Onglet Configuration ─────────────────────────── */

function ConfigTab() {
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/admin/ldap')
      .then((r) => {
        const data = r.data
        setForm({
          enabled:                 data.enabled ?? false,
          url:                     data.url || '',
          base_dn:                 data.base_dn || '',
          bind_dn:                 data.bind_dn || '',
          bind_password:           data._has_password ? '••••••••' : '',
          user_search_base:        data.user_search_base || '',
          user_search_filter:      data.user_search_filter || '(sAMAccountName={{username}})',
          tls_reject_unauthorized: data.tls_reject_unauthorized ?? true,
          use_starttls:            data.use_starttls ?? false,
          group_dev:               data.group_dev || '',
          group_network:           data.group_network || '',
          group_rh:                data.group_rh || '',
          group_dg:                data.group_dg || '',
          group_tech:              data.group_tech || '',
          group_achats:            data.group_achats || '',
          group_admin:             data.group_admin || '',
          group_dsi:               data.group_dsi || '',
        })
      })
      .catch((e) => setError(e.response?.data?.error || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaveMsg(null)
    setTestResult(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    try {
      await api.put('/admin/ldap', form)
      setSaveMsg({ type: 'success', text: 'Configuration sauvegardée avec succès' })
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.response?.data?.error || 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await api.post('/admin/ldap/test', form)
      setTestResult({ success: true, message: r.data.message })
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.message || e.response?.data?.error || 'Connexion échouée' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <Spinner text="Chargement de la configuration LDAP..." />
  if (error) return <ErrorBox message={error} />

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-3xl">

      {/* Activation */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} />
          <div>
            <p className="text-sm font-medium text-gray-900">Activer l'authentification LDAP</p>
            <p className="text-xs text-gray-500">
              {form.enabled
                ? 'Les utilisateurs peuvent se connecter via l\'annuaire LDAP/AD'
                : 'LDAP désactivé — seul le compte admin local peut se connecter'}
            </p>
          </div>
        </label>
      </div>

      {/* Test de connexion */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Test de connexion</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vérifie que le serveur LDAP est joignable et que le compte de service peut se connecter</p>
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !form.url || !form.bind_dn}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {testing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {testing ? 'Test en cours...' : 'Tester la connexion'}
          </button>
        </div>
        <div className="px-5 py-4">
          {testResult ? (
            <div className={`flex items-start gap-2 text-sm rounded-lg px-4 py-3 ${
              testResult.success
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {testResult.success
                ? <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              }
              <span>{testResult.message}</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Cliquez sur "Tester la connexion" pour vérifier que les paramètres serveur et le compte de service sont corrects.
              Le test utilise les valeurs actuelles du formulaire (même non sauvegardées).
            </p>
          )}
        </div>
      </div>

      {/* Connexion au serveur */}
      <Section title="Connexion au serveur">
        <Field label="URL du serveur LDAP" help="Utilisez ldaps:// pour une connexion chiffrée TLS">
          <input type="text" value={form.url} onChange={(e) => set('url', e.target.value)}
            placeholder="ldap://192.168.1.10:389 ou ldaps://..." className={inputClass} />
        </Field>
        <Field label="Base DN">
          <input type="text" value={form.base_dn} onChange={(e) => set('base_dn', e.target.value)}
            placeholder="DC=monentreprise,DC=local" className={inputClass} />
        </Field>
        <Field label="Options TLS">
          <div className="space-y-2 mt-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.tls_reject_unauthorized}
                onChange={(e) => set('tls_reject_unauthorized', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              Vérifier le certificat TLS (décocher pour les certificats auto-signés)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.use_starttls}
                onChange={(e) => set('use_starttls', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              Utiliser STARTTLS (montée en TLS sur ldap:// port 389 — à activer si vous obtenez ECONNRESET)
            </label>
          </div>
        </Field>
      </Section>

      {/* Compte de service */}
      <Section title="Compte de service (lecture seule)">
        <Field label="DN du compte de service" help="Compte en lecture seule utilisé pour parcourir l'annuaire">
          <input type="text" value={form.bind_dn} onChange={(e) => set('bind_dn', e.target.value)}
            placeholder="CN=svc-gestion,OU=Services,DC=monentreprise,DC=local" className={inputClass} />
        </Field>
        <Field label="Mot de passe du compte de service">
          <input type="password" value={form.bind_password} onChange={(e) => set('bind_password', e.target.value)}
            placeholder="Laisser vide pour conserver l'actuel" className={inputClass} />
        </Field>
      </Section>

      {/* Recherche des utilisateurs */}
      <Section title="Recherche des utilisateurs">
        <Field label="Base de recherche" help="Laisser vide pour utiliser la Base DN">
          <input type="text" value={form.user_search_base} onChange={(e) => set('user_search_base', e.target.value)}
            placeholder="OU=Utilisateurs,DC=monentreprise,DC=local" className={inputClass} />
        </Field>
        <Field label="Filtre de recherche" help="Utilisez {{username}} comme variable. AD: (sAMAccountName={{username}}) — OpenLDAP: (uid={{username}})">
          <input type="text" value={form.user_search_filter} onChange={(e) => set('user_search_filter', e.target.value)}
            placeholder="(sAMAccountName={{username}})" className={inputClass} />
        </Field>
      </Section>

      {/* Correspondance des groupes */}
      <Section title="Correspondance des groupes" subtitle="DN complet des groupes LDAP → services/rôles — laisser vide si inutilisé">
        {Object.entries(GROUP_LABELS).map(([key, label]) => (
          <Field key={key} label={label}>
            <input type="text" value={form[key]} onChange={(e) => set(key, e.target.value)}
              placeholder="CN=GRP-...,OU=Groupes,DC=monentreprise,DC=local" className={inputClass} />
          </Field>
        ))}
      </Section>

      {/* Message de sauvegarde */}
      {saveMsg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          saveMsg.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {saveMsg.text}
        </div>
      )}

      {/* Bouton sauvegarder */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {saving ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {saving ? 'Sauvegarde...' : 'Sauvegarder la configuration'}
        </button>
      </div>
    </form>
  )
}

const ROLE_OPTIONS = [
  { value: 'membre',      label: 'Membre' },
  { value: 'responsable', label: 'Responsable' },
  { value: 'directeur',   label: 'Directeur' },
  { value: 'dsi',         label: 'DSI' },
]

const SERVICE_OPTIONS = Object.entries(SERVICE_LABELS)

/* ─────────────────────────── Onglet Import ─────────────────────────── */

function ImportTab() {
  const [search, setSearch]           = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [users, setUsers]             = useState([])
  // overrides: { [dn]: { service, role } } — surcharges manuelles par utilisateur
  const [overrides, setOverrides]     = useState({})
  const [searched, setSearched]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [importing, setImporting]     = useState(false)
  const [selected, setSelected]       = useState(new Set())
  const [importResult, setImportResult] = useState(null)
  const [error, setError]             = useState(null)

  // Utilisateurs filtrés par service (si filtre actif)
  const displayed = serviceFilter
    ? users.filter((u) => effectiveService(u, overrides) === serviceFilter)
    : users

  function effectiveService(u, ovr) {
    return ovr[u.dn]?.service ?? u.mapped_service
  }
  function effectiveRole(u, ovr) {
    return ovr[u.dn]?.role ?? u.mapped_role
  }

  function setOverride(dn, field, value) {
    setOverrides((prev) => ({ ...prev, [dn]: { ...(prev[dn] || {}), [field]: value } }))
  }

  async function handleSearch(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setImportResult(null)
    setSelected(new Set())
    setOverrides({})
    try {
      const r = await api.get('/admin/ldap/users', { params: { q: search } })
      setUsers(r.data.users || [])
      setSearched(true)
    } catch (e) {
      setError(e.response?.data?.error || 'Erreur lors de la recherche')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(dn) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(dn) ? next.delete(dn) : next.add(dn)
      return next
    })
  }

  function toggleAll() {
    const selectable = displayed.filter((u) => !u.disabled).map((u) => u.dn)
    const allSel = selectable.every((dn) => selected.has(dn))
    if (allSel) {
      setSelected((prev) => { const next = new Set(prev); selectable.forEach((dn) => next.delete(dn)); return next })
    } else {
      setSelected((prev) => { const next = new Set(prev); selectable.forEach((dn) => next.add(dn)); return next })
    }
  }

  async function handleImport() {
    if (selected.size === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      // Envoyer toutes les données connues (username, email…) pour éviter
      // un re-fetch LDAP côté serveur qui peut échouer avec sizeLimit > 200
      const usersPayload = Array.from(selected).map((dn) => {
        const u = users.find((u) => u.dn === dn)
        return {
          dn,
          username:    u?.username    || '',
          email:       u?.email       || '',
          displayName: u?.displayName || '',
          service:     effectiveService(u, overrides),
          role:        effectiveRole(u, overrides),
        }
      })
      const r = await api.post('/admin/ldap/import', { users: usersPayload })
      setImportResult({ type: 'success', ...r.data })
      // Rafraîchir le statut des utilisateurs
      const refreshed = await api.get('/admin/ldap/users', { params: { q: search } })
      setUsers(refreshed.data.users || [])
      setSelected(new Set())
      setOverrides({})
    } catch (e) {
      setImportResult({ type: 'error', message: e.response?.data?.error || 'Erreur lors de l\'import' })
    } finally {
      setImporting(false)
    }
  }

  const selectableDisplayed = displayed.filter((u) => !u.disabled)
  const allDisplayedSelected = selectableDisplayed.length > 0 && selectableDisplayed.every((u) => selected.has(u.dn))
  const someDisplayedSelected = selectableDisplayed.some((u) => selected.has(u.dn)) && !allDisplayedSelected

  // Compter les services distincts dans les résultats pour afficher le filtre
  const servicesCounts = users.reduce((acc, u) => {
    const s = effectiveService(u, overrides)
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Barre de recherche */}
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Rechercher dans l'annuaire</h2>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, identifiant ou email (laisser vide pour tout afficher)"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors whitespace-nowrap"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Recherche sur le nom, l'identifiant (sAMAccountName) et l'email. Maximum 200 résultats.
        </p>
      </form>

      {/* Erreur */}
      {error && <ErrorBox message={error} />}

      {/* Résultat import */}
      {importResult && (
        <div className={`rounded-xl px-5 py-4 text-sm border ${
          importResult.type === 'success'
            ? (importResult.skipped > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800')
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <p className="font-medium">{importResult.message}</p>
          {importResult.type === 'success' && (
            <div className="flex gap-4 mt-2 text-xs flex-wrap">
              {importResult.created > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  {importResult.created} créé(s)
                </span>
              )}
              {importResult.updated > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  {importResult.updated} mis à jour
                </span>
              )}
              {importResult.skipped > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  {importResult.skipped} ignoré(s)
                </span>
              )}
            </div>
          )}
          {/* Détail des erreurs d'import */}
          {importResult.errors?.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold opacity-80">Détail des erreurs :</p>
              {importResult.errors.map((e, i) => (
                <div key={i} className="text-xs font-mono bg-black/5 rounded px-2 py-1">
                  <span className="opacity-60 truncate">{e.dn?.split(',')[0]} </span>
                  <span className="font-medium">→ {e.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tableau des utilisateurs */}
      {searched && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Barre d'actions */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allDisplayedSelected}
                  ref={(el) => { if (el) el.indeterminate = someDisplayedSelected }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  {selected.size > 0
                    ? `${selected.size} sélectionné(s)`
                    : `${displayed.length} / ${users.length} utilisateur(s)`}
                </span>
              </label>

              {/* Filtre par service */}
              {users.length > 0 && Object.keys(servicesCounts).length > 1 && (
                <select
                  value={serviceFilter}
                  onChange={(e) => { setServiceFilter(e.target.value); setSelected(new Set()) }}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
                >
                  <option value="">Tous les services ({users.length})</option>
                  {Object.entries(servicesCounts).map(([s, n]) => (
                    <option key={s} value={s}>{SERVICE_LABELS[s] || s} ({n})</option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-1.5 text-sm transition-colors"
            >
              {importing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              {importing ? 'Import...' : `Importer la sélection (${selected.size})`}
            </button>
          </div>

          {displayed.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Aucun utilisateur trouvé pour cette recherche.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-3 text-left w-8"></th>
                    <th className="px-4 py-3 text-left">Identifiant</th>
                    <th className="px-4 py-3 text-left">Nom complet</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Service</th>
                    <th className="px-4 py-3 text-left">Rôle</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayed.map((u) => {
                    const svc  = effectiveService(u, overrides)
                    const role = effectiveRole(u, overrides)
                    const isOverridden = overrides[u.dn]?.service || overrides[u.dn]?.role
                    return (
                      <tr
                        key={u.dn}
                        className={`transition-colors ${
                          u.disabled ? 'opacity-40' : selected.has(u.dn) ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(u.dn)}
                            disabled={u.disabled}
                            onChange={() => toggleSelect(u.dn)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td
                          className="px-4 py-2.5 font-mono text-xs text-gray-700 cursor-pointer"
                          onClick={() => !u.disabled && toggleSelect(u.dn)}
                        >{u.username}</td>
                        <td
                          className="px-4 py-2.5 text-gray-900 cursor-pointer"
                          onClick={() => !u.disabled && toggleSelect(u.dn)}
                        >{u.displayName || '—'}</td>
                        <td
                          className="px-4 py-2.5 text-gray-500 text-xs cursor-pointer"
                          onClick={() => !u.disabled && toggleSelect(u.dn)}
                        >{u.email || '—'}</td>

                        {/* Service — sélectable */}
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={svc}
                            disabled={u.disabled}
                            onChange={(e) => setOverride(u.dn, 'service', e.target.value)}
                            className={`text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                              isOverridden && overrides[u.dn]?.service
                                ? 'border-amber-400 bg-amber-50 text-amber-800'
                                : 'border-gray-200 bg-gray-50 text-gray-700'
                            }`}
                          >
                            {SERVICE_OPTIONS.map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </td>

                        {/* Rôle — sélectable */}
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={role}
                            disabled={u.disabled}
                            onChange={(e) => setOverride(u.dn, 'role', e.target.value)}
                            className={`text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                              isOverridden && overrides[u.dn]?.role
                                ? 'border-amber-400 bg-amber-50 text-amber-800'
                                : 'border-gray-200 bg-gray-50 text-gray-700'
                            }`}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </td>

                        <td
                          className="px-4 py-2.5 cursor-pointer"
                          onClick={() => !u.disabled && toggleSelect(u.dn)}
                        >
                          {u.disabled ? (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                              Désactivé
                            </span>
                          ) : u.already_imported ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                              Déjà importé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                              Nouveau
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!searched && !error && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Lancez une recherche pour afficher les utilisateurs de l'annuaire</p>
          <p className="text-xs mt-1">La configuration LDAP doit être sauvegardée et activée</p>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────── Onglet Utilisateurs importés ──────────────────────── */

function ImportedUsersTab() {
  const [search, setSearch]   = useState('')
  const [query, setQuery]     = useState('')
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    fetchUsers(query)
  }, [query])

  async function fetchUsers(q) {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get('/admin/ldap/imported', { params: { q } })
      setUsers(r.data.users || [])
    } catch (e) {
      setError(e.response?.data?.error || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setQuery(search.trim())
  }

  return (
    <div className="space-y-5">
      {/* Barre de recherche */}
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Utilisateurs importés depuis l'annuaire</h2>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par identifiant ou email..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Rechercher
          </button>
          {query && (
            <button
              type="button"
              onClick={() => { setSearch(''); setQuery('') }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Effacer
            </button>
          )}
        </div>
      </form>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Spinner text="Chargement des utilisateurs importés..." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-600 font-medium">
              {users.length} utilisateur{users.length !== 1 ? 's' : ''} importé{users.length !== 1 ? 's' : ''}
              {query ? ` pour "${query}"` : ''}
            </span>
          </div>

          {users.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              {query
                ? 'Aucun utilisateur importé ne correspond à cette recherche.'
                : 'Aucun utilisateur importé depuis l\'annuaire pour l\'instant.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-3 text-left">Identifiant</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Service</th>
                    <th className="px-4 py-3 text-left">Rôle</th>
                    <th className="px-4 py-3 text-left">DN LDAP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900">{u.username}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {SERVICE_LABELS[u.service] || u.service}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-xs truncate" title={u.ldap_dn}>
                        {u.ldap_dn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RoleBadge({ role }) {
  const colors = {
    dsi:         'bg-cyan-100 text-cyan-700',
    directeur:   'bg-purple-100 text-purple-700',
    responsable: 'bg-amber-100 text-amber-700',
    membre:      'bg-gray-100 text-gray-600',
    admin:       'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[role] || 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  )
}

/* ─────────────────────────── Composants partagés ─────────────────────────── */

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, help, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {help && <p className="mt-1 text-xs text-gray-400">{help}</p>}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div className="relative flex-shrink-0" onClick={() => onChange(!checked)}>
      <div className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`} />
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </div>
  )
}

function Spinner({ text }) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm gap-2">
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text}
    </div>
  )
}

function ErrorBox({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm flex items-start gap-2">
      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      {message}
    </div>
  )
}
