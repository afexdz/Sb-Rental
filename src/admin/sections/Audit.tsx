import { useFilters } from '../useFilters'
import { Link } from 'react-router'
import { useAdmin } from '../context'
import { date, labels, matches, money } from '../model'
import { DataTable } from '../components/DataTable'
import { PageHeader, Panel } from '../components/UI'
import { SearchInput, SelectFilter } from '../components/Filters'
const actions: Record<string, string> = { 'agency.approved': 'Agence approuvée', 'agency.rejected': 'Agence refusée', 'agency.needs_changes': 'Correction demandée', 'agency.pending': 'Dossier remis en attente', 'reservation.updated': 'Réservation modifiée', 'payment.updated': 'Paiement modifié' }
const fields: Record<string, string> = { status: 'Statut', total_cents: 'Prix total', deposit_cents: 'Acompte', amount_cents: 'Montant', commission_cents: 'Commission', refunded_cents: 'Remboursement', refunded_commission_cents: 'Commission remboursée', agency_transferred_cents: 'Versé agence', admin_note: 'Note', start_date: 'Début de location', end_date: 'Fin de location', reference: 'Référence', chargily_reference: 'Référence Chargily', confirmed_at: 'Confirmation', refunded_at: 'Remboursement effectué', reviewed_at: 'Examen du dossier', vehicle_id: 'Véhicule', agency_id: 'Agence', client_id: 'Client', reservation_id: 'Réservation', business_name: 'Nom commercial', rc_number: 'Numéro RC', document_path: 'Registre de commerce', source: 'Source', kind: 'Type', currency: 'Devise' }
export function AuditSection() {
  const { data } = useAdmin(), f = useFilters()
  const rows = data.audit.filter(a => matches(f.query, a.admin_email, actions[a.action], a.entity_id) && (!f.get('action') || a.action === f.get('action'))).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const display = (key: string, value: unknown) => key.endsWith('_cents') ? money(Number(value ?? 0)) : labels[String(value)] ?? String(value ?? '—')
  return <><PageHeader title="Journal administrateur" description="Une trace datée des décisions et modifications effectuées sur la plateforme." /><Panel title="Historique des actions" note="Journal généré par la base, non modifiable depuis le dashboard."><div className="bo-filters"><SearchInput value={f.query} onChange={v => f.set('q', v)} placeholder="Action, administrateur ou identifiant" /><SelectFilter label="Action" value={f.get('action')} onChange={v => f.set('action', v)} options={actions} /></div><DataTable key={f.key} rows={rows} label="Journal administrateur" empty="Aucune action journalisée" columns={[
    { label: 'Date et heure', render: a => date(a.created_at, true) }, { label: 'Action', render: a => <strong>{actions[a.action] ?? a.action}</strong> }, { label: 'Administrateur', render: a => a.admin_email ?? 'Système / traitement serveur' }, { label: 'Objet', render: a => {
      const agency = data.agencies.find(r => r.id === a.entity_id)
      const path = a.entity_type === 'reservations' ? `/admin/reservations/${a.entity_id}` : a.entity_type === 'payments' ? `/admin/finances/${a.entity_id}` : agency ? `/admin/agences/${agency.profile_id}` : null
      return path ? <Link className="bo-link" to={path}>{a.entity_id.slice(0, 8)} →</Link> : a.entity_id.slice(0, 8)
    } }, { label: 'Changements', render: a => <details className="bo-audit-detail"><summary>Voir les changements</summary><dl>{Object.keys(a.after_data).filter(k => a.before_data[k] !== a.after_data[k]).map(k => <div key={k}><dt>{fields[k] ?? k}</dt><dd>{display(k, a.before_data[k])} → {display(k, a.after_data[k])}</dd></div>)}</dl></details> },
  ]} /></Panel></>
}
