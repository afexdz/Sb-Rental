import { test, expect } from '@playwright/test'

// Browser-only fixtures: visual checks never write to the database.
for (const width of [320, 390, 768, 1440]) {
  test(`logo : pages et espaces à ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const path of ['/', '/connexion', '/inscription', '/mon-compte', '/agence', '/admin']) {
      await page.goto('/connexion')
      await page.evaluate(async (path) => {
        const { supabase } = await import('/src/lib/supabase.ts')
        await supabase.auth.signOut({ scope: 'local' })
        if (['/mon-compte', '/agence', '/admin'].includes(path)) {
          const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'brand-preview' }))
          const key = `sb-${new URL(supabase.supabaseUrl).hostname.split('.')[0]}-auth-token`
          localStorage.setItem(key, JSON.stringify({ access_token: `e30.${payload}.preview`, refresh_token: 'preview', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'brand-preview', email: 'preview@example.test' } }))
        }
      }, path)
      await page.route('**/rest/v1/**', route => {
        const url = new URL(route.request().url()), table = url.pathname.split('/').pop()
        let body: unknown = []
        if (table === 'is_admin') body = true
        if (table === 'profiles' && url.searchParams.has('id')) body = { role: path === '/agence' ? 'agency' : 'client', account_status: 'active' }
        if (table === 'agency_requests' && url.searchParams.has('profile_id')) body = [{ status: 'approved', business_name: 'Agence du Littoral' }]
        if (table === 'customer_profiles') body = { id: 'brand-preview', full_name: 'Client aperçu', created_at: '2026-09-01' }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
      })
      await page.goto(path)
      if (path === '/agence') await expect(page.locator('.agency-nav')).toBeVisible()
      if (path === '/admin') {
        await expect(page.locator('.bo-sidebar')).toBeAttached()
        const menu = page.getByRole('button', { name: 'Ouvrir la navigation' })
        if (await menu.isVisible()) {
          await menu.click()
          await expect(page.locator('.bo-sidebar')).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
        }
      }
      await expect(page.locator('.brand-logo img').first()).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      for (const logo of await page.locator('.brand-logo img').all()) {
        if (!await logo.isVisible()) continue
        expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
        const box = (await logo.boundingBox())!
        expect(Math.abs(box.width / box.height - 971 / 512)).toBeLessThan(0.02)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`${path.slice(1) || 'accueil'}-${width}.png`), fullPage: true, animations: 'disabled' })
      await page.unroute('**/rest/v1/**')
    }
  })
}
