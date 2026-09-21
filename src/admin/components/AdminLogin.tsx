import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { AccountLayout } from '../../components/AccountLayout'
import { useAuth } from '../../auth/context'
import { authErrorMessage } from '../../lib/auth'
import { configurationError, supabase } from '../../lib/supabase'
export function AdminLogin() {
  const { error: sessionError } = useAuth()
  const [email, setEmail] = useState('admin@sbrental.local'), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), lock = useRef(false)
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return
    if (!supabase) { setError(configurationError); return }
    lock.current = true; setBusy(true); setError('')
    try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error }
    catch (e) { setError(authErrorMessage(e)) } finally { lock.current = false; setBusy(false) }
  }
  return <AccountLayout title="Administration"><p className="eyebrow">ESPACE SÉCURISÉ</p><h1>Connexion<br /><em>administrateur.</em></h1><p className="account-intro">Accès réservé au compte admin configuré dans Supabase.</p><form className="account-form" onSubmit={login}><fieldset disabled={busy}><div className="account-field"><label htmlFor="admin-email">E-mail admin</label><input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></div><div className="account-field"><label htmlFor="admin-password">Mot de passe</label><input id="admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></div>{(error || sessionError) && <p className="account-error" role="alert">{error || sessionError}</p>}<button className="button account-submit" type="submit">{busy ? <><LoaderCircle className="spinner" size={19} /> Connexion…</> : <>Ouvrir le dashboard <ArrowUpRight size={20} /></>}</button></fieldset></form><p className="account-switch"><Link to="/">Retour au site <ArrowUpRight size={14} /></Link></p></AccountLayout>
}
