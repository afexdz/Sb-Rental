import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, History, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { queryError } from '../lib/queryError'
import { localDate } from '../lib/search'
import { rpc } from '../client/api'
import { money } from '../admin/model'
import { actorLabels, bookingGroup, bookingLabels, canCancel, canComplete, nights, reasonError, shortDate, type AgencyBooking, type BookingEvent, type BookingGroup, type ClientBooking } from './model'
import './reservations.css'

type Mode = { id: string; kind: 'reject' | 'cancel' } | null

function useBookings<T>(name: string, refreshKey: unknown) {
  const [rows, setRows] = useState<T[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    rpc<T[]>(name).then(data => { if (active) { setRows(data ?? []); setError('') } }).catch(e => { if (active) setError(queryError(e, 'Impossible de charger les réservations')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [name, refreshKey, attempt])
  return { rows, loading, error, reload: () => { setLoading(true); setAttempt(v => v + 1) } }
}

function useAction(reload: () => void) {
  const lock = useRef(false), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  async function run(id: string, task: () => Promise<unknown>, success: string) {
    if (lock.current) return false
    lock.current = true; setBusy(id); setError(''); setNotice('')
    try { await task(); setNotice(success); reload(); return true }
    catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible.'); return false }
    finally { lock.current = false; setBusy(null) }
  }
  return { busy, error, notice, run }
}

function Badge({ status }: { status: ClientBooking['status'] }) {
  return <span className={`booking-badge is-${status}`}>{bookingLabels[status]}</span>
}

function BookingHistory({ id }: { id: string }) {
  const [events, setEvents] = useState<BookingEvent[] | null>(null), [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void supabase!.from('reservation_events').select('id,actor_role,from_status,to_status,note,created_at').eq('reservation_id', id).order('created_at')
      .then(({ data, error: failure }) => { if (!active) return; if (failure) setError(queryError(failure, 'Historique indisponible')); else setEvents(data as BookingEvent[]) })
    return () => { active = false }
  }, [id])
  if (error) return <p role="alert" className="account-error">{error}</p>
  if (!events) return <p role="status" className="booking-muted">Chargement de l’historique…</p>
  if (!events.length) return <p className="booking-muted">Aucun changement enregistré.</p>
  return <ol className="booking-history">{events.map(e => <li key={e.id}><strong>{bookingLabels[e.to_status] ?? e.to_status}</strong> · {actorLabels[e.actor_role]} · {new Date(e.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}{e.note && <span>« {e.note} »</span>}</li>)}</ol>
}

function Summary({ b }: { b: ClientBooking | AgencyBooking }) {
  const days = nights(b.start_date, b.end_date)
  return <dl className="booking-facts">
    <div><dt>Période</dt><dd><CalendarDays size={15} aria-hidden /> {shortDate(b.start_date)} → {shortDate(b.end_date)} · {days} jour{days > 1 ? 's' : ''}</dd></div>
    <div><dt>Total</dt><dd>{money(b.total_cents)}</dd></div>
    <div><dt>Acompte 10 %</dt><dd>{money(b.deposit_cents)}</dd></div>
  </dl>
}

function ReasonForm({ label, busy, onCancel, onSubmit }: { label: string; busy: boolean; onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState(''), [error, setError] = useState('')
  return <form className="booking-reason" onSubmit={e => { e.preventDefault(); const problem = reasonError(reason); setError(problem ?? ''); if (!problem) onSubmit(reason.trim()) }}>
    <label>{label}<textarea value={reason} maxLength={500} rows={3} onChange={e => setReason(e.target.value)} aria-invalid={!!error} autoFocus /></label>
    {error && <p role="alert" className="account-error">{error}</p>}
    <div className="booking-actions"><button className="button" disabled={busy}>{busy ? 'Envoi…' : 'Valider'}</button><button type="button" className="text-button" disabled={busy} onClick={onCancel}>Retour</button></div>
  </form>
}

export function ClientBookings({ refreshKey }: { refreshKey: unknown }) {
  const { rows, loading, error, reload } = useBookings<ClientBooking>('client_list_reservations', refreshKey)
  const action = useAction(reload), [mode, setMode] = useState<Mode>(null), [open, setOpen] = useState<string | null>(null), today = localDate()
  const cancel = (b: ClientBooking, note = '') => action.run(b.id, () => rpc('cancel_reservation', { p_reservation_id: b.id, p_note: note }), `Réservation ${b.reference} annulée.`).then(ok => { if (ok) setMode(null) })
  return <section className="booking-section" aria-labelledby="client-bookings-title">
    <div className="booking-heading"><h3 id="client-bookings-title">Mes réservations</h3><button className="text-button" onClick={reload} disabled={loading}>Actualiser</button></div>
    {action.error && <p role="alert" className="account-error">{action.error}</p>}{action.notice && <p role="status" className="account-notice">{action.notice}</p>}
    {loading && !rows.length ? <p role="status" className="booking-muted">Chargement de vos réservations…</p>
      : error ? <div><p role="alert" className="account-error">{error}</p><button className="button" onClick={reload}>Réessayer</button></div>
      : !rows.length ? <p className="booking-empty">Aucune réservation pour le moment. Votre demande apparaîtra ici dès son envoi.</p>
      : <div className="booking-list">{rows.map(b => <article key={b.id} className="booking-card" aria-label={`Réservation ${b.reference}`}>
        <header><div><strong>{b.vehicle_label}</strong><small>{b.agency_name} · {b.reference}</small></div><Badge status={b.status} /></header>
        <Summary b={b} />
        {b.status === 'request' && <p className="booking-muted">L’agence doit accepter votre demande. Vous verrez sa réponse ici.</p>}
        {b.status_note && ['rejected', 'cancelled', 'confirmed'].includes(b.status) && <p className="booking-note">Motif : {b.status_note}</p>}
        {mode?.id === b.id ? <ReasonForm label="Motif de l’annulation" busy={action.busy === b.id} onCancel={() => setMode(null)} onSubmit={note => void cancel(b, note)} />
          : <div className="booking-actions">
            {canCancel(b, today) && <button className="text-button is-danger" disabled={!!action.busy} onClick={() => setMode({ id: b.id, kind: 'cancel' })}><X size={16} /> Annuler</button>}
            <button className="text-button" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}><History size={16} /> Historique</button>
          </div>}
        {open === b.id && <BookingHistory id={b.id} />}
      </article>)}</div>}
  </section>
}

const groups: Record<BookingGroup, string> = { todo: 'À traiter', active: 'Confirmées', history: 'Historique' }

export function AgencyBookings({ onPending }: { onPending?: (count: number) => void }) {
  const { rows, loading, error, reload } = useBookings<AgencyBooking>('agency_list_reservations', null)
  const action = useAction(reload), [mode, setMode] = useState<Mode>(null), [open, setOpen] = useState<string | null>(null), [group, setGroup] = useState<BookingGroup>('todo'), today = localDate()
  const pending = rows.filter(b => b.status === 'request').length
  useEffect(() => { onPending?.(pending) }, [pending, onPending])
  const visible = rows.filter(b => bookingGroup(b.status) === group)
  const respond = (b: AgencyBooking, decision: 'confirmed' | 'rejected', note = '') => action.run(b.id, () => rpc('agency_respond_reservation', { p_reservation_id: b.id, p_decision: decision, p_note: note }), decision === 'confirmed' ? `Réservation ${b.reference} confirmée.` : `Demande ${b.reference} refusée.`).then(ok => { if (ok) setMode(null) })
  const cancel = (b: AgencyBooking, note: string) => action.run(b.id, () => rpc('cancel_reservation', { p_reservation_id: b.id, p_note: note }), `Réservation ${b.reference} annulée.`).then(ok => { if (ok) setMode(null) })
  const complete = (b: AgencyBooking) => action.run(b.id, () => rpc('agency_complete_reservation', { p_reservation_id: b.id }), `Location ${b.reference} terminée.`)
  return <section className="booking-section" aria-labelledby="agency-bookings-title">
    <div className="agency-section-heading"><div><h2 id="agency-bookings-title">Réservations</h2><p className="agency-muted">Acceptez ou refusez les demandes de vos clients.</p></div><button className="text-button" onClick={reload} disabled={loading}>Actualiser</button></div>
    <div className="booking-tabs" role="tablist">{(Object.keys(groups) as BookingGroup[]).map(key => { const count = rows.filter(b => bookingGroup(b.status) === key).length; return <button key={key} role="tab" aria-selected={group === key} onClick={() => { setGroup(key); setMode(null) }}>{groups[key]} <span>{count}</span></button> })}</div>
    {action.error && <p role="alert" className="account-error">{action.error}</p>}{action.notice && <p role="status" className="account-notice">{action.notice}</p>}
    {loading && !rows.length ? <p role="status" className="booking-muted">Chargement des réservations…</p>
      : error ? <div><p role="alert" className="account-error">{error}</p><button className="button" onClick={reload}>Réessayer</button></div>
      : !visible.length ? <div className="agency-empty"><CalendarDays size={40} /><h3>{group === 'todo' ? 'Aucune demande à traiter.' : group === 'active' ? 'Aucune réservation confirmée.' : 'Aucune réservation terminée ou annulée.'}</h3><p>Les demandes de vos clients apparaîtront ici.</p></div>
      : <div className="booking-list">{visible.map(b => <article key={b.id} className="booking-card" aria-label={`Réservation ${b.reference}`}>
        <header><div><strong>{b.vehicle_label}</strong><small>{b.reference}</small></div><Badge status={b.status} /></header>
        <p className="booking-client">{b.client_name} <span className={`booking-badge ${b.client_verified ? 'is-confirmed' : 'is-request'}`}>{b.client_verified ? 'Client vérifié' : 'Client pending'}</span>{b.client_phone && <a href={`tel:${b.client_phone.replace(/[^+0-9]/g, '')}`}>{b.client_phone}</a>}</p>
        <Summary b={b} />
        {b.status_note && <p className="booking-note">Motif : {b.status_note}</p>}
        {mode?.id === b.id ? <ReasonForm label={mode.kind === 'reject' ? 'Motif du refus (visible par le client)' : 'Motif de l’annulation (visible par le client)'} busy={action.busy === b.id} onCancel={() => setMode(null)} onSubmit={note => void (mode.kind === 'reject' ? respond(b, 'rejected', note) : cancel(b, note))} />
          : <div className="booking-actions">
            {b.status === 'request' && <><button className="button" disabled={!!action.busy || !b.client_verified || b.start_date < today} onClick={() => void respond(b, 'confirmed')}><Check size={16} /> {action.busy === b.id ? 'Envoi…' : 'Accepter'}</button><button className="text-button is-danger" disabled={!!action.busy} onClick={() => setMode({ id: b.id, kind: 'reject' })}><X size={16} /> Refuser</button></>}
            {b.status === 'confirmed' && canCancel(b, today) && <button className="text-button is-danger" disabled={!!action.busy} onClick={() => setMode({ id: b.id, kind: 'cancel' })}><X size={16} /> Annuler</button>}
            {canComplete(b, today) && <button className="button" disabled={!!action.busy} onClick={() => void complete(b)}><Check size={16} /> Terminer la location</button>}
            <button className="text-button" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}><History size={16} /> Historique</button>
          </div>}
        {b.status === 'request' && !b.client_verified && <p className="booking-muted">Ce client n’est pas encore vérifié : demandez son passeport dans les messages avant d’accepter.</p>}
        {b.status === 'request' && b.start_date < today && <p className="booking-muted">La date de début est passée : refusez cette demande.</p>}
        {open === b.id && <BookingHistory id={b.id} />}
      </article>)}</div>}
  </section>
}
