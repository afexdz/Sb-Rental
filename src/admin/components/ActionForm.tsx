import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Save, LoaderCircle } from 'lucide-react'
import { Notice } from './UI'
export function ActionForm({ action, children, label = 'Enregistrer' }: { action: (form: FormData) => Promise<void>; children: ReactNode; label?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false)
  const lock = useRef(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (lock.current) return
    const form = new FormData(e.currentTarget); lock.current = true; setBusy(true); setError(''); setSuccess(false)
    try { await action(form); setSuccess(true) } catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible. Réessayez.') } finally { lock.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} className="bo-action-form" aria-busy={busy}><fieldset disabled={busy}>{children}{error && <Notice error>{error}</Notice>}{success && <Notice>Modification enregistrée.</Notice>}<button className="button" type="submit">{busy ? <LoaderCircle className="spinner" size={17} /> : <Save size={17} />}{busy ? 'Enregistrement…' : label}</button></fieldset></form>
}
