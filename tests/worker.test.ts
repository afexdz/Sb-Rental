import assert from 'node:assert/strict'
import test from 'node:test'
import worker from '../worker/index.ts'

const env = { ASSETS: { fetch: async () => new Response('asset') } }

test('expose un health check de démonstration et une erreur JSON pour les API inconnues', async () => {
  const health = await worker.fetch(new Request('http://localhost/api/health'), env)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok', service: 'sb-rental', mode: 'demo' })
  const missing = await worker.fetch(new Request('http://localhost/api/reservations'), env)
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: 'Route introuvable.' })
})

test('transmet les routes du site au binding des fichiers statiques', async () => {
  const response = await worker.fetch(new Request('http://localhost/'), env)
  assert.equal(await response.text(), 'asset')
})
