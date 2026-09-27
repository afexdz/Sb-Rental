import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingGroup, canCancel, canComplete, nights, reasonError } from '../src/reservations/model.ts'
import { transitions } from '../src/admin/model.ts'

test('réservations : regroupement agence par statut', () => {
  assert.equal(bookingGroup('request'), 'todo')
  for (const status of ['confirmed', 'deposit_paid', 'delivered'] as const) assert.equal(bookingGroup(status), 'active')
  for (const status of ['rejected', 'cancelled', 'completed'] as const) assert.equal(bookingGroup(status), 'history')
})

test('réservations : nombre de jours sans décalage horaire', () => {
  assert.equal(nights('2026-10-01', '2026-10-04'), 3)
  assert.equal(nights('2027-03-27', '2027-03-29'), 2)
})

test('réservations : annulation avant le début uniquement', () => {
  const today = '2026-10-10'
  assert.ok(canCancel({ status: 'request', start_date: '2026-10-09' }, today))
  assert.ok(canCancel({ status: 'confirmed', start_date: '2026-10-11' }, today))
  assert.ok(!canCancel({ status: 'confirmed', start_date: '2026-10-10' }, today))
  assert.ok(!canCancel({ status: 'rejected', start_date: '2026-10-20' }, today))
  assert.ok(!canCancel({ status: 'deposit_paid', start_date: '2026-10-20' }, today))
})

test('réservations : clôture après le début de la location', () => {
  assert.ok(canComplete({ status: 'confirmed', start_date: '2026-10-10' }, '2026-10-10'))
  assert.ok(!canComplete({ status: 'confirmed', start_date: '2026-10-11' }, '2026-10-10'))
  assert.ok(!canComplete({ status: 'request', start_date: '2026-10-01' }, '2026-10-10'))
})

test('réservations : motif obligatoire pour refus et annulation agence', () => {
  assert.ok(reasonError(''))
  assert.ok(reasonError('  a '))
  assert.equal(reasonError('Véhicule en panne'), null)
  assert.ok(reasonError('x'.repeat(501)))
})

test('réservations : transitions admin cohérentes avec la base', () => {
  assert.deepEqual(transitions.request, ['confirmed', 'rejected', 'cancelled'])
  assert.deepEqual(transitions.rejected, [])
  assert.ok(transitions.confirmed.includes('completed'))
})
