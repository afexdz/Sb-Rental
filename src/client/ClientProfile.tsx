import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { queryError } from '../lib/queryError'
import { passportError, profileError, type Verification } from './model'
export function ClientProfile({ userId, email }: { userId: string; email: string }) {
  const [profile, setProfile] = useState<Verification | null>(null)
  const [first, setFirst] = useState(''), [last, setLast] = useState(''), [phone, setPhone] = useState('')
  const [file, setFile] = useState<File | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0)
  const upload = useRef<{ file: File; path: string } | null>(null), lock = useRef(false)
  useEffect(() => {
    let active = true
    void supabase!.from('client_verifications').select('*').eq('client_id', userId).single().then(({ data, error }) => {
      if (!active) return
      if (error) setError(queryError(error, 'Impossible de charger la vérification du profil'))
      else { setProfile(data); setFirst(data.first_name); setLast(data.last_name); setPhone(data.phone) }
    })
    return () => { active = false }
  }, [userId, attempt])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    setError(''); setNotice('')
    const invalid = profileError(first, last, phone, email, !!file || !!profile?.passport_path) || (file && passportError(file))
    if (invalid) { setError(invalid); return }
    lock.current = true; setBusy(true)
    try {
      let path = profile?.passport_path
      if (file) {
        if (upload.current?.file !== file) {
          const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
          const destination = `${userId}/${crypto.randomUUID()}.${extension}`
          const { error } = await supabase!.storage.from('client-passports').upload(destination, file, { upsert: false, contentType: file.type })
          if (error) throw error
          upload.current = { file, path: destination }
        }
        path = upload.current.path
      }
      const { error } = await supabase!.rpc('submit_client_profile', { p_first_name: first, p_last_name: last, p_phone: phone, p_email: email, p_passport_path: path })
      if (error) throw error
      setNotice('Profil envoyé. Statut pending : en attente de vérification. Vous pouvez déjà contacter une agence vérifiée.')
      setAttempt(v => v + 1)
    } catch (e) { setError(queryError(e, 'Impossible de terminer le profil')) }
    finally { lock.current = false; setBusy(false) }
  }
  return <section aria-labelledby="verification-title"><h2 id="verification-title">Vérification de votre profil</h2>
    <p className="account-notice">{profile?.status === 'verified' ? 'Client vérifié · réservation et acompte autorisés.' : 'Client pending · en attente de vérification. Le chat avec une agence vérifiée reste accessible.'}</p>
    {error && <p role="alert" className="account-error">{error}</p>}
    {!profile ? <button className="text-button" onClick={() => { setError(''); setAttempt(v => v + 1) }}>Actualiser le profil</button> : <form className="account-form" onSubmit={save}>
      <fieldset disabled={busy}>
        <div className="account-field"><label htmlFor="client-last">Nom</label><input id="client-last" autoComplete="family-name" value={last} onChange={e => setLast(e.target.value)} required maxLength={50} /></div>
        <div className="account-field"><label htmlFor="client-first">Prénom</label><input id="client-first" autoComplete="given-name" value={first} onChange={e => setFirst(e.target.value)} required maxLength={50} /></div>
        <div className="account-field"><label htmlFor="client-phone">Téléphone</label><input id="client-phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={30} /></div>
        <div className="account-field"><label htmlFor="client-email">Email de connexion</label><input id="client-email" type="email" value={email} readOnly required /><p className="field-help">Votre adresse de connexion confirmée est utilisée pour votre dossier.</p></div>
        <div className="account-field"><label htmlFor="passport">Téléversez votre passeport</label><input id="passport" type="file" accept="application/pdf,image/jpeg,image/png" required={!profile.passport_path} onChange={e => setFile(e.target.files?.[0] ?? null)} /><p className="field-help">PDF, JPEG ou PNG · 10 Mo maximum. Document privé. {profile.passport_path && 'Passeport déjà déposé ; remplacement facultatif.'}</p></div>
        <p className="field-help">Toute modification remet le dossier en attente et révoque les autorisations de consultation des agences.</p>
        <button className="button" type="submit">{busy ? 'Envoi…' : 'Terminer mon profil'}</button>
      </fieldset>
      {notice && <p role="status" className="account-notice">{notice}</p>}
    </form>}
  </section>
}
