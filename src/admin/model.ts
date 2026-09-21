import type { AdminData, Payment, Reservation, ReservationStatus } from './types.ts'
export type Period = 'day' | 'week' | 'month' | 'year'
export const periodLabels: Record<Period, string> = { day: 'Jour', week: 'Semaine', month: 'Mois', year: 'Année' }
export const labels: Record<string, string> = { active: 'Actif', suspended: 'Suspendu', inactive: 'Inactif', pending: 'En attente', approved: 'Approuvée', rejected: 'Refusée', needs_changes: 'À corriger', incomplete: 'Dossier incomplet', request: 'Demande', confirmed: 'Confirmé', deposit_paid: 'Acompte payé', delivered: 'Livré', completed: 'Terminé', cancelled: 'Annulé', refunded: 'Remboursé', failed: 'Échoué', available: 'Disponible', rented: 'En location', maintenance: 'Maintenance', city: 'Citadine', compact: 'Compacte', sedan: 'Berline', suv: 'SUV', utility: 'Utilitaire', luxury: 'Premium', closed: 'Fermée', client: 'Client', agency: 'Agence', deposit: 'Acompte', balance: 'Solde', chargily: 'Chargily', manual: 'Enregistrement manuel' }
export const reservationLabels = { request: 'Demande', confirmed: 'Disponibilité confirmée', deposit_paid: 'Acompte payé', delivered: 'Livré', completed: 'Terminé', cancelled: 'Annulé' }
export const transitions: Record<ReservationStatus, ReservationStatus[]> = { request: ['confirmed', 'cancelled'], confirmed: ['deposit_paid', 'cancelled'], deposit_paid: ['delivered', 'cancelled'], delivered: ['completed'], completed: [], cancelled: [] }
export const money = (cents: number) => new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 2 }).format(cents / 100)
export const date = (value: string, time = false) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', ...(time ? { timeStyle: 'short' as const } : {}), timeZone: 'Africa/Algiers' }).format(new Date(value.length === 10 ? `${value}T12:00:00+01:00` : value))
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const matches = (query: string, ...values: (string | undefined | null)[]) => values.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase())
export function periodRange(period: Period, anchor: string) {
  const d = new Date(`${anchor}T00:00:00Z`)
  if (!Number.isFinite(d.getTime())) return periodRange(period, today())
  if (period === 'week') d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
  if (period === 'month' || period === 'year') d.setUTCDate(1)
  if (period === 'year') d.setUTCMonth(0)
  const end = new Date(d)
  if (period === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1)
  else if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1)
  else end.setUTCDate(end.getUTCDate() + (period === 'week' ? 7 : 1))
  return { start: d.getTime() - 3600000, end: end.getTime() - 3600000 }
}
export function inRange(value: string, range: { start: number; end: number }) { const t = Date.parse(value); return t >= range.start && t < range.end }
export function financials(payments: Payment[]) {
  const settled = payments.filter(p => p.status === 'confirmed' || p.status === 'refunded')
  const sum = (key: keyof Payment) => settled.reduce((s, p) => s + Number(p[key] ?? 0), 0)
  const paid = sum('amount_cents'), refunded = sum('refunded_cents'), commission = sum('commission_cents') - sum('refunded_commission_cents')
  return { paid, refunded, net: paid - refunded, commission, deposit: settled.filter(p => p.kind === 'deposit').reduce((s, p) => s + p.amount_cents - p.refunded_cents, 0), due: paid - refunded - commission - sum('agency_transferred_cents'), transferred: sum('agency_transferred_cents'), pending: payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount_cents, 0) }
}
export function booked(reservations: Reservation[]) { return reservations.filter(r => !['request', 'cancelled'].includes(r.status)).reduce((s, r) => s + r.total_cents, 0) }
export function agencyBalances(payments: Payment[], reservations: Reservation[]) {
  const owners = new Map(reservations.map(r => [r.id, r.agency_id]))
  const balances = new Map<string, number>()
  for (const p of payments) {
    if (p.status !== 'confirmed' && p.status !== 'refunded') continue
    const agency = owners.get(p.reservation_id) ?? p.reservation_id
    const balance = p.amount_cents - p.refunded_cents - p.commission_cents + p.refunded_commission_cents - p.agency_transferred_cents
    balances.set(agency, (balances.get(agency) ?? 0) + balance)
  }
  return { payable: [...balances.values()].reduce((s, value) => s + Math.max(0, value), 0), recoverable: [...balances.values()].reduce((s, value) => s + Math.max(0, -value), 0) }
}
export function series(data: AdminData, period: Period, anchor: string) {
  const range = periodRange(period, anchor)
  const output: { label: string; reservations: number; revenue: number; commission: number }[] = []
  for (let start = range.start; start < range.end;) {
    const next = new Date(start + 3600000)
    if (period === 'year') next.setUTCMonth(next.getUTCMonth() + 1)
    else next.setTime(next.getTime() + (period === 'day' ? 3600000 : 86400000))
    const end = next.getTime() - 3600000
    const bucket = { start, end }
    // Cash-flow uses actual confirmation/refund dates, never booking dates.
    let revenue = 0, commission = 0
    for (const p of data.payments) {
      if (p.confirmed_at && inRange(p.confirmed_at, bucket)) { revenue += p.amount_cents; commission += p.commission_cents }
      if (p.refunded_at && inRange(p.refunded_at, bucket)) { revenue -= p.refunded_cents; commission -= p.refunded_commission_cents }
    }
    const label = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Algiers', ...(period === 'day' ? { hour: '2-digit' as const } : period === 'year' ? { month: 'short' as const } : { day: 'numeric' as const, month: 'short' as const }) }).format(new Date(start))
    output.push({ label, reservations: data.reservations.filter(r => inRange(r.created_at, bucket)).length, revenue, commission })
    start = end
  }
  return output
}
export function unreadCount(data: AdminData, conversationId?: string) {
  return data.messages.filter(m => (!conversationId || m.conversation_id === conversationId) && m.created_at > (data.reads.find(r => r.conversation_id === m.conversation_id)?.last_read_at ?? '')).length
}
export function csv(rows: unknown[][]) {
  return '\uFEFF' + rows.map(row => row.map(cell => {
    let value = String(cell ?? '')
    if (/^[\s]*[=+\-@]/.test(value)) value = `'${value}`
    return `"${value.replace(/"/g, '""')}"`
  }).join(';')).join('\r\n')
}
export const personName = (data: AdminData, id: string) => data.profiles.find(p => p.id === id)?.full_name || data.profiles.find(p => p.id === id)?.email || 'Compte indisponible'
export const agencyName = (data: AdminData, id: string) => data.agencies.find(a => a.profile_id === id)?.business_name || personName(data, id)
export const vehicleName = (data: AdminData, id: string) => { const v = data.vehicles.find(v => v.id === id); return v ? `${v.brand} ${v.model}` : 'Véhicule indisponible' }
