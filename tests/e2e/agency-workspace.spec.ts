import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

// These fixtures and their cleanup can only target the local development stack.
const config = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
if (new URL(config.API_URL).hostname !== '127.0.0.1') throw new Error('Tests agence réservés à Supabase local.')
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } }
const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const publicClient = () => createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, options)
const users: string[] = []
const password = 'Agency-workspace-test-837!'

async function user(role = 'agency', status = 'approved') {
  const email = `sb-workspace-${randomUUID()}@example.test`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, full_name: 'Responsable Lot 1' } })
  expect(error).toBeNull(); const id = data.user!.id; users.push(id)
  if (role === 'agency') expect((await service.from('agency_requests').insert({ profile_id: id, business_name: 'Agence du Littoral', rc_number: 'TEST-RC', document_path: `${id}/fixture.pdf`, status })).error).toBeNull()
  const api = publicClient(); expect((await api.auth.signInWithPassword({ email, password })).error).toBeNull()
  return { id, email, api }
}
type User = Awaited<ReturnType<typeof user>>
async function session(page: Page, account: User, path = '/agence') {
  const { data } = await account.api.auth.getSession()
  await page.addInitScript(({ url, value }) => { localStorage.setItem(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, JSON.stringify(value)) }, { url: config.API_URL, value: data.session })
  await page.goto(path)
}
const vehicle = (id: string) => ({ agency_id: id, brand: 'Peugeot', model: '208', year: 2026, category: 'city', daily_price_cents: 450050, color: 'Blanc', active: false })
test.afterEach(async () => {
  for (const id of users.splice(0)) {
    const request = await service.from('agency_requests').select('id').eq('profile_id', id).maybeSingle()
    expect(request.error).toBeNull()
    if (request.data) expect((await service.from('admin_audit_logs').delete().eq('entity_id', request.data.id)).error).toBeNull()
    const { data, error } = await service.storage.from('agency-assets').list(id)
    expect(error).toBeNull()
    if (data?.length) expect((await service.storage.from('agency-assets').remove(data.map(file => `${id}/${file.name}`))).error).toBeNull()
    expect((await service.from('vehicles').delete().eq('agency_id', id)).error).toBeNull()
    expect((await service.auth.admin.deleteUser(id)).error).toBeNull()
  }
})

test('permissions réelles : propriétaire approuvé, isolation, identifiants, photos et Storage', async ({ page }) => {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32
    return canvas.toDataURL('image/jpeg').split(',')[1]
  })
  const photo = new Blob([Buffer.from(encoded, 'base64')], { type: 'image/jpeg' })
  const a = await user(), b = await user(), pending = await user('agency', 'pending'), regular = await user('client')
  const anonymous = publicClient()
  expect((await a.api.rpc('is_approved_agency')).data).toBe(true)
  expect((await pending.api.rpc('is_approved_agency')).data).toBe(false)
  const shop = { id: a.id, display_name: 'Ma boutique', city: 'Alger' }
  expect((await a.api.from('agency_profiles').insert(shop)).error).toBeNull()
  expect((await a.api.from('agency_profiles').select().single()).data?.slug).toBe(`agence-${a.id.replaceAll('-', '')}`)
  expect((await b.api.from('agency_profiles').select()).data).toEqual([])
  expect((await b.api.from('agency_profiles').update({ city: 'Oran' }).eq('id', a.id).select()).data).toEqual([])
  expect((await b.api.from('agency_profiles').insert({ ...shop, display_name: 'Usurpation' })).error).toBeTruthy()
  expect((await a.api.from('agency_profiles').update({ id: b.id }).eq('id', a.id)).error).toBeTruthy()
  expect((await a.api.from('agency_profiles').update({ slug: 'nouveau-slug' }).eq('id', a.id)).error).toBeTruthy()
  expect((await a.api.from('agency_profiles').update({ created_at: '2000-01-01' }).eq('id', a.id)).error).toBeTruthy()
  expect((await a.api.from('agency_profiles').update({ logo_path: `${b.id}/other.jpg` }).eq('id', a.id)).error).toBeTruthy()
  expect((await a.api.from('agency_profiles').update({ city: 'Oran' }).eq('id', a.id).select().single()).data?.city).toBe('Oran')
  for (const account of [pending, regular]) {
    expect((await account.api.from('agency_profiles').insert({ id: account.id, display_name: 'Interdit' })).error).toBeTruthy()
    expect((await account.api.from('vehicles').insert(vehicle(account.id))).error).toBeTruthy()
    expect((await account.api.storage.from('agency-assets').upload(`${account.id}/forbidden.jpg`, photo, { contentType: 'image/jpeg' })).error).toBeTruthy()
  }
  expect((await anonymous.from('agency_profiles').select()).error).toBeTruthy()
  expect((await anonymous.from('vehicles').insert(vehicle(a.id))).error).toBeTruthy()
  expect((await a.api.from('vehicles').insert(vehicle(b.id))).error).toBeTruthy()
  const inserted = await a.api.from('vehicles').insert(vehicle(a.id)).select().single()
  expect(inserted.error).toBeNull(); const id = inserted.data.id
  expect((await b.api.from('vehicles').select().eq('id', id)).data).toEqual([])
  expect((await b.api.from('vehicles').update({ brand: 'Vol' }).eq('id', id).select()).data).toEqual([])
  expect((await a.api.from('vehicles').update({ agency_id: b.id }).eq('id', id)).error).toBeTruthy()
  expect((await a.api.from('vehicles').update({ created_at: '2000-01-01' }).eq('id', id)).error).toBeTruthy()
  expect((await a.api.from('vehicles').delete().eq('id', id)).error).toBeTruthy()
  expect((await a.api.from('vehicles').update({ photos: ['a', 'b', 'c', 'd'] }).eq('id', id)).error?.code).toBe('23514')
  expect((await a.api.from('vehicles').insert({ ...vehicle(a.id), photos: ['a', 'b', 'c', 'd'] })).error?.code).toBe('23514')
  expect((await a.api.from('vehicles').update({ photos: [['a', 'b'], ['c', 'd']] }).eq('id', id)).error?.code).toBe('23514')
  expect((await a.api.from('vehicles').update({ active: true, color: 'Noir' }).eq('id', id).select().single()).data?.active).toBe(true)
  expect((await a.api.from('vehicles').update({ active: false }).eq('id', id).select().single()).data?.active).toBe(false)
  const path = `${a.id}/photo.jpg`
  expect((await a.api.storage.from('agency-assets').upload(path, photo, { contentType: 'image/jpeg' })).error).toBeNull()
  expect((await a.api.storage.from('agency-assets').update(path, photo, { contentType: 'image/jpeg' })).error).toBeNull()
  expect((await b.api.storage.from('agency-assets').upload(`${a.id}/forged.jpg`, photo, { contentType: 'image/jpeg' })).error).toBeTruthy()
  expect((await b.api.storage.from('agency-assets').update(path, photo, { contentType: 'image/jpeg' })).error).toBeTruthy()
  expect((await b.api.storage.from('agency-assets').remove([path])).data).toEqual([])
  expect((await a.api.storage.from('agency-assets').move(path, `${b.id}/moved.jpg`)).error).toBeTruthy()
  expect((await a.api.storage.from('agency-assets').upload(`${a.id}/bad.svg`, '<svg/>', { contentType: 'image/svg+xml' })).error).toBeTruthy()
  expect((await a.api.storage.from('agency-assets').upload(`${a.id}/large.jpg`, new Blob([new Uint8Array(409601)], { type: 'image/jpeg' }), { contentType: 'image/jpeg' })).error).toBeTruthy()
  const publicUrl = a.api.storage.from('agency-assets').getPublicUrl(path).data.publicUrl
  expect((await fetch(publicUrl, { signal: AbortSignal.timeout(10000) })).status).toBe(200)
  expect((await service.storage.getBucket('agency-documents')).data?.public).toBe(false)
  expect((await a.api.storage.from('agency-assets').remove([path])).error).toBeNull()
  expect((await service.storage.from('agency-assets').list(a.id)).data).toEqual([])
  // Revocation applies to an already-issued session, without waiting for JWT expiry.
  expect((await service.from('agency_requests').update({ status: 'needs_changes' }).eq('profile_id', a.id)).error).toBeNull()
  expect((await a.api.from('vehicles').update({ active: true }).eq('id', id).select()).data).toEqual([])
  expect((await a.api.from('agency_profiles').select()).data).toEqual([])
  expect((await a.api.storage.from('agency-assets').upload(path, photo, { contentType: 'image/jpeg' })).error).toBeTruthy()
  expect((await service.from('profiles').update({ account_status: 'suspended' }).eq('id', b.id)).error).toBeNull()
  expect((await b.api.rpc('is_approved_agency')).data).toBe(false)
  expect((await b.api.from('vehicles').insert(vehicle(b.id))).error).toBeTruthy()
})

test('accès direct : visiteur, client, agence en vérification et compte suspendu', async ({ page }) => {
  await page.goto('/agence'); await expect(page).toHaveURL(/\/connexion$/)
  const pending = await user('agency', 'pending')
  await session(page, pending)
  await expect(page.getByText('Votre dossier agence est encore en cours de vérification.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enregistrer ma boutique' })).toHaveCount(0)
  const regular = await user('client')
  await session(page, regular)
  await expect(page).toHaveURL(/\/mon-compte$/)
  await expect(page.getByRole('heading', { name: 'Responsable Lot 1' })).toBeVisible()
  const suspended = await user()
  expect((await service.from('profiles').update({ account_status: 'suspended' }).eq('id', suspended.id)).error).toBeNull()
  await session(page, suspended)
  await expect(page.getByText('Votre compte agence est suspendu.', { exact: false })).toBeVisible()
})

test('boutique et véhicules : validation, compression, reprise, édition et publication', async ({ page }, info) => {
  const account = await user()
  const jsErrors: string[] = []; page.on('pageerror', error => jsErrors.push(error.message))
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(account.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/agence$/)
  await page.getByRole('button', { name: 'Enregistrer ma boutique' }).click()
  await expect(page.getByText('Indiquez une ville de 1 à 100 caractères.')).toBeVisible()
  await page.getByLabel('Nom de boutique').fill('Littoral Location')
  await page.getByLabel('Téléphone').fill('+213 555 12 34 56')
  await page.getByLabel('Adresse', { exact: false }).fill('12 rue du Port')
  await page.getByLabel('Ville').fill('Alger')
  await page.getByLabel('Description de la boutique').fill('Votre agence sur la côte.')
  // A real 3200x2200 PNG is compressed in the browser before Storage receives it.
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 3200; canvas.height = 2200
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#52694d'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#eee9da'; ctx.fillRect(400, 400, 2400, 1200)
    // A detailed image exercises the byte limit, not only dimension reduction.
    const detail = ctx.createImageData(1600, 1000)
    let seed = 12345
    for (let i = 0; i < detail.data.length; i += 4) {
      seed = (1664525 * seed + 1013904223) >>> 0
      detail.data[i] = seed & 255; detail.data[i + 1] = (seed >>> 8) & 255; detail.data[i + 2] = (seed >>> 16) & 255; detail.data[i + 3] = 255
    }
    ctx.putImageData(detail, 800, 600)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const file = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') }
  let uploads = 0
  page.on('request', request => { if (request.url().includes('/storage/v1/object/agency-assets/') && request.method() === 'POST') uploads++ })
  await page.getByLabel('Logo de la boutique', { exact: true }).setInputFiles(file)
  await expect(page.getByAltText('Logo de la boutique, aperçu 1')).toBeVisible()
  expect(uploads).toBe(0)
  await page.getByRole('button', { name: 'Enregistrer ma boutique' }).click()
  await expect(page.getByText('Votre boutique a bien été enregistrée.')).toBeVisible()
  const shop = await service.from('agency_profiles').select().eq('id', account.id).single()
  expect(shop.data.city).toBe('Alger'); expect(shop.data.logo_path).toMatch(/\.webp$|\.jpg$/)
  const stored = await account.api.storage.from('agency-assets').download(shop.data.logo_path)
  expect(stored.error).toBeNull(); expect(stored.data!.size).toBeLessThan(400 * 1024)
  const dimensions = await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); return [image.naturalWidth, image.naturalHeight] }, account.api.storage.from('agency-assets').getPublicUrl(shop.data.logo_path).data.publicUrl)
  expect(Math.max(...dimensions)).toBeLessThanOrEqual(1600)
  await page.reload(); await expect(page.getByLabel('Nom de boutique')).toHaveValue('Littoral Location')
  await page.getByLabel('Ville').fill('Oran'); await page.getByRole('button', { name: 'Enregistrer ma boutique' }).click()
  await expect(page.getByText('Votre boutique a bien été enregistrée.')).toBeVisible()
  await page.getByRole('button', { name: /Mes véhicules/ }).click()
  await page.getByRole('button', { name: 'Ajouter un véhicule' }).click()
  await page.getByRole('button', { name: 'Enregistrer le véhicule' }).click()
  await expect(page.getByText('Indiquez une marque de 1 à 80 caractères.')).toBeVisible()
  await page.getByLabel('Marque').fill('Peugeot'); await page.getByLabel('Modèle').fill('208')
  await page.getByLabel('Année').fill('2026'); await page.getByLabel('Prix journalier en DZD').fill('4500,50'); await page.getByLabel('Couleur').fill('Blanc')
  await page.getByLabel('Photos du véhicule', { exact: true }).setInputFiles([file, file, file, file])
  await expect(page.getByRole('alert')).toContainText('maximum 3 photos')
  await page.getByLabel('Photos du véhicule', { exact: true }).setInputFiles([file, file, file])
  await expect(page.getByAltText('Photos du véhicule, aperçu 3')).toBeVisible()
  await page.screenshot({ path: info.outputPath('agency-vehicle-form.png'), fullPage: true })
  const before = uploads
  let attempts = 0
  await page.route('**/rest/v1/vehicles*', route => {
    if (route.request().method() !== 'POST') return route.continue()
    attempts++
    return attempts === 1 ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"unavailable"}' }) : route.continue()
  })
  await page.getByRole('button', { name: 'Enregistrer le véhicule' }).click()
  await expect(page.getByRole('alert')).toContainText('Votre saisie est conservée')
  expect(uploads - before).toBe(3)
  await expect(page.getByLabel('Marque')).toHaveValue('Peugeot')
  await page.getByRole('button', { name: 'Enregistrer le véhicule' }).click()
  await expect(page.getByText('Votre véhicule a bien été enregistré.')).toBeVisible()
  expect(uploads - before).toBe(3)
  const card = page.getByRole('article', { name: 'Peugeot 208' })
  await expect(card.getByText('Désactivé', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Publier', exact: true }).click()
  await expect(card.getByText('Publié', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Modifier' }).click()
  await page.getByLabel('Couleur').fill('Bleu'); await page.getByLabel('Disponibilité').selectOption('maintenance')
  await page.getByRole('button', { name: 'Retirer la photo 3' }).click()
  await page.getByRole('button', { name: 'Enregistrer le véhicule' }).click()
  await expect(card.getByText('Maintenance', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Désactiver', exact: true }).click()
  await expect(card.getByText('Désactivé', { exact: true })).toBeVisible()
  await page.reload(); await expect(card.getByText('Désactivé', { exact: true })).toBeVisible()
  const saved = await service.from('vehicles').select().eq('agency_id', account.id).single()
  expect(saved.data).toMatchObject({ daily_price_cents: 450050, active: false, color: 'Bleu', availability: 'maintenance' })
  expect(saved.data.photos).toHaveLength(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('agency-dashboard.png'), fullPage: true })
  expect(jsErrors).toEqual([])
})
