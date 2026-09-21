import { test, expect } from '@playwright/test'
import { localDate } from '../../src/lib/search'

test('catalogue : 24 modèles, photos locales chargées et catégories sur ordinateur et mobile', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.vehicle-card')).toHaveCount(24)
  for (const name of ['Peugeot 208', 'Volkswagen Golf 8', 'Hyundai Tucson']) {
    await expect(page.locator('.vehicle-card').getByRole('heading', { name, exact: true })).toBeVisible()
  }
  const images = await page.locator('.vehicle-card img').evaluateAll(async elements => Promise.all(elements.map(async element => {
    const image = element as HTMLImageElement
    image.loading = 'eager'
    await image.decode()
    return { path: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight }
  })))
  expect(new Set(images.map(image => image.path)).size).toBe(24)
  expect(images.every(image => image.path.startsWith('/images/vehicles/') && image.width >= 640 && image.height >= 300)).toBe(true)
  const filters = page.getByRole('group', { name: 'Catégorie de véhicule' })
  for (const [name, count] of [['Citadines', 7], ['Compactes', 5], ['SUV & 4×4', 7], ['Berlines', 5], ['Tous les véhicules', 24]] as const) {
    await filters.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('.vehicle-card')).toHaveCount(count)
  }
  await page.locator('#vehicules').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('catalogue.png'), animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  if (info.project.name === 'desktop') {
    await page.setContent(`<html lang="fr"><style>body{margin:20px;font:14px sans-serif;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0}img{width:100%;height:170px;object-fit:contain;background:#eee}figcaption{padding:6px}</style>${images.map(image => `<figure><img src="${image.path}"><figcaption>${image.path.split('/').at(-1)}</figcaption></figure>`).join('')}</html>`)
    await page.locator('img').evaluateAll(elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())))
    await page.screenshot({ path: info.outputPath('photos-planche.png'), fullPage: true })
  }
})

test('recherche : ville, dates, estimation, fiche créditée et résultat vide', async ({ page }, info) => {
  const start = localDate(new Date(Date.now() + 7 * 86400000))
  const end = localDate(new Date(Date.now() + 10 * 86400000))
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET' && /\/rest\/v1\/(reservations|payments)/.test(request.url())) writes.push(request.url()) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Trouver ma voiture' }).click()
  await expect(page.getByRole('alert')).toHaveText('Choisissez une ville de départ.')
  await page.getByLabel('Ville de départ').selectOption('Alger')
  await page.getByLabel('Date de départ', { exact: true }).fill(start)
  await page.getByLabel('Date de retour', { exact: true }).fill(start)
  await page.getByRole('button', { name: 'Trouver ma voiture' }).click()
  await expect(page.getByRole('alert')).toHaveText('Le retour doit être au moins un jour après le départ.')
  await page.getByLabel('Date de retour', { exact: true }).fill(end)
  await page.getByRole('button', { name: 'Trouver ma voiture' }).click()
  await expect(page.locator('.vehicle-card')).toHaveCount(6)
  await page.reload()
  await expect(page.locator('.vehicle-card')).toHaveCount(6)
  await page.getByRole('button', { name: 'Découvrir Peugeot 208', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Estimation pour 3 jours')).toBeVisible()
  await expect(dialog.locator('.estimate strong')).toHaveText(/19\s?500 DA/)
  await expect(dialog.locator('.photo-credit a').first()).toHaveAttribute('href', /^https:\/\/commons.wikimedia.org\//)
  await expect(dialog.getByText(/Disponibilité : à confirmer/)).toBeVisible()
  await page.screenshot({ path: info.outputPath('vehicle-detail.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Fermer la fiche' }).click()
  await page.getByLabel('Ville de départ').selectOption('Tlemcen')
  await page.getByRole('button', { name: 'Trouver ma voiture' }).click()
  await page.getByRole('button', { name: 'Compactes', exact: true }).click()
  await expect(page.locator('.vehicle-card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'D’autres horizons vous attendent.' })).toBeVisible()
  await page.getByRole('button', { name: 'Voir tous les véhicules', exact: true }).click()
  await expect(page.locator('.vehicle-card')).toHaveCount(24)
  expect(writes).toEqual([])
})
