import assert from 'node:assert/strict'
import test from 'node:test'
import { validateAuth, validateAgency, authErrorMessage } from '../src/lib/auth.ts'
const fields = { email: 'client@example.test', password: 'bonjour123', confirmation: 'bonjour123', fullName: 'Client Test' }
test('inscription : valide e-mail, nom, longueur et confirmation du mot de passe', () => {
  assert.deepEqual(validateAuth(fields, true), {})
  assert.equal(Object.keys(validateAuth({ email: '', password: '', confirmation: '', fullName: '' }, true)).length, 4)
  assert.ok(validateAuth({ ...fields, email: 'invalide' }, true).email)
  assert.ok(validateAuth({ ...fields, fullName: ' '.repeat(3) }, true).fullName)
  assert.ok(validateAuth({ ...fields, fullName: 'a'.repeat(101) }, true).fullName)
  assert.ok(validateAuth({ ...fields, password: 'court' }, true).password)
  assert.ok(validateAuth({ ...fields, confirmation: 'autre' }, true).confirmation)
})
test('connexion : accepte aussi les mots de passe existants de moins de 8 caractères', () => {
  assert.deepEqual(validateAuth({ ...fields, password: '123456', fullName: '', confirmation: '' }, false), {})
})
test('erreurs Auth traduites sans divulguer les messages techniques', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /incorrect/)
  assert.match(authErrorMessage({ code: 'user_already_exists' }), /existe déjà/)
  assert.match(authErrorMessage(new Error('private debug detail')), /Impossible de joindre/)
})


test('agence : vérifie les limites SQL et les fichiers avant de créer le compte', () => {
  const agency = { ...fields, role: 'agency' as const, businessName: 'Agence Test', rcNumber: 'RC-123', rcFile: new File(['document'], 'rc.pdf', { type: 'application/pdf' }) }
  assert.deepEqual(validateAuth(agency, true), {})
  for (const businessName of ['', 'a', 'a'.repeat(161)]) assert.ok(validateAgency({ ...agency, businessName }).businessName)
  for (const rcNumber of ['', 'a', 'a'.repeat(81)]) assert.ok(validateAgency({ ...agency, rcNumber }).rcNumber)
  assert.ok(validateAgency({ ...agency, rcFile: null }).rcFile)
  assert.ok(validateAgency({ ...agency, rcFile: new File(['x'], 'rc.html', { type: 'text/html' }) }).rcFile)
  assert.ok(validateAgency({ ...agency, rcFile: new File([], 'empty.pdf', { type: 'application/pdf' }) }).rcFile)
  assert.ok(validateAgency({ ...agency, rcFile: new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' }) }).rcFile)
  assert.deepEqual(validateAgency({ ...agency, rcFile: new File(['image'], 'rc.png', { type: 'image/png' }) }), {})
})
