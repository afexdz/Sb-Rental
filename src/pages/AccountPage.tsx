import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ArrowUpRight, LoaderCircle, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../auth/context'
import { AccountLayout } from '../components/AccountLayout'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/auth'

type Profile = { id: string; full_name: string; created_at: string }
export function AccountPage() {
  const { session, loading, error, signedOut } = useAuth()
  if (loading || error) return <AccountLayout title="Mon compte"><p role={error ? 'alert' : 'status'} className={error ? 'account-error' : 'account-loading'}>{error || 'Chargement de votre session…'}</p>{error && <button className="button" onClick={() => window.location.reload()}>Réessayer</button>}</AccountLayout>
  if (!session) return <Navigate to="/connexion" replace state={signedOut ? { signedOut: true } : { protected: true }} />
  return <AccountAccess key={session.user.id} userId={session.user.id} email={session.user.email ?? ''} />
}
function AccountAccess({ userId, email }: { userId: string; email: string }) {
  const [access, setAccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { data: profile, error: failure } = await supabase!.from('profiles').select('role').eq('id', userId).single().retry(false)
        if (failure) throw failure
        let status = 'approved'
        if (profile.role === 'agency') {
          const { data, error: requestError } = await supabase!.from('agency_requests').select('status').eq('profile_id', userId).maybeSingle().retry(false)
          if (requestError) throw requestError
          status = data?.status ?? 'incomplete'
        }
        if (active) setAccess(profile.role === 'agency' && status === 'approved' ? 'agency' : status)
      } catch { if (active) setError('Impossible de vérifier votre compte. Veuillez réessayer.') }
    })()
    return () => { active = false }
  }, [userId, attempt])
  if (access === 'agency') return <Navigate to="/agence" replace />
  if (access === 'approved') return <AccountDetails userId={userId} email={email} />
  return <AccountLayout title="Mon compte"><p className="eyebrow">VOTRE ESPACE</p><h1>Mon <em>compte.</em></h1>
    {error ? <><p role="alert" className="account-error">{error}</p><button className="text-button" onClick={() => { setError(null); setAttempt(attempt + 1) }}>Réessayer</button></> : !access ? <p role="status" className="account-loading">Vérification de votre compte…</p> : <p className="account-notice">{access === 'incomplete' ? 'Votre inscription agence est à compléter : envoyez votre registre de commerce.' : access === 'rejected' ? 'Votre demande agence a été refusée. Contactez notre équipe.' : access === 'needs_changes' ? 'Votre dossier nécessite des corrections. Contactez notre équipe.' : 'Votre demande agence est en cours de vérification.'}</p>}
    {access === 'incomplete' && <Link className="button" to="/inscription?profil=agence">Compléter mon dossier <ArrowUpRight size={18} /></Link>}
    <button className="text-button logout-button" onClick={async () => { const result = await supabase!.auth.signOut({ scope: 'local' }); if (result.error) setError(authErrorMessage(result.error)) }}><LogOut size={17} /> Me déconnecter</button>
  </AccountLayout>
}
function AccountDetails({ userId, email }: { userId: string; email: string }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'save' | 'logout' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const operation = useRef(false)
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { data, error: failure } = await supabase!.from('customer_profiles').select('id, full_name, created_at').eq('id', userId).single().retry(false)
        if (failure) throw failure
        if (active) { setProfile(data); setName(data.full_name) }
      } catch { if (active) { setError('Impossible de charger votre profil. Réessayez dans un instant.'); setLoadError(true) } }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [userId, attempt])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (operation.current) return
    setError(null); setNotice('')
    if (!name.trim() || name.trim().length > 100) { setError('Indiquez un nom de 1 à 100 caractères.'); return }
    operation.current = true; setBusy('save')
    try {
      const { data, error: failure } = await supabase!.from('customer_profiles').update({ full_name: name.trim() }).eq('id', userId).select('id, full_name, created_at').single().retry(false)
      if (failure) throw failure
      setProfile(data); setName(data.full_name); setNotice('Votre nom a bien été enregistré.')
    } catch { setError('Impossible d’enregistrer votre nom. Réessayez dans un instant.') }
    finally { operation.current = false; setBusy(null) }
  }
  async function logout() {
    if (operation.current) return
    operation.current = true; setBusy('logout'); setError(null); setNotice('')
    try {
      const { error: failure } = await supabase!.auth.signOut({ scope: 'local' })
      if (failure) throw failure
      navigate('/connexion', { replace: true, state: { signedOut: true } })
    } catch (failure) { setError(authErrorMessage(failure)) }
    finally { operation.current = false; setBusy(null) }
  }
  return <AccountLayout title="Mon compte"><p className="eyebrow">VOTRE ESPACE CLIENT</p><h1>Mon <em>compte.</em></h1><p className="account-intro">Vos informations, à portée de main.</p>
    {loading && <p role="status" className="account-loading"><LoaderCircle className="spinner" size={20} /> Chargement de votre profil…</p>}
    {error && <p className="account-error" role="alert">{error}</p>}
    {loadError && <button className="text-button" onClick={() => { setLoading(true); setError(null); setLoadError(false); setAttempt(attempt + 1) }}>Réessayer</button>}
    {profile && <><div className="profile-heading"><span className="profile-avatar"><UserRound size={25} /></span><div><h2>{profile.full_name || 'Bienvenue chez SB Rental'}</h2><p>Membre depuis {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(profile.created_at))}</p></div></div>
    <dl className="profile-email"><dt>Adresse e-mail</dt><dd>{email}</dd></dl>
    <form onSubmit={save} noValidate className="account-form" aria-busy={busy === 'save'}><div className="account-field"><label htmlFor="profile-name">Nom complet</label><input id="profile-name" autoComplete="name" required maxLength={100} value={name} disabled={!!busy} onChange={e => { setName(e.target.value); setNotice('') }} /></div>{notice && <p role="status" className="account-notice">{notice}</p>}<button className="button account-submit" disabled={!!busy || name.trim() === profile.full_name}>{busy === 'save' ? 'Enregistrement…' : 'Enregistrer les modifications'}{busy === 'save' ? <LoaderCircle className="spinner" size={18} /> : <ArrowUpRight size={18} />}</button></form>
    <Link className="account-explore" to="/#vehicules"><span>Votre prochaine escapade ?<strong>Découvrez nos véhicules</strong></span><ArrowUpRight size={23} /></Link></>}
    <button className="text-button logout-button" disabled={!!busy} onClick={logout}><LogOut size={17} />{busy === 'logout' ? 'Déconnexion…' : 'Me déconnecter'}</button>
  </AccountLayout>
}
