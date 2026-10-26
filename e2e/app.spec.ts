import { expect, test, type Page } from '@playwright/test'

async function acceptDisclaimer(page: Page) {
  await page.getByRole('button', { name: 'I understand' }).click()
}

/**
 * The first service worker activates without claiming the page that registered it, so wait for
 * activation and reload once: from then on every request goes through the precache.
 */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

async function choose(page: Page, group: string, value: string) {
  await page
    .getByRole('group', { name: group })
    .getByRole('button', { name: value, exact: true })
    .click()
}

test('calculates the standard check: 5 mg in 2 mL, 250 mcg is 10 units', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await page.locator('.v-select').first().click()
  await page.getByRole('option', { name: /BPC-157/ }).click()
  await choose(page, 'Peptide in vial', '5 mg')
  await choose(page, 'Bacteriostatic water added', '2 mL')
  await choose(page, 'Dose', '250 mcg')
  await expect(page.getByTestId('draw-headline')).toHaveText('10')
  await expect(
    page.locator('.draw-result').getByText('0.1 mL', { exact: true }).first(),
  ).toBeVisible()
})

test('saves a vial, logs a draw and tracks the balance', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  // Semaglutide defaults: 2 mg vial, 3 mL water, 0.25 mg dose.
  await expect(page.getByTestId('draw-headline')).toHaveText('37.5')
  await page.getByRole('button', { name: 'Save vial to shelf' }).click()
  await expect(page.getByText('From your shelf')).toBeVisible()
  await page.getByRole('button', { name: 'Log this draw now' }).click()
  await expect(page.getByText(/Logged 0.25 mg of Semaglutide/)).toBeVisible()

  await page.getByRole('link', { name: 'Open vial' }).click()
  await expect(page.getByText('1.75', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('1 draw')).toBeVisible()
  await expect(page.locator('.pk-chart canvas')).toBeVisible()
})

test('works offline after the first visit, including stored data', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit does not drive service workers reliably; offline is verified on Chromium',
  )
  await page.goto('./')
  await acceptDisclaimer(page)
  await waitForServiceWorker(page)
  await page.getByRole('button', { name: 'Save vial to shelf' }).click()
  await expect(page.getByText('From your shelf')).toBeVisible()

  await context.setOffline(true)
  await page.goto('./#/shelf')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Vials' })).toBeVisible()
  await expect(page.getByText('Semaglutide').first()).toBeVisible()

  // The calculator chunk (with the chart library) must also come from the precache.
  await page.goto('./#/')
  await expect(page.getByTestId('draw-headline')).toHaveText('37.5')
  await context.setOffline(false)
})

test('serves a manifest and service worker scoped to the base path', async ({
  page,
  request,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit does not drive service workers reliably; offline is verified on Chromium',
  )
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/pepcalc/manifest.webmanifest')
  const manifest = await (await request.get(href!)).json()
  expect(manifest.start_url).toBe('/pepcalc/')
  expect(manifest.scope).toBe('/pepcalc/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(new URL(scope).pathname).toBe('/pepcalc/')
})

test('makes no third-party requests', async ({ page }) => {
  const foreign: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== 'localhost') foreign.push(r.url())
  })
  await page.goto('./')
  await acceptDisclaimer(page)
  await page.goto('./#/settings')
  await page.goto('./#/shelf')
  expect(foreign).toEqual([])
})
