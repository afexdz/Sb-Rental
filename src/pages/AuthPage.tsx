import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ArrowUpRight, Building2, CarFront, Eye, EyeOff, FileUp, LoaderCircle } from 'lucide-react'
import { useAuth } from '../auth/context'
import { AccountLayout } from '../components/AccountLayout'
import { agencyRequestErrorMessage, authErrorMessage, duplicateEmailMessage, isObfuscatedSignup, validateAgency, validateAuth, type AuthErrors, type AuthFields } from '../lib/auth'
import { supabase, configurationError } from '../lib/supabase'

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const { session, loading, error: sessionError } = useAuth()
  const location = useLocation()
  const [redirect, setRedirect] = useState<{ to: string; correction?: string } | null>(null)
  const [fields, setFields] = useState<AuthFields>({ email: '', password: '', confirmation: '', fullName: '', role: new URLSearchParams(location.search).get('profil') === 'agence' ? 'agency' : 'client', businessName: '', rcNumber: '', rcFile: null })
  const [errors, setErrors] = useState<AuthErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const submitting = useRef(false)
  const uploaded = useRef<{ file: File; path: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const resuming = signup && fields.role === 'agency' && !!session
  const [existingDocument, setExistingDocument] = useState<string | null>(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestLoadError, setRequestLoadError] = useState(false)
  const userId = session?.user.id
  useEffect(() => {
    if (!resuming || !userId || submitting.current) return
    let active = true
    setRequestLoading(true); setRequestLoadError(false)
    void (async () => {
      try {
        const { data, error: failure } = await supabase!.from('agency_requests').select('business_name, rc_number, document_path').eq('profile_id', userId).maybeSingle().retry(false)
        if (failure) throw failure
        if (active && data) {
          setExistingDocument(data.document_path)
          setFields(f => ({ ...f, businessName: data.business_name, rcNumber: data.rc_number }))
        }
      } catch {
        if (active) { setRequestLoadError(true); setError('Impossible de charger votre dossier. Actualisez la page pour réessayer.') }
      } finally { if (active) setRequestLoading(false) }
    })()
    return () => { active = false }
  }, [resuming, userId])
  if (redirect) return <Navigate to={redirect.to} replace state={{ correction: redirect.correction }} />
  if (session && !busy && !(signup && fields.role === 'agency')) return <Navigate to="/mon-compte" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || requestLoading || requestLoadError) return
    const issues = resuming ? validateAgency(fields, !!existingDocument) : validateAuth(fields, signup)
    setErrors(issues); setError(null); setNotice(null)
    if (Object.keys(issues).length) {
      const first = (['fullName', 'businessName', 'rcNumber', 'rcFile', 'email', 'password', 'confirmation'] as const).find(name => issues[name])
      if (first) document.getElementById(first)?.focus()
      return
    }
    if (!supabase) { setError(configurationError); return }
    submitting.current = true; setBusy(true)
    try {
      if (signup) {
        let activeSession = session
        if (!activeSession) {
          const { data, error: failure } = await supabase.auth.signUp({ email: fields.email.trim(), password: fields.password, options: { data: { full_name: fields.fullName.trim(), role: fields.role } } })
          if (failure) throw failure
          if (isObfuscatedSignup(data.user)) { setError(duplicateEmailMessage); return }
          activeSession = data.session
        }
        if (fields.role === 'agency' && activeSession) {
          const userId = activeSession.user.id
          const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', userId).single().retry(false)
          if (profileError) throw profileError
          if (profile.role !== 'agency') { setError('Ce compte est un compte client. Utilisez un compte agence pour envoyer un registre.'); return }
          let documentPath = existingDocument
          if (fields.rcFile) {
            if (!uploaded.current || uploaded.current.file !== fields.rcFile) {
              const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[fields.rcFile.type]
              const path = `${userId}/${crypto.randomUUID()}.${extension}`
              const { error: uploadError } = await supabase.storage.from('agency-documents').upload(path, fields.rcFile, { contentType: fields.rcFile.type, upsert: false })
              if (uploadError) { setError('Votre compte est créé, mais le registre n’a pas été envoyé. Réessayez avec le même formulaire.'); return }
              uploaded.current = { file: fields.rcFile, path }
            }
            documentPath = uploaded.current.path
          }
          if (!documentPath) { setError('Ajoutez le registre de commerce pour terminer votre dossier.'); return }
          const { error: requestError } = await supabase.rpc('submit_agency_request', { p_business_name: fields.businessName?.trim(), p_rc_number: fields.rcNumber?.trim(), p_document_path: documentPath })
          if (requestError) { setError(agencyRequestErrorMessage(requestError)); return }
          const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' })
          if (logoutError) throw logoutError
          setNotice('Votre demande est envoyée. Elle sera vérifiée par notre équipe avant l’accès agence.')
          setSubmitted(true)
          setFields(f => ({ ...f, password: '', confirmation: '', rcFile: null }))
        } else if (!activeSession) { setNotice(fields.role === 'agency' ? 'Confirmez votre adresse e-mail, puis reconnectez-vous pour envoyer le registre et terminer votre demande agence.' : 'Consultez votre e-mail pour confirmer votre compte, puis complétez votre profil client.'); setFields(f => ({ ...f, password: '', confirmation: '' })) }
      } else {
        const { data: signInData, error: failure } = await supabase.auth.signInWithPassword({ email: fields.email.trim(), password: fields.password })
        if (failure) throw failure
        const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', signInData.user.id).single().retry(false)
        if (profileError) { await supabase.auth.signOut({ scope: 'local' }); throw profileError }
        if (profile.role === 'agency') {
          const { data: request, error: requestError } = await supabase.from('agency_requests').select('status').eq('profile_id', signInData.user.id).maybeSingle().retry(false)
          if (requestError) { await supabase.auth.signOut({ scope: 'local' }); throw requestError }
          if (!request) { setRedirect({ to: '/inscription?profil=agence' }); return }
          if (request.status === 'rejected' || request.status === 'needs_changes') {
            setRedirect({ to: '/inscription?profil=agence', correction: request.status }); return
          }
          if (request?.status !== 'approved') {
            const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' })
            if (logoutError) throw logoutError
            setNotice(request?.status === 'rejected' ? 'Votre demande agence a été refusée. Contactez notre équipe pour la corriger.' : request?.status === 'needs_changes' ? 'Votre dossier nécessite des corrections. Contactez notre équipe.' : 'Votre demande agence est encore en cours de vérification.')
          }
        }
      }
    } catch (failure) { setError(authErrorMessage(failure)) }
    finally { submitting.current = false; setBusy(false) }
  }
  async function google() {
    if (!supabase || submitting.current) return
    submitting.current = true; setBusy(true); setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/mon-compte` } })
      if (error) throw error
    } catch (failure) { setError(authErrorMessage(failure)) }
    finally { submitting.current = false; setBusy(false) }
  }
  function field(name: 'fullName' | 'businessName' | 'rcNumber' | 'email' | 'password' | 'confirmation', label: string, type: string, autoComplete: string) {
    return <div className="account-field"><label htmlFor={name}>{label}</label><div className={name === 'password' ? 'password-input' : undefined}><input id={name} name={name} type={name === 'password' && visible ? 'text' : type} autoComplete={autoComplete} value={String(fields[name] ?? '')} required maxLength={name === 'fullName' ? 100 : name === 'businessName' ? 160 : name === 'rcNumber' ? 80 : undefined} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : name === 'password' && signup ? 'password-help' : undefined} onChange={e => { setFields({ ...fields, [name]: e.target.value }); setErrors({ ...errors, [name]: undefined }); setError(null) }} />{name === 'password' && <button type="button" className="password-toggle" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>}</div>{name === 'password' && signup && <p id="password-help" className="field-help">8 caractères minimum.</p>}{errors[name] && <p id={`${name}-error`} className="field-error">{errors[name]}</p>}</div>
  }
  return <AccountLayout title={signup ? 'Inscription' : 'Connexion'}>
    <p className="eyebrow">{signup ? 'REJOINDRE SB RENTAL' : 'VOTRE ESPACE CLIENT'}</p><h1>{signup ? <>Le début d’une<br /><em>belle route.</em></> : <>Heureux de<br /><em>vous retrouver.</em></>}</h1><p className="account-intro">{signup ? 'Choisissez votre profil pour commencer.' : 'Connectez-vous pour retrouver votre espace personnel.'}</p>
    {!signup && location.state?.signedOut && <p role="status" className="account-notice">Vous êtes bien déconnecté.</p>}
    {!signup && location.state?.protected && <p role="status" className="account-notice">Connectez-vous pour accéder à votre compte.</p>}
    {loading ? <p className="account-loading" role="status"><LoaderCircle className="spinner" size={20} /> Vérification de votre session…</p> : <form noValidate onSubmit={submit} className="account-form" aria-busy={busy}>
      {resuming && <p className="account-notice">Votre compte agence est créé. Complétez l’envoi du registre ci-dessous.</p>}
      {existingDocument && <p className="account-notice">Votre dossier est chargé. Toute modification sera soumise à une nouvelle vérification.</p>}
      {location.state?.correction === 'rejected' && <p role="status" className="account-notice">Votre demande agence a été refusée. Vous pouvez corriger votre dossier ci-dessous.</p>}
      {location.state?.correction === 'needs_changes' && <p role="status" className="account-notice">Votre dossier nécessite des corrections. Complétez-le ci-dessous.</p>}
      {requestLoading && <p role="status">Chargement du dossier…</p>}
      <fieldset disabled={busy || requestLoading || requestLoadError || !!sessionError || submitted}>
        {signup && !resuming && <div className="role-choice" role="group" aria-label="Type de compte"><button type="button" aria-pressed={fields.role === 'client'} className={fields.role === 'client' ? 'role-card is-selected' : 'role-card'} onClick={() => setFields({ ...fields, role: 'client', rcFile: null })}><CarFront size={20} /><span><strong>Client</strong><small>Je cherche une voiture</small></span></button><button type="button" aria-pressed={fields.role === 'agency'} className={fields.role === 'agency' ? 'role-card is-selected' : 'role-card'} onClick={() => setFields({ ...fields, role: 'agency' })}><Building2 size={20} /><span><strong>Agence</strong><small>Je propose mes véhicules</small></span></button></div>}
        {signup && !resuming && field('fullName', fields.role === 'agency' ? 'Nom complet du responsable' : 'Nom complet', 'text', 'name')}
        {signup && fields.role === 'agency' && <><div className="agency-fields"><div>{field('businessName', 'Nom de l’agence', 'text', 'organization')}</div><div>{field('rcNumber', 'Numéro du registre de commerce', 'text', 'off')}</div></div><div className="account-field"><label htmlFor="rcFile">Registre de commerce</label><label className={errors.rcFile ? 'file-drop has-error' : 'file-drop'} htmlFor="rcFile"><FileUp size={20} /><span>{fields.rcFile ? fields.rcFile.name : existingDocument ? 'Document actuel conservé (remplacement facultatif)' : 'Ajoutez un PDF ou une image'}</span><small>10 Mo maximum</small></label><input className="visually-hidden" id="rcFile" type="file" aria-invalid={!!errors.rcFile} aria-describedby={errors.rcFile ? "rcFile-error" : undefined} accept="application/pdf,image/jpeg,image/png" onChange={event => { setFields({ ...fields, rcFile: event.target.files?.[0] ?? null }); setErrors({ ...errors, rcFile: undefined }); setError(null) }} />{errors.rcFile && <p id="rcFile-error" className="field-error">{errors.rcFile}</p>}</div></>}
        {!resuming && field('email', 'Adresse e-mail', 'email', 'email')}
        {!resuming && field('password', 'Mot de passe', 'password', signup ? 'new-password' : 'current-password')}
        {signup && !resuming && field('confirmation', 'Confirmer le mot de passe', 'password', 'new-password')}
        {(error || sessionError) && <p className="account-error" role="alert">{error || sessionError}</p>}
        {notice && <p className="account-notice" role="status">{notice}</p>}
        <button className="button account-submit" type="submit">{busy ? <><LoaderCircle className="spinner" size={19} /> {signup ? (fields.role === 'agency' ? 'Envoi de la demande…' : 'Création du compte…') : 'Connexion…'}</> : <>{signup ? (fields.role === 'agency' ? 'Envoyer ma demande' : 'Créer mon compte') : 'Me connecter'} <ArrowUpRight size={20} /></>}</button>
      </fieldset>
    </form>}
    {(!signup || fields.role === 'client') && !session && <button className="button" disabled={busy || loading || !!sessionError} onClick={() => void google()}>Continuer avec Google</button>}
    <p className="account-switch">{signup ? 'Déjà un compte ?' : 'Pas encore de compte ?'} <Link to={signup ? '/connexion' : '/inscription'}>{signup ? 'Se connecter' : 'Créer un compte'} <ArrowUpRight size={14} /></Link></p>
  </AccountLayout>
}
