import assert from 'node:assert/strict'
import test from 'node:test'
import { filterVehicles, nextDate, rentalDays, validateSearch } from '../src/lib/search.ts'
import { categories, cities, vehicles } from '../src/data/vehicles.ts'
import { existsSync } from 'node:fs'

const today = '2026-09-10'
const valid = { city: 'Alger', start: '2026-09-12', end: '2026-09-15' }

test('accepte une recherche complète et refuse les champs manquants', () => {
  assert.equal(validateSearch(valid, today), null)
  for (const field of ['city', 'start', 'end']) {
    assert.ok(validateSearch({ ...valid, [field]: '' }, today))
  }
})

test('refuse les dates passées, inversées, identiques ou impossibles', () => {
  assert.ok(validateSearch({ ...valid, start: '2026-09-09' }, today))
  assert.ok(validateSearch({ ...valid, end: valid.start }, today))
  assert.ok(validateSearch({ ...valid, end: '2026-09-11' }, today))
  assert.ok(validateSearch({ ...valid, start: '2026-02-30' }, today))
  assert.ok(validateSearch({ ...valid, end: 'bonjour' }, today))
})

test('calcule les journées calendaires sans dérive liée aux changements d’heure', () => {
  assert.equal(rentalDays('2026-03-28', '2026-03-30'), 2)
  assert.equal(rentalDays('2026-10-24', '2026-10-26'), 2)
  assert.equal(rentalDays('2028-02-28', '2028-03-01'), 2)
  assert.equal(nextDate('2026-12-31'), '2027-01-01')
  assert.equal(nextDate('2028-02-28'), '2028-02-29')
})

test('combine ville et catégorie, et conserve un véritable résultat vide', () => {
  assert.equal(filterVehicles(vehicles, '', 'Tous').length, 24)
  assert.equal(filterVehicles(vehicles, 'Alger', 'Tous').length, 6)
  assert.equal(filterVehicles(vehicles, 'Oran', 'Compacte')[0]?.id, 'volkswagen-golf')
  assert.equal(filterVehicles(vehicles, 'Tlemcen', 'Compacte').length, 0)
  assert.equal(filterVehicles(vehicles, 'Sétif', 'Tous').length, 0)
  for (const city of cities) for (const category of categories) {
    const result = filterVehicles(vehicles, city, category)
    assert.ok(result.every(v => v.city === city && (category === 'Tous' || v.category === category)))
  }
})

test('catalogue : 24 fiches uniques, les trois originales conservées, photos locales créditées', () => {
  assert.equal(new Set(vehicles.map(v => v.id)).size, 24)
  assert.deepEqual(vehicles.slice(0, 3).map(v => [v.id, v.year, v.city, v.dailyPrice]), [
    ['peugeot-208', 2024, 'Alger', 6500], ['volkswagen-golf', 2024, 'Oran', 11000], ['hyundai-tucson', 2025, 'Alger', 14500],
  ])
  for (const vehicle of vehicles) {
    assert.ok(cities.includes(vehicle.city))
    assert.ok(vehicle.description.length > 30 && vehicle.dailyPrice > 0 && vehicle.seats === 5)
    assert.equal(vehicle.availability, 'À confirmer')
    assert.ok(vehicle.image.startsWith('/images/vehicles/'))
    assert.ok(existsSync(new URL('../public' + vehicle.image, import.meta.url)))
    assert.ok(vehicle.photoCredit.author && vehicle.photoCredit.license)
    assert.ok(vehicle.photoCredit.source.startsWith('https://commons.wikimedia.org/'))
  }
})
