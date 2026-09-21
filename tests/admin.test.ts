import assert from 'node:assert/strict'
import test from 'node:test'
import { agencyBalances, booked, csv, financials, inRange, periodRange, series, unreadCount } from '../src/admin/model.ts'
import type { AdminData, Payment, Reservation } from '../src/admin/types.ts'
const empty: AdminData = { profiles: [], agencies: [], vehicles: [], reservations: [], payments: [], conversations: [], messages: [], reads: [], audit: [] }
const payment = (overrides: Partial<Payment>): Payment => ({ id: 'p', reservation_id: 'r', kind: 'deposit', source: 'manual', chargily_reference: null, amount_cents: 10000, commission_cents: 1000, refunded_cents: 0, refunded_commission_cents: 0, agency_transferred_cents: 0, status: 'confirmed', confirmed_at: '2026-09-14T10:00:00Z', refunded_at: null, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-14T10:00:00Z', admin_note: '', ...overrides })
test('finances : aucune valeur inventée, attente/échec exclus et remboursements ventilés', () => {
  assert.deepEqual(financials([]), { paid: 0, refunded: 0, net: 0, commission: 0, deposit: 0, due: 0, transferred: 0, pending: 0 })
  const result = financials([payment({ agency_transferred_cents: 2000, refunded_cents: 2000, refunded_commission_cents: 200 }), payment({ status: 'pending', confirmed_at: null, amount_cents: 5000 }), payment({ status: 'failed', confirmed_at: null, amount_cents: 999999 })])
  assert.equal(result.paid, 10000); assert.equal(result.refunded, 2000); assert.equal(result.net, 8000); assert.equal(result.commission, 800); assert.equal(result.due, 5200); assert.equal(result.pending, 5000)
  assert.equal(financials([payment({ status: 'refunded', refunded_cents: 10000, refunded_commission_cents: 1000 })]).net, 0)
})
test('chiffre d’affaires réservé : exclut demandes et annulations', () => {
  const rows = [{ status: 'request', total_cents: 1000 }, { status: 'cancelled', total_cents: 2000 }, { status: 'confirmed', total_cents: 3000 }, { status: 'completed', total_cents: 4000 }] as Reservation[]
  assert.equal(booked(rows), 7000)
})
test('périodes : fuseau algérien, semaine lundi, année et février bissextile', () => {
  assert.equal(new Date(periodRange('day', '2026-09-14').start).toISOString(), '2026-09-13T23:00:00.000Z')
  assert.equal(new Date(periodRange('week', '2026-09-20').start).toISOString(), '2026-09-13T23:00:00.000Z')
  assert.equal(inRange('2026-09-14T23:00:00Z', periodRange('day', '2026-09-14')), false)
  assert.equal(series(empty, 'month', '2028-02-16').length, 29)
  assert.equal(series(empty, 'year', '2026-12-31').length, 12)
  assert.equal(series(empty, 'day', '2026-09-14').length, 24)
})
test('graphiques : confirmation et remboursement sur leurs dates réelles, y compris valeurs négatives', () => {
  const data = { ...empty, payments: [payment({ refunded_cents: 2000, refunded_commission_cents: 200, refunded_at: '2026-09-15T10:00:00Z' })] }
  const points = series(data, 'week', '2026-09-14')
  assert.equal(points[0].revenue, 10000); assert.equal(points[1].revenue, -2000); assert.equal(points[1].commission, -200)
  assert.equal(series(data, 'month', '2026-08-01').every(p => p.revenue === 0), true)
})
test('CSV protège les formules, les guillemets et les retours ligne', () => {
  assert.equal(csv([['=HYPERLINK("x")', 'a;b', 'ligne\n2']]), '\uFEFF"\'=HYPERLINK(""x"")";"a;b";"ligne\n2"')
})
test('messages : les lectures ne concernent que leur conversation', () => {
  const data = { ...empty, messages: [{ id: 'm1', conversation_id: 'a', sender_id: 'u', body: 'a', created_at: '2026-09-14T10:00:00Z' }, { id: 'm2', conversation_id: 'b', sender_id: 'u', body: 'b', created_at: '2026-09-14T10:00:00Z' }], reads: [{ conversation_id: 'a', admin_id: 'admin', last_read_at: '2026-09-14T11:00:00Z' }] }
  assert.equal(unreadCount(data), 1); assert.equal(unreadCount(data, 'a'), 0)
})

test('soldes agence : un remboursement dû par une agence ne diminue pas les sommes dues à une autre', () => {
  const reservations = [{ id: 'r', agency_id: 'a' }, { id: 'r2', agency_id: 'b' }] as Reservation[]
  const payments = [payment({ status: 'refunded', refunded_cents: 10000, refunded_commission_cents: 1000, agency_transferred_cents: 9000 }), payment({ reservation_id: 'r2' })]
  assert.deepEqual(agencyBalances(payments, reservations), { payable: 9000, recoverable: 9000 })
  assert.deepEqual(agencyBalances([], []), { payable: 0, recoverable: 0 })
})
