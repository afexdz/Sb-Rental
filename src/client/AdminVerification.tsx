import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { queryError } from '../lib/queryError'
import { rpc, viewPassport } from './api'
import type { Verification } from './model'
export function AdminVerification({ clientId }: { clientId: string }) {
  const [profile, setProfile] = useState<Verification | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void supabase!.from('client_verifications').select('*').eq('client_id', clientId).single().then(({ data, error }) => {
      if (active) { if (error) setError(queryError(error, 'Dossier client indisponible')); else { setProfile(data); setError('') } }
    })
    return () => { active = false }
  }, [clientId, attempt])
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); setAttempt(v => v + 1) } catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible.') } finally { setBusy(false) }
  }
  return <section><h3>Vérification du client</h3>{error && <p role="alert" className="account-error">{error}</p>}{profile && <><p>{profile.status === 'verified' ? 'Client vérifié' : 'Client pending · en attente de vérification'}</p><p>{profile.first_name} {profile.last_name} · {profile.phone}</p>{profile.passport_path ? <div className="agency-actions"><button className="bo-link" disabled={busy} onClick={() => void run(() => viewPassport(profile.passport_path!))}>Consulter le passeport privé</button><button className="button" disabled={busy || profile.status === 'verified'} onClick={() => void run(() => rpc('verify_client_passport', { p_client_id: clientId, p_expected_path: profile.passport_path }))}>Vérifier le client</button></div> : <p>Profil incomplet : passeport non fourni.</p>}</>}<button className="text-button" disabled={busy} onClick={() => setAttempt(v => v + 1)}>Actualiser le dossier client</button></section>
}
