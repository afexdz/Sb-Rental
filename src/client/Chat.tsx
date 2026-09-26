import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { queryError } from '../lib/queryError'
import { rpc, viewPassport } from './api'
import type { Conversation, Message } from '../admin/types'
type Access = { granted_path: string | null; granted_at: string | null }
export function Chat({ userId, role }: { userId: string; role: 'client' | 'agency' }) {
  const [items, setItems] = useState<Conversation[]>([]), [selected, setSelected] = useState('')
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    void supabase!.from('conversations').select('*').eq(role === 'client' ? 'client_id' : 'agency_id', userId).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      if (error) setError(queryError(error, 'Impossible de charger les conversations'))
      else { setItems(data); setError('') }
    })
    return () => { active = false }
  }, [userId, role, attempt])
  return <section className="agency-panel" aria-labelledby="chat-title"><h2 id="chat-title">Messages</h2><button className="text-button" onClick={() => { setLoading(true); setAttempt(v => v + 1) }}>Actualiser les conversations</button>
    {error && <p role="alert" className="account-error">{error}</p>}{loading ? <p role="status">Chargement des conversations…</p> : !items.length && !error && <p>Aucune conversation. Contactez une agence vérifiée pour commencer.</p>}
    <div className="agency-actions">{items.map(c => <button key={c.id} className="text-button" aria-pressed={c.id === selected} onClick={() => setSelected(c.id)}>{c.subject} · {c.id.slice(0, 8)}</button>)}</div>
    {items.find(c => c.id === selected) && <Thread key={selected} conversation={items.find(c => c.id === selected)!} userId={userId} role={role} />}
  </section>
}
function Thread({ conversation, userId, role }: { conversation: Conversation; userId: string; role: 'client' | 'agency' }) {
  const [messages, setMessages] = useState<Message[]>([]), [status, setStatus] = useState(''), [access, setAccess] = useState<Access | null>(null)
  const [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [result, request, status] = await Promise.all([
          supabase!.from('conversation_messages').select('*').eq('conversation_id', conversation.id).order('created_at').order('id'),
          supabase!.from('passport_access').select('granted_path,granted_at').eq('conversation_id', conversation.id).maybeSingle(),
          rpc<string>('conversation_client_status', { p_conversation_id: conversation.id }),
        ])
        if (result.error) throw result.error
        if (request.error) throw request.error
        if (active) { setMessages(result.data); setAccess(request.data); setStatus(status); setError('') }
      } catch (e) { if (active) setError(queryError(e, 'Impossible de charger cet échange')) }
    }
    void load()
    const timer = window.setInterval(() => void load(), 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [conversation.id, attempt])
  async function action(run: () => Promise<unknown>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await run(); setAttempt(v => v + 1) }
    catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible. Réessayez.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div><h3>Conversation</h3><p className="account-notice">{status === 'verified' ? 'Client vérifié' : status === 'pending' ? 'Client pending · passeport non vérifié' : 'Vérification du statut…'}</p>
    {error && <p role="alert" className="account-error">{error}</p>}
    <ol aria-label="Messages de la conversation">{messages.map(m => <li key={m.id}><strong>{m.sender_id === userId ? 'Vous' : role === 'client' ? 'Agence' : 'Client'} :</strong> <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</span></li>)}</ol>
    <form className="account-form" onSubmit={e => { e.preventDefault(); void action(async () => { await rpc('send_conversation_message', { p_conversation_id: conversation.id, p_body: body }); setBody('') }) }}><div className="account-field"><label htmlFor="chat-message">Votre message</label><textarea id="chat-message" required maxLength={10000} value={body} onChange={e => setBody(e.target.value)} disabled={busy} /></div><button className="button" disabled={busy || !body.trim()}>Envoyer le message</button></form>
    {role === 'agency' && <button className="text-button" disabled={busy} onClick={() => void action(() => rpc('request_passport_review', { p_conversation_id: conversation.id }))}>Demander la vérification du passeport</button>}
    {role === 'client' && access && <div className="account-notice"><p>L’agence demande l’accès à votre passeport privé pour vérifier votre profil. Un lien déjà ouvert expire après 60 secondes.</p><button className="text-button" disabled={busy} onClick={() => void action(() => rpc('authorize_passport_review', { p_conversation_id: conversation.id, p_allow: !access.granted_at }))}>{access.granted_at ? 'Révoquer l’accès au passeport' : 'Autoriser cette agence à consulter mon passeport'}</button></div>}
    {role === 'agency' && access?.granted_path && <div className="agency-actions"><button className="text-button" disabled={busy} onClick={() => void action(() => viewPassport(access.granted_path!))}>Consulter le passeport privé</button><button className="button" disabled={busy || status === 'verified'} onClick={() => void action(() => rpc('verify_client_passport', { p_client_id: conversation.client_id, p_expected_path: access.granted_path }))}>Confirmer la vérification du passeport</button></div>}
  </div>
}
