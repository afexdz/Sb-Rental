import { useFilters } from '../useFilters'
import { Link, useParams } from 'react-router'
import { CalendarDays } from 'lucide-react'
import { useAdmin } from '../context'
import { adminMutation } from '../api'
import { agencyName, date, matches, money, personName, reservationLabels, transitions, vehicleName } from '../model'
import type { Reservation } from '../types'
import { DataTable, EmptyState } from '../components/DataTable'
import { Badge, DetailHeader, InfoList, PageHeader, Panel } from '../components/UI'
import { SearchInput, SelectFilter } from '../components/Filters'
import { ActionForm } from '../components/ActionForm'
import { StatCards } from '../components/StatCards'
export function ReservationTable({ rows }: { rows: Reservation[] }) {
  const { data } = useAdmin()
  return <DataTable rows={[...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))} label="Réservations" empty="Aucune réservation enregistrée" columns={[
    { label: 'Réservation', render: r => <Link key="reservation" className="bo-link" to={`/admin/reservations/${r.id}`}>{r.reference}</Link> }, { label: 'Client', render: r => <Link to={`/admin/utilisateurs/${r.client_id}`}>{personName(data, r.client_id)}</Link> }, { label: 'Agence / véhicule', render: r => <><strong>{vehicleName(data, r.vehicle_id)}</strong><small>{agencyName(data, r.agency_id)}</small></> }, { label: 'Location', render: r => <>{date(r.start_date)}<small>au {date(r.end_date)}</small></> }, { label: 'Statut', render: r => <Badge value={r.status} label={reservationLabels[r.status]} /> }, { label: 'Prix total', render: r => money(r.total_cents) }, { label: 'Acompte · 10 %', render: r => money(r.deposit_cents) }, { label: 'Commission', render: r => money(r.commission_cents) },
  ]} />
}
export function ReservationsSection() {
  const { data } = useAdmin(), f = useFilters()
  const rows = data.reservations.filter(r => matches(f.query, r.reference, personName(data, r.client_id), agencyName(data, r.agency_id), vehicleName(data, r.vehicle_id)) && (!f.get('statut') || r.status === f.get('statut')) && (!f.get('depart') || r.end_date > f.get('depart')) && (!f.get('retour') || r.start_date <= f.get('retour')))
  return <><PageHeader title="Réservations" description="Suivez chaque location, de la demande à la remise des clés." /><StatCards items={[{ label: 'Réservations totales', value: data.reservations.length, icon: CalendarDays }, { label: 'À confirmer', value: data.reservations.filter(r => r.status === 'request').length }, { label: 'En cours de location', value: data.reservations.filter(r => r.status === 'delivered').length }, { label: 'Terminées', value: data.reservations.filter(r => r.status === 'completed').length }]} /><Panel title="Suivi des locations"><div className="bo-filters"><SearchInput value={f.query} onChange={v => f.set('q', v)} placeholder="Référence, client, agence ou véhicule" /><SelectFilter label="Statut" value={f.get('statut')} onChange={v => f.set('statut', v)} options={reservationLabels} /><label className="bo-select"><span>À partir du</span><input type="date" value={f.get('depart')} onChange={e => f.set('depart', e.target.value)} /></label><label className="bo-select"><span>Jusqu’au</span><input type="date" value={f.get('retour')} onChange={e => f.set('retour', e.target.value)} /></label></div><ReservationTable key={f.key} rows={rows} /></Panel></>
}
export function ReservationDetail() {
  const { id } = useParams(), { data, refresh } = useAdmin(), r = data.reservations.find(r => r.id === id)
  if (!r) return <EmptyState title="Réservation introuvable" />
  return <><DetailHeader back="/admin/reservations" title={r.reference} description={`${vehicleName(data, r.vehicle_id)} · ${date(r.start_date)} au ${date(r.end_date)}`} /><div className="bo-detail-grid"><Panel title="Détail de la location" action={<Badge value={r.status} label={reservationLabels[r.status]} />}><InfoList items={[["Client", <Link key="client" className="bo-link" to={`/admin/utilisateurs/${r.client_id}`}>{personName(data, r.client_id)}</Link>], ['Agence', <Link key="agency" className="bo-link" to={`/admin/agences/${r.agency_id}`}>{agencyName(data, r.agency_id)}</Link>], ['Véhicule', <Link key="vehicle" className="bo-link" to={`/admin/vehicules/${r.vehicle_id}`}>{vehicleName(data, r.vehicle_id)}</Link>], ['Prix total', money(r.total_cents)], ['Acompte de 10 %', money(r.deposit_cents)], ['Commission attendue', money(r.commission_cents)], ['Création', date(r.created_at, true)]]} /><Link className="bo-link" to={`/admin/finances?q=${encodeURIComponent(r.reference)}`}>Voir les transactions →</Link></Panel><Panel title="Mettre à jour la réservation" note="Chaque modification est inscrite au journal."><ActionForm key={r.updated_at} action={async form => { await adminMutation('admin_update_reservation', { reservation_id: r.id, expected_status: r.status, next_status: String(form.get('status')), note: String(form.get('note') ?? '') }); refresh() }}><label>Statut<select name="status" defaultValue={r.status}>{[r.status, ...transitions[r.status]].map(status => <option key={status} value={status}>{reservationLabels[status]}</option>)}</select></label><label>Note de suivi<textarea name="note" defaultValue={r.admin_note} maxLength={2000} rows={4} /></label><p className="bo-help">Le statut « Acompte payé » nécessite un paiement d’acompte confirmé dans la base. Les montants de la réservation restent inchangés.</p></ActionForm></Panel></div></>
}
