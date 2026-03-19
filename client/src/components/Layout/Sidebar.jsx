import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useProjectStore from '../../store/projectStore'

const POLE_FILTERS = [
  { value: 'all',     label: 'Tous les pôles', icon: '⬡' },
  { value: 'dev',     label: 'Développement',  icon: '💻' },
  { value: 'network', label: 'Réseau',          icon: '🔌' },
]

const NAV_ITEMS = [
  {
    path: '/',
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
]

export default function Sidebar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { filters, setFilter, fetchProjects } = useProjectStore()
  const isAdmin = user?.role === 'admin'

  function handlePoleChange(pole) {
    setFilter('pole', pole)
    fetchProjects()
  }

  return (
    <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            GP
          </div>
          <span className="font-semibold text-sm leading-tight">GProjet</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5">
        {/* Vues */}
        <div>
          <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Vues
          </p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === item.path
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Administration */}
        {(isAdmin || user?.role === 'lead') && (
          <div>
            <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Administration
            </p>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin/users')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  location.pathname === '/admin/users'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === '/admin/tags'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
              </svg>
              Tags
            </button>
          </div>
        )}

        {/* Filtre pôle — masqué pour les membres (restreints côté serveur) */}
        {user?.role !== 'member' && (
          <div>
            <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Pôle
            </p>
            {POLE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handlePoleChange(f.value)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  filters.pole === f.value
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-base">{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* User info */}
      <div className="px-3 py-4 border-t border-gray-700">
        {user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-medium uppercase">
              {user.username[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
