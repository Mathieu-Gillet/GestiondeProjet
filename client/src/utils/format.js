import { format, isPast, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatDate(dateStr) {
  if (!dateStr) return null
  return format(parseISO(dateStr), 'd MMM yyyy', { locale: fr })
}

export function isOverdue(dateStr) {
  if (!dateStr) return false
  return isPast(parseISO(dateStr))
}

export const PRIORITY_CONFIG = {
  critical: { label: 'Critique', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  high:     { label: 'Haute',    color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  normal:   { label: 'Normale',  color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  low:      { label: 'Basse',    color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
}

export const POLE_CONFIG = {
  dev:     { label: 'Développement', color: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-400' },
  network: { label: 'Réseau',        color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-400' },
}

export const SERVICE_CONFIG = {
  dev:                 { label: 'Développement',      color: 'bg-indigo-100 text-indigo-700',    border: 'border-indigo-400',   icon: '💻', hex: '#4F46E5' },
  network:             { label: 'Réseau',              color: 'bg-emerald-100 text-emerald-700',  border: 'border-emerald-400',  icon: '🔌', hex: '#059669' },
  rh:                  { label: 'Ressources Humaines', color: 'bg-pink-100 text-pink-700',        border: 'border-pink-400',     icon: '👥', hex: '#EC4899' },
  direction_generale:  { label: 'Direction Générale',  color: 'bg-purple-100 text-purple-700',    border: 'border-purple-400',   icon: '🏢', hex: '#7C3AED' },
  services_techniques: { label: 'Services Techniques', color: 'bg-amber-100 text-amber-700',      border: 'border-amber-400',    icon: '🔧', hex: '#D97706' },
  achats:              { label: 'Achats',               color: 'bg-teal-100 text-teal-700',        border: 'border-teal-400',     icon: '🛒', hex: '#0D9488' },
}

export const VALID_SERVICES = Object.keys(SERVICE_CONFIG)

/** Formate une durée en jours + heures → "2j 4h", "3j", "4h", "–" */
export function formatDuration(days, hours) {
  const d = Number(days) || 0
  const h = Number(hours) || 0
  if (!d && !h) return '–'
  if (d && h) return `${d}j ${h}h`
  if (d) return `${d}j`
  return `${h}h`
}

export const STATUS_CONFIG = {
  backlog:     { label: 'Idées',     color: 'bg-gray-200 text-gray-700',   header: 'bg-gray-100 border-gray-300' },
  in_progress: { label: 'En cours',    color: 'bg-blue-100 text-blue-700',   header: 'bg-blue-50 border-blue-300' },
  on_hold:     { label: 'En attente',  color: 'bg-amber-100 text-amber-700', header: 'bg-amber-50 border-amber-300' },
  done:        { label: 'Terminé',     color: 'bg-green-100 text-green-700', header: 'bg-green-50 border-green-300' },
}
