import { useFilters } from '../useFilters'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { FileText } from 'lucide-react'
import { useAdmin } from '../context'
import { adminMutation, openDocument } from '../api'
import { agencyName, date, matches } from '../model'
import type { AgencyRequest } from '../types'
import { DataTable, EmptyState } from '../components/DataTable'
import { Badge, DetailHeader, InfoList, Notice, PageHeader, Panel } from '../components/UI'
import { SearchInput, SelectFilter } from '../components/Filters'
import { ActionForm } from '../components/ActionForm'
import { VehicleTable } from './Vehicles'
export function AgenciesSection() {
  const { data } = useAdmin(), f = useFilters()
  const agencies = data.profiles.filter(p => p.role === 'agency').map(p => ({ ...p, request: data.agencies.find(a => a.profile_id === p.id) }))
  const rows = agencies.filter(p => matches(f.query, p.full_name, p.email, p.request?.business_name, p.request?.rc_number) && (!f.get('statut') || (p.request?.status ?? 'incomplete') === f.get('statut'))).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return <><PageHeader title="Agences" description="Accompagnez vos partenaires, du premier dossier à la mise en location." /><Panel title="Dossiers partenaires" note={`${agencies.length} agences · ${data.agencies.filter(a => a.status === 'pending').length} à approuver`}><div className="bo-filters"><SearchInput value={f.query} onChange={v => f.set('q', v)} placeholder="Rechercher une agence, un e-mail ou un RC" /><SelectFilter label="Statut" value={f.get('statut')} onChange={v => f.set('statut', v)} options={{ pending: 'En attente', approved: 'Approuvée', rejected: 'Refusée', needs_changes: 'À corriger', incomplete: 'Dossier incomplet' }} /></div><DataTable key={f.key} rows={rows} label="Agences" empty="Aucune agence trouvée" columns={[
    { label: 'Agence', render: a => <Link className="bo-entity" to={`/admin/agences/${a.id}`}><span className="bo-avatar">{agencyName(data, a.id).slice(0, 2).toUpperCase()}</span><span><strong>{agencyName(data, a.id)}</strong><small>{a.email}</small></span></Link> }, { label: 'Numéro RC', render: a => a.request?.rc_number ?? 'À fournir' }, { label: 'Statut', render: a => <Badge value={a.request?.status ?? 'incomplete'} /> }, { label: 'Inscription', render: a => date(a.created_at) }, { label: 'Registre', render: a => a.request ? <DocumentButton path={a.request.document_path} /> : '—' }, { label: 'Action', render: a => <Link key="agency" className="bo-link" to={`/admin/agences/${a.id}`}>Examiner le dossier →</Link> },
  ]} /></Panel></>
}
export function DocumentButton({ path }: { path: string }) {
  const [error, setError] = useState('')
  return <><button className="bo-link" onClick={() => { setError(''); void openDocument(path).catch(e => setError(e.message)) }}><FileText size={15} /> Voir le fichier</button>{error && <Notice error>{error}</Notice>}</>
}
function AgencyReview({ request }: { request: AgencyRequest }) {
  const { refresh } = useAdmin()
  const [decision, setDecision] = useState('approved')
  return <ActionForm label="Enregistrer la décision" action={async form => {
    await adminMutation('admin_review_agency', { request_id: request.id, expected_status: request.status, decision, note: String(form.get('note') ?? '') }); refresh()
  }}><div className="bo-review-choices" role="group" aria-label="Décision">{Object.entries({ approved: "Approuver", rejected: "Refuser", needs_changes: "Demander une correction" }).map(([value, label]) => <button type="button" className="bo-secondary" key={value} aria-pressed={decision === value} onClick={() => setDecision(value)}>{label}</button>)}</div><label>Motif / note<textarea name="note" aria-label="Motif / note" defaultValue={request.admin_note ?? ''} maxLength={2000} minLength={decision === 'approved' ? undefined : 3} required={decision !== 'approved'} placeholder="Précisez votre décision pour le suivi du dossier…" rows={3} /></label><p className="bo-help">Le motif est obligatoire pour un refus ou une demande de correction. La décision est inscrite au journal administrateur.</p></ActionForm>
}
export function AgencyDetail() {
  const { id } = useParams(), { data } = useAdmin(), profile = data.profiles.find(p => p.id === id && p.role === 'agency'), request = data.agencies.find(a => a.profile_id === id)
  if (!profile) return <EmptyState title="Agence introuvable" />
  return <><DetailHeader back="/admin/agences" title={agencyName(data, profile.id)} description={profile.email} /><div className="bo-detail-grid"><Panel title="Registre de commerce" action={<Badge value={request?.status ?? 'incomplete'} />}><InfoList items={[["Nom commercial", request?.business_name], ['Responsable', profile.full_name || 'Non renseigné'], ['Numéro RC', request?.rc_number], ['Inscription', date(profile.created_at)], ['Dernière décision', request?.reviewed_at ? date(request.reviewed_at, true) : 'Pas encore examinée']]} />{request ? <DocumentButton path={request.document_path} /> : <Notice>Cette agence n’a pas encore envoyé son registre.</Notice>}{request?.admin_note && <p className="bo-note">{request.admin_note}</p>}</Panel><Panel title="Validation du dossier" note="Une décision documentée, visible dans le journal.">{request ? <AgencyReview key={`${request.id}-${request.reviewed_at}`} request={request} /> : <EmptyState title="Dossier incomplet" message="La validation sera disponible après réception du registre." />}</Panel></div><Panel title="Véhicules de l’agence"><VehicleTable rows={data.vehicles.filter(v => v.agency_id === id)} /></Panel></>
}
