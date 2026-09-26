import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { CarFront, LogOut, Plus, Store } from 'lucide-react'
import { Chat } from '../client/Chat'
import { useAuth } from '../auth/context'
import { AccountLayout } from '../components/AccountLayout'
import { supabase } from '../lib/supabase'
import { loadAgency, loadShop, loadVehicles, setVehiclePublished } from '../agency/api'
import { agencyError, availabilities, type AgencyVehicle, type Shop } from '../agency/model'
import { ShopForm } from '../agency/ShopForm'
import { VehicleForm } from '../agency/VehicleForm'
import '../agency/agency.css'

export function AgencyPage() {
  const { session, loading, error } = useAuth()
  if (loading || error) return <AccountLayout title="Espace agence"><p role={error ? 'alert' : 'status'}>{error || 'Chargement de votre session…'}</p>{error && <button className="button" onClick={() => window.location.reload()}>Réessayer</button>}</AccountLayout>
  if (!session) return <Navigate to="/connexion" replace state={{ protected: true }} />
  return <AgencyAccess key={session.user.id} userId={session.user.id} />
}
function AgencyAccess({ userId }: { userId: string }) {
  const [access, setAccess] = useState<Awaited<ReturnType<typeof loadAgency>> | null>(null)
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void loadAgency(userId).then(value => { if (active) setAccess(value) }).catch(() => { if (active) setError('Impossible de vérifier votre accès agence. Réessayez.') })
    return () => { active = false }
  }, [userId, attempt])
  if (access?.role === 'client') return <Navigate to="/mon-compte" replace />
  if (access?.role === 'agency' && access.status === 'approved' && !access.suspended) return <AgencyDashboard userId={userId} name={access.name ?? 'Mon agence'} />
  return <AccountLayout title="Espace agence"><p className="eyebrow">VOTRE ESPACE PROFESSIONNEL</p><h1>Votre <em>agence.</em></h1>
    {error ? <p role="alert" className="account-error">{error}</p> : !access ? <p role="status">Vérification de votre dossier…</p> : <p role="status" className="account-notice">{access.suspended ? 'Votre compte agence est suspendu. Contactez notre équipe.' : access.status === 'rejected' ? 'Votre dossier agence a été refusé. Contactez notre équipe pour la corriger.' : access.status === 'needs_changes' ? 'Votre dossier nécessite des corrections avant approbation. Contactez notre équipe.' : 'Votre dossier agence est encore en cours de vérification. Votre espace professionnel sera accessible après approbation.'}</p>}
    <div className="agency-actions"><button className="text-button" onClick={() => { setError(''); setAccess(null); setAttempt(value => value + 1) }}>Actualiser mon dossier</button><Link className="text-button" to="/mon-compte">Mon compte</Link></div>
  </AccountLayout>
}
function AgencyDashboard({ userId, name }: { userId: string; name: string }) {
  const [params, setParams] = useSearchParams()
  const section = params.get('onglet') === 'vehicules' ? 'vehicles' : 'shop'
  const [shop, setShop] = useState<Shop | null>(null), [vehicles, setVehicles] = useState<AgencyVehicle[]>([])
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [attempt, setAttempt] = useState(0)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<AgencyVehicle | 'new' | null>(null), [busyId, setBusyId] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)
  const operation = useRef(false)
  useEffect(() => { document.title = 'Espace agence — SB Rental' }, [])
  useEffect(() => {
    let active = true
    void Promise.all([loadShop(userId), loadVehicles(userId)]).then(([profile, cars]) => { if (active) { setShop(profile); setVehicles(cars) } }).catch(() => { if (active) setLoadError('Impossible de charger votre espace professionnel. Réessayez dans un instant.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, attempt])
  async function toggle(vehicle: AgencyVehicle) {
    if (operation.current || formBusy) return
    operation.current = true; setBusyId(vehicle.id); setError(''); setNotice('')
    try {
      const saved = await setVehiclePublished(userId, vehicle)
      setVehicles(items => items.map(item => item.id === saved.id ? saved : item))
      setNotice(saved.active ? 'Le véhicule est publié dans votre flotte.' : 'Le véhicule est désactivé.')
    } catch (failure) { setError(agencyError(failure)) }
    finally { operation.current = false; setBusyId(null) }
  }
  async function logout() {
    if (operation.current || formBusy) return
    operation.current = true; setBusyId('logout')
    try { const { error: failure } = await supabase!.auth.signOut({ scope: 'local' }); if (failure) throw failure }
    catch { setError('Impossible de vous déconnecter. Réessayez.') }
    finally { operation.current = false; setBusyId(null) }
  }
  return <div className="agency-shell"><a className="skip-link" href="#agency-main">Aller au contenu</a>
    <header className="site-header container agency-header"><Link className="brand" to="/" aria-label="SB Rental, accueil">SB<span>RENTAL</span></Link><div><Link className="text-button" to="/">Accueil</Link><button className="text-button" onClick={logout} disabled={!!busyId || formBusy}><LogOut size={17} /> Se déconnecter</button></div></header>
    <main id="agency-main" className="container agency-main"><div className="agency-heading"><p className="eyebrow">ESPACE PROFESSIONNEL · AGENCE APPROUVÉE</p><h1>{shop?.display_name || name}</h1><p>Votre boutique et votre flotte, au même endroit.</p></div>
      <nav className="agency-nav" aria-label="Espace agence"><button disabled={formBusy || !!busyId} aria-current={section === 'shop' ? 'page' : undefined} onClick={() => { setParams({}); setEditing(null); setError(''); setNotice('') }}><Store size={19} /> Ma boutique</button><button disabled={formBusy || !!busyId} aria-current={section === 'vehicles' ? 'page' : undefined} onClick={() => { setParams({ onglet: 'vehicules' }); setError(''); setNotice('') }}><CarFront size={19} /> Mes véhicules <span>{vehicles.length}</span></button></nav>
      {error && <p role="alert" className="account-error">{error}</p>}
      {loading ? <p role="status" className="account-loading">Chargement de votre boutique et de votre flotte…</p> : loadError ? <div className="agency-panel"><p role="alert" className="account-error">{loadError}</p><button className="button" onClick={() => { setLoading(true); setLoadError(''); setAttempt(value => value + 1) }}>Réessayer</button></div> : section === 'shop' ? <ShopForm userId={userId} shop={shop} name={name} onSaved={setShop} onBusy={setFormBusy} /> : <>
        {notice && <p role="status" className="account-notice">{notice}</p>}
        {editing ? <VehicleForm key={editing === 'new' ? 'new' : editing.id} userId={userId} vehicle={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onBusy={setFormBusy} onSaved={saved => { setVehicles(items => items.some(item => item.id === saved.id) ? items.map(item => item.id === saved.id ? saved : item) : [saved, ...items]); setEditing(null); setNotice('Votre véhicule a bien été enregistré.') }} /> : <section aria-labelledby="vehicles-title"><div className="agency-section-heading"><div><h2 id="vehicles-title">Mes véhicules</h2><p className="agency-muted">Le catalogue public de démonstration reste indépendant de votre flotte.</p></div><button className="button" disabled={!!busyId} onClick={() => { setEditing('new'); setError(''); setNotice('') }}><Plus size={18} /> Ajouter un véhicule</button></div>
          {!vehicles.length ? <div className="agency-empty"><CarFront size={40} /><h3>Votre flotte commence ici.</h3><p>Ajoutez votre premier véhicule, ses informations et jusqu’à trois photos.</p></div> : <div className="agency-vehicles">{vehicles.map(vehicle => <article className="agency-car" key={vehicle.id} aria-label={`${vehicle.brand} ${vehicle.model}`}>
            {vehicle.photos[0] ? <img src={vehicle.photos[0]} alt={`${vehicle.brand} ${vehicle.model}`} loading="lazy" /> : <div className="agency-car-placeholder"><CarFront size={42} /></div>}
            <div className="agency-car-body"><span className={`agency-badge ${vehicle.active ? 'is-active' : ''}`}>{vehicle.active ? 'Publié' : 'Désactivé'}</span><h3>{vehicle.brand} {vehicle.model}</h3><p>{vehicle.year ?? 'Année à renseigner'} · {vehicle.color || 'Couleur à renseigner'}</p><p>{availabilities[vehicle.availability as keyof typeof availabilities] ?? vehicle.availability}</p><strong>{new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 2 }).format(vehicle.daily_price_cents / 100)} DZD <small>/ jour</small></strong><div className="agency-actions"><button className="text-button" disabled={!!busyId} onClick={() => { setEditing(vehicle); setError(''); setNotice('') }}>Modifier</button><button className="button" disabled={!!busyId} onClick={() => void toggle(vehicle)}>{busyId === vehicle.id ? 'Enregistrement…' : vehicle.active ? 'Désactiver' : 'Publier'}</button></div></div>
          </article>)}</div>}
        </section>}
      </>}
      <Chat userId={userId} role="agency" />
    </main><footer className="container agency-footer">SB Rental · Votre espace professionnel</footer>
  </div>
}
