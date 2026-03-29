import { useState } from 'react'
import useProjectStore from '../../store/projectStore'
import useAuthStore from '../../store/authStore'
import { SERVICE_CONFIG, VALID_SERVICES } from '../../utils/format'

// ── Composants de présentation ───────────────────────────────────────────────

function MetricCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

// ── Métriques pour un ensemble de projets ────────────────────────────────────

function DashboardMetrics({ projects }) {
  const total      = projects.length
  const backlog    = projects.filter((p) => p.status === 'backlog').length
  const inProgress = projects.filter((p) => p.status === 'in_progress').length
  const onHold     = projects.filter((p) => p.status === 'on_hold').length
  const done       = projects.filter((p) => p.status === 'done').length
  const critical   = projects.filter((p) => p.priority === 'critical').length
  const now        = new Date()
  const overdue    = projects.filter((p) => p.status !== 'done' && p.due_date && new Date(p.due_date) < now).length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total projets"  value={total}             sub="tous statuts" />
        <MetricCard label="En cours"       value={inProgress + backlog} sub="actifs + idées" color="text-blue-600" />
        <MetricCard label="Critiques"      value={critical}          sub="priorité critique" color="text-red-600" />
        <MetricCard label="En retard"      value={overdue}           sub="échéance dépassée" color={overdue > 0 ? 'text-orange-600' : 'text-gray-900'} />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SectionCard title="Par statut">
          <BarRow label="Idées"      count={backlog}    total={total} color="bg-gray-400" />
          <BarRow label="En cours"   count={inProgress} total={total} color="bg-blue-400" />
          <BarRow label="En attente" count={onHold}     total={total} color="bg-amber-400" />
          <BarRow label="Terminé"    count={done}       total={total} color="bg-green-400" />
        </SectionCard>

        <SectionCard title="Par priorité">
          <BarRow label="Critique" count={projects.filter((p) => p.priority === 'critical').length} total={total} color="bg-red-400" />
          <BarRow label="Haute"    count={projects.filter((p) => p.priority === 'high').length}     total={total} color="bg-orange-400" />
          <BarRow label="Normale"  count={projects.filter((p) => p.priority === 'normal').length}   total={total} color="bg-blue-400" />
          <BarRow label="Basse"    count={projects.filter((p) => p.priority === 'low').length}      total={total} color="bg-gray-300" />
        </SectionCard>

        <SectionCard title="Taux de complétion">
          <div className="flex items-end gap-3 mt-1">
            <span className="text-4xl font-bold text-green-600">{completionRate}%</span>
            <span className="text-sm text-gray-400 pb-1">{done}/{total} terminés</span>
          </div>
          <div className="mt-3 bg-gray-100 rounded-full h-3">
            <div className="h-3 rounded-full bg-green-400 transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </SectionCard>
      </div>
    </>
  )
}

// ── Vue globale cross-services (admin / DG) ──────────────────────────────────

function GlobalView({ allProjects }) {
  const total      = allProjects.length
  const inProgress = allProjects.filter((p) => p.status === 'in_progress').length
  const done       = allProjects.filter((p) => p.status === 'done').length
  const now        = new Date()
  const overdue    = allProjects.filter((p) => p.status !== 'done' && p.due_date && new Date(p.due_date) < now).length

  return (
    <>
      {/* KPIs globaux */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total projets"  value={total}      sub="tous services" />
        <MetricCard label="En cours"       value={inProgress} sub="statut actif"  color="text-blue-600" />
        <MetricCard label="Terminés"       value={done}       sub="projets clôturés" color="text-green-600" />
        <MetricCard label="En retard"      value={overdue}    sub="échéance dépassée" color={overdue > 0 ? 'text-orange-600' : 'text-gray-900'} />
      </div>

      {/* Breakdown par service */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition par service</h3>
        <div className="flex flex-col gap-3">
          {VALID_SERVICES.map((svc) => {
            const cfg        = SERVICE_CONFIG[svc]
            const svcProjs   = allProjects.filter((p) => p.service === svc)
            const svcTotal   = svcProjs.length
            if (svcTotal === 0) return null
            const svcActive  = svcProjs.filter((p) => p.status === 'in_progress').length
            const svcDone    = svcProjs.filter((p) => p.status === 'done').length
            const svcOverdue = svcProjs.filter((p) => p.status !== 'done' && p.due_date && new Date(p.due_date) < now).length
            const pct        = Math.round((svcDone / svcTotal) * 100)
            return (
              <div key={svc} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${cfg.color} flex-shrink-0 w-44 truncate`}>
                  {cfg.icon} {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-green-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                  <span>{svcTotal} projet{svcTotal !== 1 ? 's' : ''}</span>
                  <span className="text-blue-500">{svcActive} actif{svcActive !== 1 ? 's' : ''}</span>
                  {svcOverdue > 0 && <span className="text-red-500">{svcOverdue} retard</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Métriques détaillées globales */}
      <DashboardMetrics projects={allProjects} />
    </>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function DashboardView() {
  const { projects, loading } = useProjectStore()
  const user = useAuthStore((s) => s.user)

  const canSeeAll   = user?.role === 'admin' || user?.service === 'direction_generale'
  const userService = user?.service || 'dev'

  const [selectedService, setSelectedService] = useState('all')

  const filteredProjects = canSeeAll
    ? selectedService === 'all'
      ? projects
      : projects.filter((p) => p.service === selectedService)
    : projects.filter((p) => p.service === userService)

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">
          Tableau de bord
          {!canSeeAll && SERVICE_CONFIG[userService] && (
            <span className={`ml-2 text-sm font-medium px-2 py-0.5 rounded ${SERVICE_CONFIG[userService].color}`}>
              {SERVICE_CONFIG[userService].icon} {SERVICE_CONFIG[userService].label}
            </span>
          )}
        </h2>
      </div>

      {/* Onglets de service — admin / Direction Générale uniquement */}
      {canSeeAll && (
        <div className="flex items-center border-b border-gray-200 mb-5 overflow-x-auto">
          <button
            onClick={() => setSelectedService('all')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0 ${
              selectedService === 'all'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            Vue globale
          </button>
          {VALID_SERVICES.map((svc) => {
            const cfg      = SERVICE_CONFIG[svc]
            const svcCount = projects.filter((p) => p.service === svc).length
            if (svcCount === 0) return null
            return (
              <button
                key={svc}
                onClick={() => setSelectedService(svc)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0 ${
                  selectedService === svc
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {cfg.icon} {cfg.label}
                <span className="ml-1 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">
                  {svcCount}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Contenu */}
      {canSeeAll && selectedService === 'all' ? (
        <GlobalView allProjects={projects} />
      ) : (
        <DashboardMetrics projects={filteredProjects} />
      )}
    </div>
  )
}
