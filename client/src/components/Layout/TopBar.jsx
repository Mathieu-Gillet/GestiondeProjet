import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useProjectStore from '../../store/projectStore'
import ProjectForm from '../Project/ProjectForm'
import { notificationService } from '../../services/notificationService'
import { SERVICE_CONFIG, VALID_SERVICES, canManage } from '../../utils/format'

const NAV_ITEMS = [
  {
    path: '/projects/board',
    label: 'Projets',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    path: '/calendar',
    label: 'Calendrier',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    path: '/archives',
    label: 'Archives',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    path: '/mon-espace',
    label: 'Mon espace',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

function NotificationBell() {
  const [notifs, setNotifs] = useState([])
  const [open, setOpen]     = useState(false)
  const dropRef             = useRef(null)
  const sseSource           = useProjectStore((s) => s._sseSource)

  const unread = notifs.filter((n) => !n.read).length

  useEffect(() => {
    notificationService.list().then(setNotifs).catch(() => {})
  }, [])

  useEffect(() => {
    if (!sseSource) return
    function onNotif(e) {
      const data = JSON.parse(e.data || '{}')
      setNotifs((prev) => [{ ...data, read: 0, created_at: new Date().toISOString() }, ...prev])
    }
    sseSource.addEventListener('notification', onNotif)
    return () => sseSource.removeEventListener('notification', onNotif)
  }, [sseSource])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleOpen() {
    setOpen((v) => !v)
    if (!open && unread > 0) {
      await notificationService.markAllRead().catch(() => {})
      setNotifs((prev) => prev.map((n) => ({ ...n, read: 1 })))
    }
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={handleOpen}
        title="Notifications"
        className="relative p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
            {notifs.length > 0 && (
              <button
                onClick={async () => {
                  await notificationService.markAllRead().catch(() => {})
                  setNotifs((p) => p.map((n) => ({ ...n, read: 1 })))
                }}
                className="text-[10px] text-gray-400 hover:text-indigo-600"
              >
                Tout marquer lu
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifs.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8">Aucune notification</p>
            ) : (
              notifs.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 text-xs ${n.read ? 'text-gray-500' : 'bg-indigo-50 text-gray-700 font-medium'}`}
                >
                  <p className="leading-snug">{n.message}</p>
                  <p className="text-gray-400 mt-0.5 font-normal">
                    {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { filters, setFilter, fetchProjects } = useProjectStore()
  const [showForm, setShowForm] = useState(false)

  const isAdmin   = user?.role === 'admin'
  const canCreate = canManage(user)
  const canSeeAll = isAdmin || user?.service === 'direction_generale'
  const userService  = user?.service || 'dev'
  const serviceCfg   = SERVICE_CONFIG[userService]

  function handleServiceChange(service) {
    setFilter('service', service)
    fetchProjects()
  }

  const isProjectsActive = location.pathname.startsWith('/projects') || location.pathname === '/'

  return (
    <>
      <header className="bg-white h-14 px-6 flex items-center flex-shrink-0 border-b border-gray-200">
        {/* Logo — zone gauche fixe */}
        <div className="flex items-center gap-2 pr-5 border-r border-gray-200 flex-shrink-0">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            GP
          </div>
          <span className="font-semibold text-sm text-gray-800 whitespace-nowrap">GProjet</span>
        </div>

        {/* Navigation principale — centrée */}
        <nav className="flex items-center gap-1 flex-1 justify-center">
          {NAV_ITEMS.map((item) => {
            const isActive = item.path === '/projects/board' ? isProjectsActive : location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}

          {/* Administration — intégrée dans la nav centrale */}
          {(isAdmin || ['directeur', 'responsable'].includes(user?.role)) && (
            <>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin/users')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    location.pathname === '/admin/users'
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Comptes
                </button>
              )}
              <button
                onClick={() => navigate('/admin/tags')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  location.pathname === '/admin/tags'
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                </svg>
                Tags
              </button>
              {/* LDAP : admin local uniquement (sans ldap_dn) */}
              {isAdmin && !user?.ldap_dn && (
                <button
                  onClick={() => navigate('/admin/ldap')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    location.pathname === '/admin/ldap'
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  LDAP / AD
                </button>
              )}
            </>
          )}
        </nav>

        {/* Zone droite — actions */}
        <div className="flex items-center gap-3 flex-shrink-0 pl-5 border-l border-gray-200">

        {/* Sélecteur de service — admin et Direction Générale uniquement */}
        {canSeeAll && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Service :</span>
            <select
              value={filters.service || 'all'}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              <option value="all">Tous les services</option>
              {VALID_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_CONFIG[s]?.icon} {SERVICE_CONFIG[s]?.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Badge service (utilisateurs non-admin/non-DG) */}
        {!canSeeAll && serviceCfg && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${serviceCfg.color}`}>
            {serviceCfg.icon} {serviceCfg.label}
          </span>
        )}

        {/* Nouveau projet */}
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau projet
          </button>
        )}

        {/* Cloche notifications */}
        <NotificationBell />

        {/* Utilisateur + déconnexion */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-700 uppercase flex-shrink-0">
            {user?.username?.[0]}
          </div>
          <div className="text-xs leading-tight">
            <p className="font-medium text-gray-800 truncate max-w-[80px]">{user?.username}</p>
            <p className="text-gray-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Déconnexion"
            className="ml-1 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
        </div>{/* fin zone droite */}
      </header>

      {showForm && <ProjectForm onClose={() => setShowForm(false)} />}
    </>
  )
}
