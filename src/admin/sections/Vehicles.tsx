import { useFilters } from '../useFilters'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { CarFront } from 'lucide-react'
import { useAdmin } from '../context'
import { agencyName, labels, matches, money, date } from '../model'
import type { Vehicle } from '../types'
import { DataTable, EmptyState } from '../components/DataTable'
import { Badge, DetailHeader, InfoList, PageHeader, Panel } from '../components/UI'
import { StatCards } from '../components/StatCards'
import { SearchInput, SelectFilter } from '../components/Filters'
export function VehiclePhoto({ source, alt }: { source?: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  const safe = source && (/^https?:\/\//.test(source) || /^\/(?!\/)/.test(source))
  return safe && !failed ? <img src={source} alt={alt} loading="lazy" onError={() => setFailed(true)} /> : <div className="bo-photo-empty"><CarFront size={32} strokeWidth={1.3} /><span>Photo indisponible</span></div>
}
export function VehicleTable({ rows }: { rows: Vehicle[] }) {
  const { data } = useAdmin()
  return <DataTable rows={rows} label="Véhicules" empty="Aucun véhicule enregistré" columns={[
    { label: 'Véhicule', render: v => <Link className="bo-entity" to={`/admin/vehicules/${v.id}`}><span className="bo-car-thumb"><VehiclePhoto source={v.photos[0]} alt={`${v.brand} ${v.model}`} /></span><span><strong>{v.brand} {v.model}</strong><small>{v.year ?? 'Année non renseignée'}</small></span></Link> }, { label: 'Agence', render: v => <Link to={`/admin/agences/${v.agency_id}`} className="bo-link">{agencyName(data, v.agency_id)}</Link> }, { label: 'Catégorie', render: v => labels[v.category] ?? v.category }, { label: 'Prix / jour', render: v => money(v.daily_price_cents) }, { label: 'Statut', render: v => <Badge value={v.active ? 'active' : 'inactive'} /> }, { label: 'Disponibilité', render: v => <Badge value={v.availability} /> }, { label: 'Détail', render: v => <Link key="vehicle" className="bo-link" to={`/admin/vehicules/${v.id}`}>Consulter →</Link> },
  ]} />
}
export function VehiclesSection() {
  const { data } = useAdmin(), f = useFilters()
  const rows = data.vehicles.filter(v => matches(f.query, v.brand, v.model, agencyName(data, v.agency_id)) && (!f.get('categorie') || v.category === f.get('categorie')) && (!f.get('disponibilite') || v.availability === f.get('disponibilite')) && (!f.get('statut') || String(v.active) === f.get('statut')))
  return <><PageHeader title="Véhicules" description="La flotte de vos agences, ses disponibilités et ses tarifs." /><StatCards items={[{ label: 'Véhicules au total', value: data.vehicles.length, icon: CarFront }, { label: 'Véhicules actifs', value: data.vehicles.filter(v => v.active).length }, { label: 'Véhicules inactifs', value: data.vehicles.filter(v => !v.active).length }]} /><Panel title="La flotte"><div className="bo-filters"><SearchInput value={f.query} onChange={v => f.set('q', v)} placeholder="Rechercher une marque, un modèle ou une agence" /><SelectFilter label="Catégorie" value={f.get('categorie')} onChange={v => f.set('categorie', v)} options={Object.fromEntries(['city', 'compact', 'sedan', 'suv', 'utility', 'luxury'].map(k => [k, labels[k]]))} /><SelectFilter label="Disponibilité" value={f.get('disponibilite')} onChange={v => f.set('disponibilite', v)} options={{ available: 'Disponible', rented: 'En location', maintenance: 'Maintenance' }} /><SelectFilter label="Statut" value={f.get('statut')} onChange={v => f.set('statut', v)} options={{ true: 'Actifs', false: 'Inactifs' }} /></div><VehicleTable key={f.key} rows={rows} /></Panel></>
}
export function VehicleDetail() {
  const { id } = useParams(), { data } = useAdmin(), vehicle = data.vehicles.find(v => v.id === id)
  if (!vehicle) return <EmptyState title="Véhicule introuvable" />
  return <><DetailHeader back="/admin/vehicules" title={`${vehicle.brand} ${vehicle.model}`} description="Fiche du véhicule et agence propriétaire." /><div className="bo-detail-grid"><Panel title="Photos"><div className="bo-gallery">{vehicle.photos.length ? vehicle.photos.map((source, i) => <VehiclePhoto key={source} source={source} alt={`${vehicle.brand} ${vehicle.model}, photo ${i + 1}`} />) : <VehiclePhoto alt="Aucune photo" />}</div></Panel><Panel title="Informations du véhicule"><InfoList items={[["Prix par jour", money(vehicle.daily_price_cents)], ['Agence', <Link key="agency" className="bo-link" to={`/admin/agences/${vehicle.agency_id}`}>{agencyName(data, vehicle.agency_id)}</Link>], ['Catégorie', labels[vehicle.category]], ['Année', vehicle.year], ['Statut', <Badge key="active" value={vehicle.active ? 'active' : 'inactive'} />], ['Disponibilité', <Badge key="availability" value={vehicle.availability} />], ['Ajouté le', date(vehicle.created_at)]]} /><p className="bo-note">{vehicle.description || 'Aucune description fournie.'}</p></Panel></div></>
}
