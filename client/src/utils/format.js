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

export const STATUS_CONFIG = {
  backlog:     { label: 'Idées',     color: 'bg-gray-200 text-gray-700',   header: 'bg-gray-100 border-gray-300' },
  in_progress: { label: 'En cours',    color: 'bg-blue-100 text-blue-700',   header: 'bg-blue-50 border-blue-300' },
  on_hold:     { label: 'En attente',  color: 'bg-amber-100 text-amber-700', header: 'bg-amber-50 border-amber-300' },
  done:        { label: 'Terminé',     color: 'bg-green-100 text-green-700', header: 'bg-green-50 border-green-300' },
}
