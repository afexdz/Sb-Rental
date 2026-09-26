import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Admin credentials are held by the Node test runner only, never passed to a page.
// Cleanup is restricted to IDs created by this test run.
const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
const url: string = status.API_URL
if (new URL(url).hostname !== '127.0.0.1') throw new Error('Tests autorisés uniquement sur Supabase local.')
const key: string = status.PUBLISHABLE_KEY || status.ANON_KEY
const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const created: string[] = []
const password = 'SB-Rental-test-482!'
function email() { return `sb-e2e-${randomUUID()}@example.test` }
function client() { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) }
async function createAccount() {
  const api = client()
  const { data, error } = await api.auth.signUp({ email: email(), password, options: { data: { full_name: 'Client API' } } })
  expect(error).toBeNull(); expect(data.user).toBeTruthy()
  created.push(data.user!.id)
  return { api, id: data.user!.id, session: data.session! }
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}
test.afterEach(async () => {
  if (process.env.SB_E2E_ALLOW_CLEANUP !== '1') return
  for (const id of created.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id)
    expect(error).toBeNull()
  }
})

test('inscription : boutons email et Google séparés, alignés et sans débordement', async ({ page }) => {
  await page.goto('/inscription')
  const emailButton = page.getByRole('button', { name: 'Créer mon compte', exact: true })
  const googleButton = page.getByRole('button', { name: 'Continuer avec Google', exact: true })
  const emailBox = await emailButton.boundingBox()
  const googleBox = await googleButton.boundingBox()
  expect(emailBox).not.toBeNull()
  expect(googleBox).not.toBeNull()
  expect(Math.abs(emailBox!.width - googleBox!.width)).toBeLessThanOrEqual(1)
  expect(googleBox!.y).toBeGreaterThanOrEqual(emailBox!.y + emailBox!.height + 12)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Agence', exact: false }).click()
  await expect(page.getByText('Registre de commerce', { exact: true })).toBeVisible()
  await expect(page.locator('#rcFile')).toHaveAttribute('required', '')
  await expect(page.getByText('Téléversez votre passeport')).toHaveCount(0)
})

test('parcours réel : inscription, profil, actualisation, déconnexion et reconnexion', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  const address = email()
  await page.goto('/inscription')
  await page.getByLabel('Nom complet', { exact: true }).fill('Amine Test')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(address)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password)
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('inscription.png'), fullPage: true })
  const signupResponse = page.waitForResponse(r => r.url().endsWith('/auth/v1/signup') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click()
  const payload = await (await signupResponse).json()
  if (payload.user?.id) created.push(payload.user.id)
  await expect(page).toHaveURL(/\/mon-compte$/)
  await expect(page.getByRole('heading', { name: 'Vérification de votre profil' })).toBeVisible()
  await expect(page.getByLabel('Téléversez votre passeport')).toHaveAttribute('required', '')
  await expect(page.getByRole('heading', { name: 'Amine Test' })).toBeVisible()
  await expect(page.getByText(address, { exact: true })).toBeVisible()
  await page.getByLabel('Nom complet', { exact: true }).fill('Amine Modifié')
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await expect(page.getByRole('status')).toContainText('bien été enregistré')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Amine Modifié' })).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('mon-compte.png'), fullPage: true })
  // Two tabs share session changes, including logout.
  const otherTab = await page.context().newPage()
  await otherTab.goto('/mon-compte')
  await expect(otherTab.getByText(address, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Me déconnecter', exact: true }).click()
  await expect(page).toHaveURL(/\/connexion$/)
  await expect(otherTab).toHaveURL(/\/connexion$/)
  await expect(page.getByText('Vous êtes bien déconnecté.')).toBeVisible()
  await otherTab.close()
  await page.goto('/mon-compte')
  await expect(page).toHaveURL(/\/connexion$/)
  await expect(page.getByText('Connectez-vous pour accéder à votre compte.')).toBeVisible()
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(address)
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe')
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.')
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/mon-compte$/)
  await expect(page.getByRole('heading', { name: 'Amine Modifié' })).toBeVisible()
  await page.getByRole('button', { name: 'Me déconnecter', exact: true }).click()
  await page.reload()
  await expect(page).toHaveURL(/\/connexion$/)
  await page.screenshot({ path: info.outputPath('connexion.png'), fullPage: true })
  await page.goto('/inscription')
  await page.getByLabel('Nom complet', { exact: true }).fill('Doublon')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(address)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Impossible de créer ce compte avec ces informations. Vérifiez l’adresse e-mail ou utilisez la connexion.')
  expect(errors).toEqual([])
})

test('formulaires, navigation et chargement, sans requête pour les données invalides', async ({ page }, info) => {
  let requests = 0
  page.on('request', req => { if (req.url().includes('/auth/v1/signup')) requests++ })
  await page.goto('/inscription')
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click()
  await expect(page.getByText('Indiquez votre nom complet.')).toBeVisible()
  await expect(page.getByLabel('Nom complet', { exact: true })).toBeFocused()
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('pas-un-email')
  await page.getByLabel('Mot de passe', { exact: true }).fill('court')
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill('different')
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click()
  await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible()
  await expect(page.getByText('Utilisez au moins 8 caractères.')).toBeVisible()
  await expect(page.getByText('Les mots de passe doivent être identiques.')).toBeVisible()
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Afficher le mot de passe', exact: true }).click()
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute('type', 'text')
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('erreurs.png'), fullPage: true })
  await page.getByRole('link', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Heureux de vous retrouver.' })).toBeVisible()
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(email())
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/auth/v1/token**', async route => { await gate; await route.abort() })
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  try { await expect(page.getByRole('button', { name: 'Connexion…', exact: true })).toBeDisabled() }
  finally { release() }
  await expect(page.getByRole('alert')).toContainText('Impossible de joindre', { timeout: 25000 })
  await expect(page.getByRole('button', { name: 'Me connecter', exact: true })).toBeEnabled()
  await page.unrouteAll({ behavior: 'wait' })
  await page.goto('/')
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await page.getByRole('link', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/\/connexion$/)
})

test('RLS : isolation de deux clients, visiteurs, écritures et jetons invalides', async ({ request }) => {
  const a = await createAccount(), b = await createAccount()
  const own = await a.api.from('customer_profiles').select('*')
  expect(own.error).toBeNull(); expect(own.data?.map(p => p.id)).toEqual([a.id])
  const other = await a.api.from('customer_profiles').select('*').eq('id', b.id)
  expect(other.data).toEqual([])
  const write = await a.api.from('customer_profiles').update({ full_name: 'Intrusion' }).eq('id', b.id).select()
  expect(write.data).toEqual([])
  expect((await b.api.from('customer_profiles').select('full_name').single()).data?.full_name).toBe('Client API')
  expect((await a.api.from('customer_profiles').update({ id: b.id }).eq('id', a.id)).error).toBeTruthy()
  expect((await a.api.from('customer_profiles').update({ created_at: '2000-01-01' }).eq('id', a.id)).error).toBeTruthy()
  expect((await a.api.from('customer_profiles').insert({ id: randomUUID(), full_name: 'Intrusion' })).error).toBeTruthy()
  expect((await a.api.from('customer_profiles').delete().eq('id', b.id)).error).toBeTruthy()
  const guest = client()
  expect((await guest.from('customer_profiles').select('*')).error).toBeTruthy()
  expect((await guest.from('customer_profiles').update({ full_name: 'Intrusion' }).eq('id', a.id)).error).toBeTruthy()
  const invalid = await request.get(`${url}/rest/v1/customer_profiles`, { headers: { apikey: key, Authorization: 'Bearer invalid' } })
  expect(invalid.status()).toBe(401)
  const refreshed = await a.api.auth.refreshSession()
  expect(refreshed.error).toBeNull(); expect(refreshed.data.session).toBeTruthy()
  expect((await a.api.from('customer_profiles').select('*')).data?.map(p => p.id)).toEqual([a.id])
  expect((await a.api.auth.signOut({ scope: 'local' })).error).toBeNull()
  expect((await a.api.from('customer_profiles').select('*')).error).toBeTruthy()
  const revoked = await client().auth.refreshSession({ refresh_token: refreshed.data.session!.refresh_token })
  expect(revoked.error).toBeTruthy()
})

test('profil indisponible : erreur, réessai et déconnexion restent utilisables', async ({ page }) => {
  const a = await createAccount()
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(a.session.user.email!)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.route('**/rest/v1/customer_profiles**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"unavailable"}' }))
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Impossible de charger votre profil', { timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Me déconnecter', exact: true })).toBeEnabled()
  await page.unrouteAll()
  await page.getByRole('button', { name: 'Réessayer' }).click()
  await expect(page.getByRole('heading', { name: 'Client API' })).toBeVisible()
  await page.getByRole('button', { name: 'Me déconnecter', exact: true }).click()
  await expect(page).toHaveURL(/\/connexion$/)
})
