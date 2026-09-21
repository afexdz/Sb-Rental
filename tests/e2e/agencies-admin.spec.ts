import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

// Local-only fixtures. Privileged credentials never enter the browser.
const config = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
if (new URL(config.API_URL).hostname !== '127.0.0.1') throw new Error('Supabase local requis.')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const client = () => createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, options)
const created = new Set<string>()
const password = 'Test-agence-823!'
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
const file = { name: 'registre.png', mimeType: 'image/png', buffer: image }
const uniqueEmail = () => `sb-agency-${randomUUID()}@example.test`

async function account(role: 'client' | 'agency' = 'agency', admin = false) {
  const email = uniqueEmail()
  const api = client()
  const { data, error } = await api.auth.signUp({ email, password, options: { data: { full_name: 'Responsable Test', role } } })
  expect(error).toBeNull()
  created.add(data.user!.id)
  if (admin) expect((await service.from('app_admins').insert({ email, user_id: data.user!.id })).error).toBeNull()
  return { api, id: data.user!.id, email }
}
async function sendRequest(agency: Awaited<ReturnType<typeof account>>, businessName: string) {
  const path = `${agency.id}/${randomUUID()}.png`
  expect((await agency.api.storage.from('agency-documents').upload(path, image, { contentType: 'image/png' })).error).toBeNull()
  const request = { profile_id: agency.id, business_name: businessName, rc_number: 'RC-2026', document_path: path }
  expect((await agency.api.from('agency_requests').insert(request)).error).toBeNull()
  return request
}
async function fillAgency(page: Page, email: string, businessName: string) {
  await page.goto('/inscription')
  await page.getByRole('button', { name: 'Agence Je propose mes véhicules' }).click()
  await page.getByLabel('Nom complet du responsable', { exact: true }).fill('Responsable Test')
  await page.getByLabel('Nom de l’agence', { exact: true }).fill(businessName)
  await page.getByLabel('Numéro du registre de commerce', { exact: true }).fill('RC-2026')
  await page.locator('#rcFile').setInputFiles(file)
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password)
}
async function submitSignup(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith('/auth/v1/signup') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Envoyer ma demande', exact: true }).click()
  const payload = await (await response).json()
  if (payload.user?.id) created.add(payload.user.id)
  return payload.user?.id as string
}
async function adminLogin(page: Page, email: string) {
  await page.goto('/admin')
  await page.getByLabel('E-mail admin').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Ouvrir le dashboard' }).click()
}
test.afterEach(async () => {
  for (const id of created) {
    const agency = await service.from('agency_requests').select('id').eq('profile_id', id)
    if (agency.data?.length) await service.from('admin_audit_logs').delete().in('entity_id', agency.data.map(a => a.id))
    const { data, error } = await service.storage.from('agency-documents').list(id)
    expect(error).toBeNull()
    if (data?.length) expect((await service.storage.from('agency-documents').remove(data.map(f => `${id}/${f.name}`))).error).toBeNull()
    expect((await service.auth.admin.deleteUser(id)).error).toBeNull()
  }
  created.clear()
})

test('registre réel, statistiques, annuaire, approbation et refus dans /admin', async ({ page }, info) => {
  const admin = await account('client', true)
  const second = await account()
  await sendRequest(second, 'Agence à refuser')
  const email = uniqueEmail()
  await fillAgency(page, email, 'Agence à approuver')
  await page.screenshot({ path: info.outputPath('inscription-agence.png'), fullPage: true })
  const agencyId = await submitSignup(page)
  await expect(page.getByText('Votre demande est envoyée.', { exact: false })).toBeVisible()
  const request = await service.from('agency_requests').select('*').eq('profile_id', agencyId).single()
  expect(request.error).toBeNull(); expect(request.data.status).toBe('pending')
  expect((await service.storage.from('agency-documents').download(request.data.document_path)).error).toBeNull()
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  await expect(page.getByText('Votre demande agence est encore en cours de vérification.')).toBeVisible()
  await adminLogin(page, admin.email)
  await expect(page.getByRole('heading', { name: 'La plateforme, en un regard.' })).toBeVisible()
  await page.goto('/admin/utilisateurs')
  const users = await service.from('profiles').select('id', { count: 'exact', head: true })
  await expect(page.getByText(`${users.count} comptes enregistrés`, { exact: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: admin.email })).toBeVisible()
  await page.screenshot({ path: info.outputPath('admin.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto('/admin/agences')
  const approvalRow = page.getByRole('row').filter({ hasText: 'Agence à approuver' })
  const popupPromise = page.waitForEvent('popup')
  await approvalRow.getByRole('button', { name: 'Voir le fichier' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/storage\/v1\/object\/sign\/agency-documents\//)
  expect((await page.request.get(popup.url())).status()).toBe(200)
  await popup.close()
  await approvalRow.getByRole('link', { name: 'Examiner le dossier' }).click()
  await page.getByRole('button', { name: 'Demander une correction', exact: true }).click()
  await page.getByLabel('Motif / note').fill('Merci de fournir un registre plus lisible.')
  await page.getByRole('button', { name: 'Enregistrer la décision' }).click()
  await expect(page.getByText('À corriger', { exact: true })).toBeVisible()
  const correction = await service.from('admin_audit_logs').select('action,admin_id').eq('entity_id', request.data.id)
  expect(correction.data).toEqual([expect.objectContaining({ action: 'agency.needs_changes', admin_id: admin.id })])
  await page.getByRole('button', { name: 'Approuver', exact: true }).click()
  await page.getByRole('button', { name: 'Enregistrer la décision' }).click()
  await expect(page.getByText('Approuvée', { exact: true })).toBeVisible()
  await page.goto('/admin/agences')
  const rejectRow = page.getByRole('row').filter({ hasText: 'Agence à refuser' })
  await rejectRow.getByRole('link', { name: 'Examiner le dossier' }).click()
  await page.getByRole('button', { name: 'Refuser', exact: true }).click()
  await page.getByLabel('Motif / note').fill('Document de test non conforme')
  await page.getByRole('button', { name: 'Enregistrer la décision' }).click()
  await expect(page.getByText('Refusée', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Quitter', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Connexion administrateur.' })).toBeVisible()
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/mon-compte$/)
  await expect(page.getByRole('heading', { name: 'Responsable Test' })).toBeVisible()
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Statistiques' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click()
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(second.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  await expect(page.getByText('Votre demande agence a été refusée. Contactez notre équipe pour la corriger.')).toBeVisible()
})

test('échec du registre : reprise après actualisation sans recréer le compte ni doubler le fichier', async ({ page }) => {
  let uploads = 0
  await page.route('**/storage/v1/object/agency-documents/**', route => {
    if (route.request().method() !== 'POST') return route.continue()
    uploads++
    return uploads === 1 ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"unavailable"}' }) : route.continue()
  })
  await fillAgency(page, uniqueEmail(), 'Agence reprise')
  const id = await submitSignup(page)
  await expect(page.getByRole('alert')).toContainText('le registre n’a pas été envoyé')
  await page.reload()
  await expect(page).toHaveURL(/\/mon-compte$/)
  await page.getByRole('link', { name: 'Compléter mon dossier' }).click()
  await expect(page.getByText('Votre compte agence est créé. Complétez l’envoi du registre ci-dessous.')).toBeVisible()
  await page.getByLabel('Nom de l’agence', { exact: true }).fill('Agence reprise')
  await page.getByLabel('Numéro du registre de commerce', { exact: true }).fill('RC-2026')
  await page.locator('#rcFile').setInputFiles(file)
  let insertAttempts = 0
  await page.route('**/rest/v1/agency_requests*', route => {
    if (route.request().method() !== 'POST') return route.continue()
    insertAttempts++
    return insertAttempts === 1 ? route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"unavailable"}' }) : route.continue()
  })
  await page.getByRole('button', { name: 'Envoyer ma demande', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('la demande n’a pas pu être enregistrée')
  await page.getByRole('button', { name: 'Envoyer ma demande', exact: true }).click()
  await expect(page.getByText('Votre demande est envoyée.', { exact: false })).toBeVisible()
  expect(uploads).toBe(2)
  expect(created.size).toBe(1)
  const request = await service.from('agency_requests').select('status').eq('profile_id', id).single()
  expect(request.data?.status).toBe('pending')
})

test('droits réels : aucun auto-admin, aucune auto-approbation, documents privés et annuaire synchronisé', async () => {
  const a = await account(), b = await account(), regular = await account('client')
  // Merely listing an email cannot turn public signup into admin provisioning.
  expect((await service.from('app_admins').insert({ email: a.email })).error).toBeNull()
  try {
    expect((await a.api.rpc('is_admin')).data).toBe(false)
    expect((await a.api.from('app_admins').update({ user_id: a.id }).eq('email', a.email)).error).toBeTruthy()
    expect((await a.api.from('profiles').select('*')).data?.map(p => p.id)).toEqual([a.id])
    const request = await sendRequest(a, 'Agence A')
    const fake = { ...request, profile_id: b.id }
    expect((await b.api.from('agency_requests').insert({ ...fake, status: 'approved' })).error).toBeTruthy()
    expect((await b.api.from('agency_requests').insert(fake)).error).toBeTruthy()
    expect((await b.api.from('agency_requests').insert({ ...fake, document_path: `${b.id}/missing.pdf` })).error).toBeTruthy()
    expect((await a.api.from('agency_requests').update({ status: 'approved' }).eq('profile_id', a.id).select()).error).toBeTruthy()
    expect((await a.api.from('agency_requests').select('status').single()).data?.status).toBe('pending')
    expect((await b.api.storage.from('agency-documents').download(request.document_path)).error).toBeTruthy()
    expect((await client().storage.from('agency-documents').download(request.document_path)).error).toBeTruthy()
    expect((await regular.api.storage.from('agency-documents').upload(`${regular.id}/rc.png`, image, { contentType: 'image/png' })).error).toBeTruthy()
    expect((await a.api.auth.updateUser({ data: { role: 'client' } })).error).toBeNull()
    expect((await a.api.from('profiles').select('role').single()).data?.role).toBe('agency')
    expect((await regular.api.from('customer_profiles').update({ full_name: 'Nom synchronisé' }).eq('id', regular.id)).error).toBeNull()
    expect((await regular.api.from('profiles').select('full_name').single()).data?.full_name).toBe('Nom synchronisé')
  } finally { expect((await service.from('app_admins').delete().eq('email', a.email)).error).toBeNull() }
})
