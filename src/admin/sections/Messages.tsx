import { useFilters } from '../useFilters'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { MessagesSquare } from 'lucide-react'
import { useAdmin } from '../context'
import { adminMutation } from '../api'
import { agencyName, date, matches, personName, unreadCount } from '../model'
import { DataTable, EmptyState } from '../components/DataTable'
import { Badge, DetailHeader, Notice, PageHeader, Panel } from '../components/UI'
import { SearchInput, SelectFilter } from '../components/Filters'
import { StatCards } from '../components/StatCards'
export function MessagesSection() {
  const { data } = useAdmin(), f = useFilters()
  const rows = data.conversations.filter(c => matches(f.query, c.subject, personName(data, c.client_id), agencyName(data, c.agency_id)) && (!f.get('statut') || c.status === f.get('statut')) && (!f.get('lecture') || unreadCount(data, c.id) > 0))
  return <><PageHeader title="Messages" description="Consultez les échanges client–agence et suivez les conversations actives." /><StatCards items={[{ label: 'Conversations actives', value: data.conversations.filter(c => c.status === 'active').length, icon: MessagesSquare }, { label: 'Messages non lus par vous', value: unreadCount(data) }, { label: 'Conversations au total', value: data.conversations.length }]} /><Panel title="Conversations"><div className="bo-filters"><SearchInput value={f.query} onChange={v => f.set('q', v)} placeholder="Rechercher un sujet, un client ou une agence" /><SelectFilter label="Statut" value={f.get('statut')} onChange={v => f.set('statut', v)} options={{ active: 'Actives', closed: 'Fermées' }} /><SelectFilter label="Lecture" value={f.get('lecture')} onChange={v => f.set('lecture', v)} options={{ unread: 'Non lues' }} /></div><DataTable key={f.key} rows={rows} label="Conversations" empty="Aucune conversation enregistrée" columns={[
    { label: 'Conversation', render: c => <Link className="bo-link" to={`/admin/messages/${c.id}`}>{c.subject}</Link> }, { label: 'Client', render: c => personName(data, c.client_id) }, { label: 'Agence', render: c => agencyName(data, c.agency_id) }, { label: 'Statut', render: c => <Badge value={c.status} label={c.status === 'active' ? 'Active' : 'Fermée'} /> }, { label: 'Non lus', render: c => unreadCount(data, c.id) || '—' }, { label: 'Création', render: c => date(c.created_at) },
  ]} /></Panel></>
}
export function ConversationDetail() {
  const { id } = useParams(), { data, refresh } = useAdmin(), [error, setError] = useState('')
  const conversation = data.conversations.find(c => c.id === id)
  const exists = !!conversation
  useEffect(() => {
    if (!id || !exists) return
    let active = true
    void adminMutation('admin_read_conversation', { target_id: id }).then(() => { if (active) refresh() }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [id, exists, refresh])
  if (!conversation) return <EmptyState title="Conversation introuvable" />
  const messages = data.messages.filter(m => m.conversation_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  return <><DetailHeader back="/admin/messages" title={conversation.subject} description={`${personName(data, conversation.client_id)} · ${agencyName(data, conversation.agency_id)}`} />{error && <Notice error>{error}</Notice>}<Panel title="Historique de la conversation" action={<Badge value={conversation.status} label={conversation.status === 'active' ? 'Active' : 'Fermée'} />}>{messages.length ? <ol className="bo-conversation">{messages.map(m => <li key={m.id} className={m.sender_id === conversation.agency_id ? 'is-agency' : ''}><div><strong>{personName(data, m.sender_id)}</strong><time dateTime={m.created_at}>{date(m.created_at, true)}</time></div><p>{m.body}</p></li>)}</ol> : <EmptyState title="Aucun message" message="Les messages de cette conversation apparaîtront ici." />}{conversation.reservation_id && <Link key="reservation" className="bo-link" to={`/admin/reservations/${conversation.reservation_id}`}>Voir la réservation liée →</Link>}</Panel><p className="bo-footnote">Consultation administrative. L’état « lu » est propre à votre compte administrateur.</p></>
}
