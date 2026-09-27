export type BookingStatus = 'request' | 'confirmed' | 'rejected' | 'deposit_paid' | 'delivered' | 'completed' | 'cancelled'
type BookingBase = { id: string; reference: string; status: BookingStatus; status_note: string; start_date: string; end_date: string; total_cents: number; deposit_cents: number; created_at: string; vehicle_label: string }
export type ClientBooking = BookingBase & { agency_name: string }
export type AgencyBooking = BookingBase & { client_name: string; client_phone: string; client_verified: boolean }
export type BookingEvent = { id: string; actor_role: 'client' | 'agency' | 'admin' | 'system'; from_status: BookingStatus | null; to_status: BookingStatus; note: string; created_at: string }

export const bookingLabels: Record<BookingStatus, string> = { request: 'Demande en attente', confirmed: 'Confirmée', rejected: 'Refusée', deposit_paid: 'Acompte payé', delivered: 'En cours', completed: 'Terminée', cancelled: 'Annulée' }
export const actorLabels: Record<BookingEvent['actor_role'], string> = { client: 'Client', agency: 'Agence', admin: 'SB Rental', system: 'Système' }

export type BookingGroup = 'todo' | 'active' | 'history'
export function bookingGroup(status: BookingStatus): BookingGroup {
  if (status === 'request') return 'todo'
  if (['confirmed', 'deposit_paid', 'delivered'].includes(status)) return 'active'
  return 'history'
}
export function nights(start: string, end: string): number {
  return Math.max(0, Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000))
}
/** Mirrors cancel_reservation: requests anytime, confirmed ones only before the start date. */
export function canCancel(b: Pick<BookingBase, 'status' | 'start_date'>, today: string): boolean {
  return b.status === 'request' || (b.status === 'confirmed' && b.start_date > today)
}
/** Mirrors agency_complete_reservation: confirmed rentals that have started. */
export function canComplete(b: Pick<BookingBase, 'status' | 'start_date'>, today: string): boolean {
  return ['confirmed', 'deposit_paid', 'delivered'].includes(b.status) && b.start_date <= today
}
export function reasonError(reason: string): string | null {
  const text = reason.trim()
  if (text.length < 3) return 'Indiquez un motif (3 caractères minimum).'
  if (text.length > 500) return 'Motif trop long (500 caractères maximum).'
  return null
}
export function shortDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}
