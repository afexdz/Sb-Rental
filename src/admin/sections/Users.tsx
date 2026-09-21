import { useFilters } from '../useFilters'
import { Link, useParams } from 'react-router'
import { useAdmin } from '../context'
import { date, matches, personName } from '../model'
import { DataTable, EmptyState } from '../components/DataTable'
import { Badge, DetailHeader, InfoList, PageHeader, Panel } from '../components/UI'
import { SearchInput, SelectFilter } from '../components/Filters'
import { ReservationTable } from './Reservations'
export function UsersSection() {
  const { data } = useAdmin(), f = useFilters()
  const rows = data.profiles.filter(p => matches(f.query, p.full_name, p.email) && (!f.get('type') || p.role === f.get('type')) && (!f.get('statut') || p.account_status === f.get('statut'))).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return <><PageHeader title="Utilisateurs" description="Une vue complète des clients et des agences qui font vivre la plateforme." /><Panel title="Annuaire" note={`${data.profiles.length} comptes enregistrés`}><div className="bo-filters"><SearchInput value={f.query} onChange={v => f.set('q', v)} placeholder="Rechercher un nom ou un e-mail" /><SelectFilter label="Type" value={f.get('type')} onChange={v => f.set('type', v)} options={{ client: 'Clients', agency: 'Agences' }} /><SelectFilter label="Statut" value={f.get('statut')} onChange={v => f.set('statut', v)} options={{ active: 'Actif', suspended: 'Suspendu' }} /></div><DataTable key={f.key} rows={rows} label="Utilisateurs" empty="Aucun utilisateur trouvé" columns={[
    { label: 'Utilisateur', render: p => <Link className="bo-entity" to={`/admin/utilisateurs/${p.id}`}><span className="bo-avatar">{(p.full_name || p.email).slice(0, 2).toUpperCase()}</span><span><strong>{p.full_name || 'Sans nom'}</strong><small>{p.email}</small></span></Link> }, { label: 'Type de compte', render: p => <Badge value={p.role} /> }, { label: 'Statut du compte', render: p => <Badge value={p.account_status} /> }, { label: 'Inscription', render: p => date(p.created_at) }, { label: 'Détail', render: p => <Link key="client" className="bo-link" to={`/admin/utilisateurs/${p.id}`}>Voir le profil →</Link> },
  ]} /></Panel></>
}
export function UserDetail() {
  const { id } = useParams(), { data } = useAdmin(), profile = data.profiles.find(p => p.id === id)
  if (!profile) return <EmptyState title="Utilisateur introuvable" />
  const history = data.reservations.filter(r => r.client_id === id || r.agency_id === id)
  return <><DetailHeader back="/admin/utilisateurs" title={personName(data, profile.id)} description="Informations du compte et historique de location." /><Panel title="Informations personnelles"><InfoList items={[["E-mail", profile.email], ['Type', <Badge key="role" value={profile.role} />], ['Statut du compte', <Badge key="status" value={profile.account_status} />], ['Inscription', date(profile.created_at, true)]]} />{profile.role === 'agency' && <Link key="agency" className="bo-link" to={`/admin/agences/${id}`}>Consulter le dossier agence →</Link>}</Panel><Panel title="Historique des réservations" note={`${history.length} réservations`}><ReservationTable rows={history} /></Panel></>
}
