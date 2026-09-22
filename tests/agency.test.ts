import test from 'node:test'
import assert from 'node:assert/strict'
import { agencyError, imageIssue, priceInCents, resizedDimensions, validateShop, validateVehicle } from '../src/agency/model.ts'

const shop = { display_name: 'Agence du Littoral', phone: '+213 555 12 34 56', address: '12 rue du Port', city: 'Alger', description: 'Location de véhicules.' }
const vehicle = { brand: 'Peugeot', model: '208', category: 'city', year: '2026', dailyPrice: '4500,50', color: 'Blanc', availability: 'available', description: '' }
test('boutique : validation des champs et des limites', () => {
  assert.deepEqual(validateShop(shop), {})
  for (const display_name of ['', 'a', 'a'.repeat(161)]) assert.ok(validateShop({ ...shop, display_name }).display_name)
  for (const phone of ['abc', '+'.repeat(9), '1'.repeat(31)]) assert.ok(validateShop({ ...shop, phone }).phone)
  assert.ok(validateShop({ ...shop, city: '  ', address: 'a'.repeat(251), description: 'a'.repeat(3001) }).city)
  assert.ok(validateShop({ ...shop, address: 'a'.repeat(251) }).address)
  assert.ok(validateShop({ ...shop, description: 'a'.repeat(3001) }).description)
})
test('véhicule : prix DZD exact, champs obligatoires, catégories et trois photos', () => {
  assert.deepEqual(validateVehicle(vehicle, 3), {})
  assert.equal(priceInCents('4500,50'), 450050)
  assert.equal(priceInCents('0.29'), 29)
  assert.equal(priceInCents('90000000000'), 9000000000000)
  for (const value of ['', '-1', '0', '1e3', 'Infinity', '1.001', '90000000001', '1 000']) assert.equal(priceInCents(value), null)
  for (const key of ['brand', 'model', 'category', 'year', 'dailyPrice', 'color', 'availability'] as const) assert.ok(validateVehicle({ ...vehicle, [key]: '' }, 0)[key])
  for (const year of ['1949', '2201', '2026.5', 'abcd']) assert.ok(validateVehicle({ ...vehicle, year }, 0).year)
  assert.ok(validateVehicle({ ...vehicle, category: 'toString', availability: '__proto__' }, 0).category)
  assert.ok(validateVehicle(vehicle, 4).photos)
  assert.ok(validateVehicle(vehicle, -1).photos)
  assert.ok(validateVehicle({ ...vehicle, brand: 'a'.repeat(81), model: 'a'.repeat(101), color: 'a'.repeat(61), description: 'a'.repeat(3001) }, 0).color)
})
test('images : taille, types autorisés, ratio et absence d’agrandissement', () => {
  assert.deepEqual(resizedDimensions(4000, 3000), { width: 1600, height: 1200 })
  assert.deepEqual(resizedDimensions(1200, 3600), { width: 533, height: 1600 })
  assert.deepEqual(resizedDimensions(320, 200), { width: 320, height: 200 })
  assert.throws(() => resizedDimensions(0, 100))
  assert.throws(() => resizedDimensions(Infinity, 100))
  assert.equal(imageIssue({ type: 'image/png', size: 1000 }), null)
  assert.ok(imageIssue({ type: 'image/svg+xml', size: 1000 }))
  assert.ok(imageIssue({ type: 'image/jpeg', size: 0 }))
  assert.ok(imageIssue({ type: 'image/jpeg', size: 21 * 1024 * 1024 }))
})
test('erreurs agence : messages utiles sans divulgation de données techniques', () => {
  assert.match(agencyError({ code: '42501' }), /Accès refusé/)
  assert.match(agencyError({ code: '23514' }), /3 photos/)
  assert.doesNotMatch(agencyError(new Error('sensitive database error')), /sensitive/)
})
