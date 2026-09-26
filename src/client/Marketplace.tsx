import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { queryError } from '../lib/queryError'
import { rpc } from './api'
import { money } from '../admin/model'
import type { Reservation, Vehicle } from '../admin/types'
export function Marketplace({ userId }: { userId: string }) {
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]), [vehicles, setVehicles] = useState<Vehicle[]>([]), [reservations, setReservations] = useState<Reservation[]>([])
  const [agency, setAgency] = useState(''), [vehicle, setVehicle] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('')
  const [verified, setVerified] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [attempt, setAttempt] = useState(0)
  const lock = useRef(false), request = useRef({ key: '', id: '' })
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [agencies, cars, bookings, status] = await Promise.all([
          rpc<{ id: string; name: string }[]>('list_verified_agencies'), supabase!.from('vehicles').select('*').eq('active', true).order('brand'),
          supabase!.from('reservations').select('*').eq('client_id', userId).order('created_at', { ascending: false }), rpc<boolean>('client_is_verified', { target: userId }),
        ])
        if (cars.error) throw cars.error
        if (bookings.error) throw bookings.error
        if (active) { setAgencies(agencies); setVehicles(cars.data); setReservations(bookings.data); setVerified(status); setError('') }
      } catch (e) { if (active) setError(queryError(e, 'Impossible de charger les agences et réservations')) }
    })()
    return () => { active = false }
  }, [userId, attempt])
  async function action(run: () => Promise<unknown>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await run(); setAttempt(v => v + 1) }
    catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="agency-panel"><h2>Agences et réservations</h2><button className="text-button" onClick={() => setAttempt(v => v + 1)}>Actualiser les disponibilités et mon statut</button>
    {error && <p role="alert" className="account-error">{error}</p>}{notice && <p role="status" className="account-notice">{notice}</p>}
    <div className="account-field"><label htmlFor="verified-agency">Agence vérifiée</label><select id="verified-agency" value={agency} onChange={e => { setAgency(e.target.value); setVehicle('') }}><option value="">Choisir une agence</option>{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
    <button className="button" disabled={busy || !agency} onClick={() => void action(async () => { await rpc('start_conversation', { p_agency_id: agency }); setNotice('Conversation ouverte. Cliquez sur « Actualiser les conversations » dans Messages.') })}>Contacter l’agence</button>
    <p className="account-notice">{verified ? 'Client vérifié : vous pouvez réserver.' : 'Client pending : contactez une agence dès maintenant. La réservation nécessite la vérification du passeport.'}</p>
    <form className="account-form" onSubmit={e => { e.preventDefault(); void action(async () => {
      const key = `${vehicle}:${start}:${end}`
      if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() }
      const result = await rpc<Reservation>('create_client_reservation', { p_vehicle_id: vehicle, p_start_date: start, p_end_date: end, p_request_id: request.current.id })
      setNotice(`Réservation ${result.reference} enregistrée. Total : ${money(result.total_cents)}.`)
    }) }}><fieldset disabled={busy || !verified}>
      <div className="account-field"><label htmlFor="booking-vehicle">Véhicule</label><select id="booking-vehicle" required value={vehicle} onChange={e => setVehicle(e.target.value)}><option value="">Choisir un véhicule</option>{vehicles.filter(v => v.agency_id === agency && v.availability === 'available').map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {money(v.daily_price_cents)} / jour</option>)}</select></div>
      <div className="account-field"><label htmlFor="booking-start">Début</label><input id="booking-start" type="date" required value={start} onChange={e => setStart(e.target.value)} /></div><div className="account-field"><label htmlFor="booking-end">Fin</label><input id="booking-end" type="date" required value={end} onChange={e => setEnd(e.target.value)} /></div>
      <button className="button">Réserver ce véhicule</button></fieldset></form>
    <h3>Mes réservations</h3>{reservations.map(r => <article key={r.id}><p><strong>{r.reference}</strong> · {r.start_date} → {r.end_date} · {money(r.total_cents)} · {r.status}</p>{r.status === 'confirmed' && <p className="account-notice">Réservation confirmée.</p>}</article>)}
  </section>
}
