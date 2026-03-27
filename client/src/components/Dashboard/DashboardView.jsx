import useProjectStore from '../../store/projectStore'

function MetricCard({ label, value, sub, valueClass }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-bold ${valueClass || 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarRow({ label, count, total, colorClass }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-6 text-right flex-shrink-0">{count}</span>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export default function DashboardView() {
  const { projects } = useProjectStore()

  const total = projects.length
  const today = new Date().toISOString().slice(0, 10)

  const byStatus = {
    backlog:     projects.filter((p) => p.status === 'backlog').length,
    in_progress: projects.filter((p) => p.status === 'in_progress').length,
    on_hold:     projects.filter((p) => p.status === 'on_hold').length,
    done:        projects.filter((p) => p.status === 'done').length,
  }

  const byPole = {
    dev:     projects.filter((p) => p.pole === 'dev').length,
    network: projects.filter((p) => p.pole === 'network').length,
  }

  const byPriority = {
    critical: projects.filter((p) => p.priority === 'critical').length,
    high:     projects.filter((p) => p.priority === 'high').length,
    normal:   projects.filter((p) => p.priority === 'normal').length,
    low:      projects.filter((p) => p.priority === 'low').length,
  }

  const overdue = projects.filter(
    (p) => p.due_date && p.due_date < today && p.status !== 'done'
  ).length

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Aucun projet à afficher
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total projets"
          value={total}
          sub="tous statuts confondus"
        />
        <MetricCard
          label="En cours"
          value={byStatus.in_progress}
          valueClass="text-blue-600"
          sub={`+ ${byStatus.backlog} en idées`}
        />
        <MetricCard
          label="Critiques"
          value={byPriority.critical}
          valueClass={byPriority.critical > 0 ? 'text-red-600' : 'text-gray-800'}
          sub="priorité maximale"
        />
        <MetricCard
          label="En retard"
          value={overdue}
          valueClass={overdue > 0 ? 'text-orange-600' : 'text-gray-800'}
          sub="date d'échéance dépassée"
        />
      </div>

      {/* Breakdown charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By status */}
        <SectionCard title="Par statut">
          <BarRow label="Idées"       count={byStatus.backlog}     total={total} colorClass="bg-gray-400" />
          <BarRow label="En cours"    count={byStatus.in_progress} total={total} colorClass="bg-blue-500" />
          <BarRow label="En attente"  count={byStatus.on_hold}     total={total} colorClass="bg-amber-400" />
          <BarRow label="Terminé"     count={byStatus.done}        total={total} colorClass="bg-green-500" />
        </SectionCard>

        {/* By pole */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Par pôle</h3>
          <div className="space-y-3 mb-5">
            <BarRow label="Développement" count={byPole.dev}     total={total} colorClass="bg-indigo-500" />
            <BarRow label="Réseau"        count={byPole.network} total={total} colorClass="bg-emerald-500" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 text-center p-3 bg-indigo-50 rounded-xl">
              <p className="text-2xl font-bold text-indigo-700">{byPole.dev}</p>
              <p className="text-xs text-indigo-400 mt-0.5">Dev</p>
            </div>
            <div className="flex-1 text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-700">{byPole.network}</p>
              <p className="text-xs text-emerald-400 mt-0.5">Réseau</p>
            </div>
          </div>
        </div>

        {/* By priority */}
        <SectionCard title="Par priorité">
          <BarRow label="Critique" count={byPriority.critical} total={total} colorClass="bg-red-500" />
          <BarRow label="Haute"    count={byPriority.high}     total={total} colorClass="bg-orange-400" />
          <BarRow label="Normale"  count={byPriority.normal}   total={total} colorClass="bg-blue-400" />
          <BarRow label="Basse"    count={byPriority.low}      total={total} colorClass="bg-gray-300" />
        </SectionCard>
      </div>

      {/* Completion rate */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Taux de complétion</h3>
          <span className="text-sm font-bold text-green-600">
            {total > 0 ? Math.round((byStatus.done / total) * 100) : 0}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full bg-green-500 transition-all duration-700"
            style={{ width: `${total > 0 ? (byStatus.done / total) * 100 : 0}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {byStatus.done} projet{byStatus.done !== 1 ? 's' : ''} terminé{byStatus.done !== 1 ? 's' : ''} sur {total}
        </p>
      </div>
    </div>
  )
}
