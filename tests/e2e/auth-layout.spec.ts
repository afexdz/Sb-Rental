import { test, expect } from '@playwright/test'

for (const route of ['connexion', 'inscription']) {
  test(`${route} : alignement, dimensions et ordre responsive`, async ({ page }, info) => {
    const widths = info.project.name === 'mobile' ? [320, 390] : [768, 1440]
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/${route}`)
      const primary = page.getByRole('button', { name: route === 'connexion' ? 'Me connecter' : 'Créer mon compte', exact: true })
      await expect(primary).toBeEnabled()
      await page.evaluate(() => document.fonts.ready)
      const google = page.getByRole('button', { name: 'Continuer avec Google', exact: true })
      const a = (await primary.boundingBox())!, b = (await google.boundingBox())!
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1)
      expect(b.y - a.y - a.height).toBeGreaterThanOrEqual(12)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const panel = (await page.locator('.account-panel').boundingBox())!
      const story = (await page.locator('.account-story').boundingBox())!
      const footer = (await page.locator('.account-footer').boundingBox())!
      if (width <= 900) expect(panel.y).toBeGreaterThanOrEqual(story.y + story.height + 20)
      expect(footer.y).toBeGreaterThanOrEqual(panel.y + panel.height)
      await expect(page.locator('.account-panel h1')).toHaveCSS('text-align', 'center')
      await page.screenshot({ path: info.outputPath(`${route}-${width}.png`), fullPage: true })
      if (route === 'inscription') {
        const roles = page.locator('.role-card')
        const client = (await roles.nth(0).boundingBox())!, agency = (await roles.nth(1).boundingBox())!
        expect(Math.abs(client.width - agency.width)).toBeLessThanOrEqual(1)
        expect(Math.abs(client.height - agency.height)).toBeLessThanOrEqual(1)
        expect(agency.x - client.x - client.width).toBeGreaterThanOrEqual(10)
        await roles.nth(1).click()
        await expect(page.locator('#rcFile')).toHaveAttribute('required', '')
        await expect(page.locator('#passport')).toHaveCount(0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.screenshot({ path: info.outputPath(`agence-${width}.png`), fullPage: true })
      }
    }
  })
}
