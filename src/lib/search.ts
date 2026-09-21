import type { Vehicle } from '../types/vehicle.ts'

export interface SearchCriteria { city: string; start: string; end: string }

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function nextDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return localDate(date)
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00`)
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value
}

export function validateSearch(criteria: SearchCriteria, today = localDate()): string | null {
  if (!criteria.city) return 'Choisissez une ville de départ.'
  if (!validDate(criteria.start) || !validDate(criteria.end)) return 'Renseignez vos dates de départ et de retour.'
  if (criteria.start < today) return 'La date de départ ne peut pas être passée.'
  if (criteria.end <= criteria.start) return 'Le retour doit être au moins un jour après le départ.'
  return null
}

export function rentalDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
}

export function filterVehicles(fleet: Vehicle[], city: string, category: string): Vehicle[] {
  return fleet.filter(vehicle => (!city || vehicle.city === city) && (category === 'Tous' || vehicle.category === category))
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 }).format(amount)
}
