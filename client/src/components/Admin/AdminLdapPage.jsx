import { useState, useEffect } from 'react'
import api from '../../services/api'

const FIELD_LABELS = {
  url:                    { label: 'URL du serveur LDAP', placeholder: 'ldap://192.168.1.10:389 ou ldaps://...', help: 'Utilisez ldaps:// pour une connexion chiffrée' },
  base_dn:                { label: 'Base DN', placeholder: 'DC=monentreprise,DC=local' },
  bind_dn:                { label: 'DN du compte de service', placeholder: 'CN=svc-gestion,OU=Services,DC=monentreprise,DC=local', help: 'Compte en lecture seule pour les recherches' },
  bind_password:          { label: 'Mot de passe du compte de service', placeholder: '••••••••', type: 'password' },
  user_search_base:       { label: 'Base de recherche des utilisateurs', placeholder: 'OU=Utilisateurs,DC=monentreprise,DC=local', help: 'Laisser vide pour utiliser la Base DN' },
  user_search_filter:     { label: 'Filtre de recherche utilisateur', placeholder: '(sAMAccountName={{username}})', help: 'Utilisez {{username}} comme variable. AD: (sAMAccountName={{username}}) — OpenLDAP: (uid={{username}})' },
}

const GROUP_LABELS = {
  group_dev:     'Groupe Développement',
  group_network: 'Groupe Réseau',
  group_rh:      'Groupe RH',
  group_dg:      'Groupe Direction Générale',
  group_tech:    'Groupe Services Techniques',
  group_achats:  'Groupe Achats',
  group_admin:   'Groupe Administrateurs',
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
  group_dev: '',
  group_network: '',
  group_rh: '',
  group_dg: '',
  group_tech: '',
  group_achats: '',
  group_admin: '',
}

export default function AdminLdapPage() {
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
          group_dev:               data.group_dev || '',
          group_network:           data.group_network || '',
          group_rh:                data.group_rh || '',
          group_dg:                data.group_dg || '',
          group_tech:              data.group_tech || '',
          group_achats:            data.group_achats || '',
          group_admin:             data.group_admin || '',
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
      await api.put('/admin/ldap', { ...form, tls_reject_unauthorized: form.tls_reject_unauthorized })
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
      const r = await api.post('/admin/ldap/test', { ...form, tls_reject_unauthorized: form.tls_reject_unauthorized })
      setTestResult({ success: true, message: r.data.message })
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.message || e.response?.data?.error || 'Connexion échouée' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Chargement de la configuration LDAP...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Configuration LDAP / Active Directory
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Paramétrez la connexion à votre annuaire. Cette page n'est accessible qu'à l'administrateur local.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Activation */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={form.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Activer l'authentification LDAP</p>
              <p className="text-xs text-gray-500">
                {form.enabled
                  ? 'Le mode LDAP est activé — les utilisateurs se connectent via l\'annuaire'
                  : 'Le mode LDAP est désactivé — seul le compte admin local peut se connecter'}
              </p>
            </div>
          </label>
        </div>

        {/* Connexion au serveur */}
        <Section title="Connexion au serveur">
          <Field label={FIELD_LABELS.url.label} help={FIELD_LABELS.url.help}>
            <input
              type="text"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder={FIELD_LABELS.url.placeholder}
              className={inputClass}
            />
          </Field>
          <Field label={FIELD_LABELS.base_dn.label}>
            <input
              type="text"
              value={form.base_dn}
              onChange={(e) => set('base_dn', e.target.value)}
              placeholder={FIELD_LABELS.base_dn.placeholder}
              className={inputClass}
            />
          </Field>
          <Field label="Certificat TLS">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={form.tls_reject_unauthorized}
                onChange={(e) => set('tls_reject_unauthorized', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Vérifier le certificat TLS (décocher pour les certificats auto-signés)
            </label>
          </Field>
        </Section>

        {/* Compte de service */}
        <Section title="Compte de service (lecture seule)">
          <Field label={FIELD_LABELS.bind_dn.label} help={FIELD_LABELS.bind_dn.help}>
            <input
              type="text"
              value={form.bind_dn}
              onChange={(e) => set('bind_dn', e.target.value)}
              placeholder={FIELD_LABELS.bind_dn.placeholder}
              className={inputClass}
            />
          </Field>
          <Field label={FIELD_LABELS.bind_password.label}>
            <input
              type="password"
              value={form.bind_password}
              onChange={(e) => set('bind_password', e.target.value)}
              placeholder="Laisser vide pour conserver l'actuel"
              className={inputClass}
            />
          </Field>
        </Section>

        {/* Recherche des utilisateurs */}
        <Section title="Recherche des utilisateurs">
          <Field label={FIELD_LABELS.user_search_base.label} help={FIELD_LABELS.user_search_base.help}>
            <input
              type="text"
              value={form.user_search_base}
              onChange={(e) => set('user_search_base', e.target.value)}
              placeholder={FIELD_LABELS.user_search_base.placeholder}
              className={inputClass}
            />
          </Field>
          <Field label={FIELD_LABELS.user_search_filter.label} help={FIELD_LABELS.user_search_filter.help}>
            <input
              type="text"
              value={form.user_search_filter}
              onChange={(e) => set('user_search_filter', e.target.value)}
              placeholder={FIELD_LABELS.user_search_filter.placeholder}
              className={inputClass}
            />
          </Field>
        </Section>

        {/* Groupes */}
        <Section title="Correspondance des groupes" subtitle="DN complet des groupes LDAP — laisser vide si inutilisé">
          {Object.entries(GROUP_LABELS).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={`CN=GRP-...,OU=Groupes,DC=monentreprise,DC=local`}
                className={inputClass}
              />
            </Field>
          ))}
        </Section>

        {/* Résultat du test */}
        {testResult && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
            testResult.success
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {testResult.success
              ? <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            }
            {testResult.message}
          </div>
        )}

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

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !form.url || !form.bind_dn}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {testing ? 'Test en cours...' : 'Tester la connexion'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono'

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
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
