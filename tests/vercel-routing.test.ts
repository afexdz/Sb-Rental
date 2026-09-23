import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { getTransformedRoutes } from '@vercel/routing-utils'

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
// Compile the real configuration with Vercel's routing implementation.
// Vite's dev server already supplies an SPA fallback, so testing it alone
// would not detect a missing or incorrect Vercel rewrite.
const transformed = getTransformedRoutes(config)
const routes = transformed.routes ?? []
function rewrite(path: string) {
  const pathname = new URL(path, 'https://sb-rental.test').pathname
  return routes.find(route => 'src' in route && new RegExp(route.src).test(pathname))
}

test('Vercel : configuration valide et priorité aux fichiers statiques', () => {
  assert.equal(transformed.error, null)
  assert.ok(routes.length > 0)
  assert.deepEqual(routes[0], { handle: 'filesystem' })
})

test('Vercel : les accès directs aux espaces React servent index.html', () => {
  for (const path of [
    '/agence', '/agence?onglet=vehicules', '/connexion', '/inscription?profil=agence', '/mon-compte',
    '/admin', '/admin/utilisateurs', '/admin/agences', '/admin/vehicules', '/admin/reservations',
    '/admin/finances', '/admin/messages', '/admin/journal', '/admin/vehicules/vehicle-id',
  ]) {
    const route = rewrite(path)
    assert.ok(route && 'dest' in route && route.dest, `Aucune réécriture pour ${path}`)
    assert.equal(new URL(route.dest, 'https://sb-rental.test').pathname, '/index.html', path)
  }
})

test('Vercel : JS, CSS, polices, images et API ne sont pas réécrits en HTML', () => {
  for (const path of [
    '/assets/index-hash.js', '/assets/AgencyPage-hash.js', '/assets/index-hash.css',
    '/assets/manrope-hash.woff2', '/images/vehicles/peugeot-208.jpg', '/favicon.svg',
    '/assets/missing.js', '/images/missing.jpg', '/api/health', '/api/reservations', '/administration',
  ]) assert.equal(rewrite(path), undefined, path)
  // Include every actual public asset, not just a synthetic list of extensions.
  const root = new URL('../public/', import.meta.url)
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name).slice(root.pathname.length)
    assert.equal(rewrite(`/${path}`), undefined, path)
  }
})
