import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { money } from '../../src/admin/model'

const config = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
if (new URL(config.API_URL).hostname !== '127.0.0.1') throw new Error('Tests réservés à Supabase local.')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const publicClient = () => createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, options)
const users: string[] = [], vehicles: string[] = [], reservations: string[] = [], payments: string[] = [], conversations: string[] = []
const password = 'Backoffice-test-827!'
test.beforeEach(async ({ page }) => { page.setDefaultTimeout(10000) })
async function user(role: 'client' | 'agency', admin = false) {
  const email = `sb-backoffice-${randomUUID()}@example.test`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, full_name: `Test ${role}` } })
  expect(error).toBeNull(); const id = data.user!.id; users.push(id)
  if (admin) expect((await service.from('app_admins').insert({ email, user_id: id })).error).toBeNull()
  const api = publicClient(); expect((await api.auth.signInWithPassword({ email, password })).error).toBeNull()
  return { id, email, api }
}
async function insert(table: string, payload: Record<string, unknown>, ids: string[]) {
  const { data, error } = await service.from(table).insert(payload).select().single()
  expect(error, JSON.stringify(error)).toBeNull(); ids.push(data.id); return data
}
async function login(page: Page, email: string, path = '/admin') {
  await page.goto(path); await page.getByLabel('E-mail admin').fill(email); await page.getByLabel('Mot de passe', { exact: true }).fill(password); await page.getByRole('button', { name: 'Ouvrir le dashboard' }).click()
  await expect(page.getByRole('navigation', { name: 'Administration', includeHidden: true })).toBeAttached()
}
async function fixture() {
  const admin = await user('client', true), customer = await user('client'), agency = await user('agency'), outsider = await user('client')
  const vehicle = await insert('vehicles', { agency_id: agency.id, brand: 'TEST Peugeot', model: '208', category: 'city', daily_price_cents: 500000, photos: ['/images/coastal-drive.jpg'], year: 2026 }, vehicles)
  await insert('vehicles', { agency_id: agency.id, brand: 'TEST Renault', model: 'Clio', category: 'compact', daily_price_cents: 450000, active: false, availability: 'maintenance' }, vehicles)
  const reservation = await insert('reservations', { reference: `TEST-${randomUUID().slice(0, 8)}`, client_id: customer.id, agency_id: agency.id, vehicle_id: vehicle.id, start_date: '2026-10-01', end_date: '2026-10-21', total_cents: 10000000, status: 'confirmed' }, reservations)
  const pendingReservation = await insert('reservations', { client_id: customer.id, agency_id: agency.id, vehicle_id: vehicle.id, start_date: '2026-11-01', end_date: '2026-11-05', total_cents: 2000000 }, reservations)
  const now = new Date().toISOString()
  const deposit = await insert('payments', { reservation_id: reservation.id, kind: 'deposit', source: 'chargily', chargily_reference: `TEST-CH-${randomUUID()}`, amount_cents: 1000000, commission_cents: 1000000, status: 'confirmed', confirmed_at: now }, payments)
  await insert('payments', { reservation_id: reservation.id, kind: 'balance', source: 'manual', amount_cents: 9000000, status: 'confirmed', confirmed_at: now, refunded_cents: 1000000, refunded_at: now, agency_transferred_cents: 4000000 }, payments)
  await insert('payments', { reservation_id: pendingReservation.id, kind: 'deposit', source: 'manual', amount_cents: 200000 }, payments)
  const conversation = await insert('conversations', { client_id: customer.id, agency_id: agency.id, reservation_id: reservation.id, subject: 'TEST Livraison à Alger' }, conversations)
  expect((await service.from('conversation_messages').insert([{ conversation_id: conversation.id, sender_id: customer.id, body: 'Bonjour, la livraison est-elle possible à Alger ?' }, { conversation_id: conversation.id, sender_id: agency.id, body: 'Oui, nous pouvons convenir du lieu de remise.' }])).error).toBeNull()
  return { admin, customer, agency, outsider, vehicle, reservation, pendingReservation, deposit, conversation }
}
test.afterEach(async () => {
  if (conversations.length) expect((await service.from('conversations').delete().in('id', conversations.splice(0))).error).toBeNull()
  if (payments.length) expect((await service.from('payments').delete().in('id', payments.splice(0))).error).toBeNull()
  if (reservations.length) expect((await service.from('reservations').delete().in('id', reservations.splice(0))).error).toBeNull()
  if (vehicles.length) expect((await service.from('vehicles').delete().in('id', vehicles.splice(0))).error).toBeNull()
  if (users.length) expect((await service.from('admin_audit_logs').delete().in('admin_id', users)).error).toBeNull()
  for (const id of users.splice(0)) expect((await service.auth.admin.deleteUser(id)).error).toBeNull()
})

test('base vide : zéro finance, huit sections, états vides, navigation responsive et accès direct', async ({ page }, info) => {
  const admin = await user('client', true)
  await login(page, admin.email)
  await expect(page.getByRole('heading', { name: 'La plateforme, en un regard.' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Statistiques', exact: true }).locator('article').first().locator('strong')).toHaveText(money(0))
  await page.screenshot({ path: info.outputPath('overview-empty.png'), fullPage: true, animations: 'disabled' })
  await page.route('**/rest/v1/vehicles?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test service indisponible' }) }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Back-office indisponible' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Statistiques', exact: true })).toHaveCount(0)
  await page.unroute('**/rest/v1/vehicles?*')
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'La plateforme, en un regard.' })).toBeVisible()
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Ouvrir la navigation' }).click()
    await expect(page.getByRole('navigation', { name: 'Administration' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Ouvrir la navigation' })).toBeFocused()
  }
  for (const [path, text] of [['vehicules', 'Aucun véhicule enregistré'], ['reservations', 'Aucune réservation enregistrée'], ['finances', 'Aucune transaction enregistrée'], ['messages', 'Aucune conversation enregistrée']]) {
    await page.goto(`/admin/${path}`); await expect(page.getByRole('heading', { name: text })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto('/admin/utilisateurs'); await expect(page.getByRole('heading', { name: 'Utilisateurs', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Quitter', exact: true }).click()
  await page.goto('/admin/finances')
  await expect(page.getByRole('heading', { name: 'Connexion administrateur.' })).toBeVisible()
})

test('données réelles de test : filtres, détails, finances exactes, CSV, messages et journal', async ({ page }, info) => {
  test.setTimeout(90000)
  const f = await fixture()
  const pageErrors: string[] = []; page.on('pageerror', e => pageErrors.push(e.message))
  await login(page, f.admin.email)
  const stats = page.getByRole('region', { name: 'Statistiques', exact: true }).locator('article')
  await expect(stats.nth(0).locator('strong')).toHaveText(money(10000000))
  await expect(stats.nth(1).locator('strong')).toHaveText(money(1000000))
  await page.getByRole('button', { name: 'Semaine', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Semaine', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: info.outputPath('overview.png'), fullPage: true, animations: 'disabled' })
  if (info.project.name === 'desktop') { await page.setViewportSize({ width: 820, height: 1180 }); await page.screenshot({ path: info.outputPath('tablet.png'), fullPage: true, animations: 'disabled' }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.setViewportSize({ width: 1440, height: 1000 }) }
  await page.goto('/admin/utilisateurs')
  await page.getByRole('searchbox').fill(f.customer.email)
  await expect(page.getByRole('row').filter({ hasText: f.customer.email })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Voir le profil' })).toHaveCount(1)
  await page.getByRole('row').filter({ hasText: f.customer.email }).getByRole('link', { name: 'Voir le profil' }).click()
  await expect(page.getByRole('heading', { name: 'Historique des réservations' })).toBeVisible()
  await expect(page.getByRole('link', { name: f.reservation.reference, exact: true })).toBeVisible()
  await page.goto('/admin/vehicules')
  await page.getByRole('searchbox').fill('Renault')
  await expect(page.getByRole('row').filter({ hasText: 'Clio' })).toBeVisible()
  await page.getByRole('searchbox').fill('Peugeot')
  await expect(page.getByRole('row').filter({ hasText: 'Clio' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Consulter' }).click()
  await expect(page.getByRole('heading', { name: 'TEST Peugeot 208' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'TEST Peugeot 208, photo 1' })).toBeVisible()
  await page.goto(`/admin/agences/${f.agency.id}`)
  await expect(page.getByRole('heading', { name: 'Véhicules de l’agence' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Clio' })).toBeVisible()
  await page.goto(`/admin/reservations/${f.reservation.id}`)
  await page.getByRole('combobox', { name: 'Statut', exact: true }).selectOption('deposit_paid')
  await page.getByLabel('Note de suivi').fill('Remise préparée pour le client.')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.locator('.bo-panel-heading .bo-badge')).toHaveText('Acompte payé')
  await page.goto('/admin/finances')
  const finance = page.getByRole('region', { name: 'Statistiques', exact: true }).locator('article')
  await expect(finance.nth(0).locator('strong')).toHaveText(money(10000000))
  await expect(finance.nth(3).locator('strong')).toHaveText(money(4000000))
  await expect(finance.nth(4).locator('strong')).toHaveText(money(200000))
  await expect(finance.nth(5).locator('strong')).toHaveText(money(1000000))
  await page.getByRole('searchbox').fill(f.deposit.chargily_reference)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('sb-rental-transactions.csv')
  const stream = await download.createReadStream(); let exported = ''; for await (const chunk of stream!) exported += chunk.toString()
  expect(exported).toContain(f.deposit.chargily_reference); expect(exported.split('\r\n')).toHaveLength(2)
  await page.getByRole('link', { name: new RegExp(f.deposit.chargily_reference) }).click()
  await page.getByLabel('Note de suivi').fill('Référence vérifiée, aucun montant modifié.')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByLabel('Note de suivi')).toHaveValue('Référence vérifiée, aucun montant modifié.')
  await page.goto('/admin/messages')
  await expect(page.getByRole('row').filter({ hasText: 'TEST Livraison à Alger' })).toBeVisible()
  await page.getByRole('link', { name: 'TEST Livraison à Alger' }).click()
  await expect(page.getByText('Bonjour, la livraison est-elle possible à Alger ?')).toBeVisible()
  await expect.poll(async () => (await f.admin.api.from('conversation_admin_reads').select('*').eq('conversation_id', f.conversation.id)).data?.length).toBe(1)
  await page.goto('/admin/messages')
  await expect(page.getByRole('region', { name: 'Statistiques', exact: true }).locator('article').nth(1).locator('strong')).toHaveText('0')
  await page.goto('/admin/journal')
  await expect(page.getByRole('region', { name: 'Journal administrateur', exact: true }).getByText('Réservation modifiée', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Journal administrateur', exact: true }).getByText('Paiement modifié', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('journal.png'), fullPage: true })
  expect(pageErrors).toEqual([])
})

test('RLS, paiements non falsifiables, transitions et audit non forgeable', async () => {
  const f = await fixture()
  for (const table of ['vehicles', 'reservations', 'payments', 'conversations', 'conversation_messages', 'admin_audit_logs']) {
    expect((await f.outsider.api.from(table).select('*')).data).toEqual([])
    expect((await publicClient().from(table).select('*')).error).toBeTruthy()
  }
  expect((await f.customer.api.from('reservations').select('id')).data?.length).toBe(2)
  expect((await f.admin.api.from('payments').update({ status: 'confirmed' }).eq('id', f.deposit.id)).error).toBeTruthy()
  expect((await f.admin.api.from('payments').insert({ reservation_id: f.reservation.id, kind: 'deposit', source: 'manual', amount_cents: 100 })).error).toBeTruthy()
  expect((await f.admin.api.from('admin_audit_logs').insert({ action: 'fake', entity_type: 'payments', entity_id: f.deposit.id })).error).toBeTruthy()
  expect((await f.outsider.api.rpc('admin_note_payment', { payment_id: f.deposit.id, expected_updated_at: f.deposit.updated_at, note: 'Intrusion' })).error).toBeTruthy()
  expect((await f.admin.api.rpc('admin_update_reservation', { reservation_id: f.pendingReservation.id, expected_status: 'request', next_status: 'completed', note: '' })).error).toBeTruthy()
  expect((await f.admin.api.rpc('admin_update_reservation', { reservation_id: f.pendingReservation.id, expected_status: 'request', next_status: 'confirmed', note: 'Disponibilité vérifiée' })).error).toBeNull()
  expect((await f.admin.api.rpc('admin_update_reservation', { reservation_id: f.pendingReservation.id, expected_status: 'confirmed', next_status: 'deposit_paid', note: '' })).error).toBeTruthy()
  expect((await f.admin.api.rpc('admin_update_reservation', { reservation_id: f.pendingReservation.id, expected_status: 'request', next_status: 'confirmed', note: 'Écriture périmée' })).error).toBeTruthy()
  const audit = await f.admin.api.from('admin_audit_logs').select('*').eq('entity_id', f.pendingReservation.id)
  expect(audit.data).toHaveLength(1); expect(audit.data![0].admin_id).toBe(f.admin.id); expect(audit.data![0].after_data.status).toBe('confirmed')
  expect((await f.admin.api.from('admin_audit_logs').delete().eq('id', audit.data![0].id)).error).toBeTruthy()
  // Cap the sum of confirmations, including simultaneous retry/import protection.
  expect((await service.from('payments').insert({ reservation_id: f.reservation.id, kind: 'balance', source: 'manual', amount_cents: 1, status: 'confirmed', confirmed_at: new Date().toISOString() })).error).toBeTruthy()
})
