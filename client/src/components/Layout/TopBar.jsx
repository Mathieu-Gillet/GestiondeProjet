import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useProjectStore from '../../store/projectStore'
import ProjectForm from '../Project/ProjectForm'

const POLE_FILTERS = [
  { value: 'all',     label: 'Tous' },
  { value: 'dev',     label: 'Dev' },
  { value: 'network', label: 'Réseau' },
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
  {
    path: '/flows',
    label: 'Flux métiers',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
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

export default function TopBar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { filters, setFilter, fetchProjects } = useProjectStore()
  const [showForm, setShowForm] = useState(false)

  const isAdmin  = user?.role === 'admin'
  const canCreate = isAdmin || user?.role === 'lead'

  function handlePoleChange(pole) {
    setFilter('pole', pole)
    fetchProjects()
  }

  return (
    <>
      <header className="bg-gray-900 text-white h-14 px-4 flex items-center gap-3 flex-shrink-0 border-b border-gray-700">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-4 border-r border-gray-700 mr-1">
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            IT
          </div>
          <span className="font-semibold text-sm whitespace-nowrap">Gestion de Projets</span>
        </div>

        {/* Navigation principale */}
        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                location.pathname === item.path
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Séparateur + Administration */}
        {(isAdmin || user?.role === 'lead') && (
          <>
            <div className="w-px h-5 bg-gray-700 mx-1" />
            <nav className="flex items-center gap-0.5">
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin/users')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
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
            </nav>
          </>
        )}

        <div className="flex-1" />

        {/* Filtre pôle */}
        {user?.role !== 'member' && (
          <div className="flex items-center bg-gray-800 rounded-lg p-0.5 gap-0.5">
            {POLE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handlePoleChange(f.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  filters.pole === f.value
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Nouveau projet */}
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau projet
          </button>
        )}

        {/* Utilisateur + déconnexion */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-700">
          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center text-xs font-medium uppercase flex-shrink-0">
            {user?.username?.[0]}
          </div>
          <div className="text-xs leading-tight">
            <p className="font-medium truncate max-w-[80px]">{user?.username}</p>
            <p className="text-gray-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Déconnexion"
            className="ml-1 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {showForm && <ProjectForm onClose={() => setShowForm(false)} />}
    </>
  )
}
