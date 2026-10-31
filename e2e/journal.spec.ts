import { expect, test, type Locator, type Page } from '@playwright/test'
import { acceptDisclaimer, choose } from './helpers'

async function openTab(page: Page, name: string) {
  await page.getByRole('link', { name, exact: true }).first().click()
}

/** `when` is a datetime-local value; the default, now, is to the minute, so two quick logs tie. */
async function logWeight(page: Page, value: string, when?: string) {
  await page.getByRole('button', { name: 'Log weight' }).click()
  const dialog = page.getByRole('dialog', { name: 'Weigh-in' })
  await dialog.getByLabel('Weight').fill(value)
  if (when) await dialog.getByLabel('When').fill(when)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Weight logged')).toBeVisible()
  await expect(dialog).toBeHidden()
}

/** A real image, so the canvas re-encode and the blob: previews run as on a phone. */
async function makePng(page: Page): Promise<Buffer> {
  return Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 300
      canvas.height = 400
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#3f6b52'
      ctx.fillRect(0, 0, 300, 400)
      return canvas.toDataURL('image/png').split(',')[1]!
    }),
    'base64',
  )
}

/** Saves a photo from the library, keeping the time the dialog suggests. */
async function addPhoto(page: Page, png: Buffer, name: string) {
  await page
    .locator('input[type="file"][aria-label="Choose a photo"]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: png })
  const dialog = page.getByRole('dialog', { name: 'Progress photo' })
  await expectDecoded(dialog.getByRole('img', { name: 'Your progress photo' }))
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Photo saved')).toBeVisible()
  await expect(dialog).toBeHidden()
}

/** Decoded, not just present: the production CSP must allow the blob: image. */
async function expectDecoded(img: Locator) {
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
    .toBeGreaterThan(0)
}

test.beforeEach(async ({ page }) => {
  // Take the download path on every browser: a share sheet cannot be driven from a test.
  await page.addInitScript(() => {
    delete (navigator as { canShare?: unknown }).canShare
  })
  await page.goto('./')
  await acceptDisclaimer(page)
})

test('logs weight, derives BMI from the profile height, and converts units', async ({ page }) => {
  await openTab(page, 'Journal')
  await logWeight(page, '81.3', '2026-10-01T08:00')
  await expect(page.getByText('Add your height in Settings to see your BMI.')).toBeVisible()

  await openTab(page, 'Settings')
  await page.getByRole('spinbutton', { name: 'Height' }).fill('175')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText('Profile saved', { exact: true })).toBeVisible()
  await choose(page, 'Weight unit', 'Pounds')

  await openTab(page, 'Journal')
  await expect(page.getByTestId('journal-weight')).toHaveText('179.2 lb')
  // 81.3 / 1.75² = 26.5, whatever unit the weight is shown in.
  await expect(page.getByTestId('journal-bmi')).toContainText('26.5')
  await expect(page.getByTestId('journal-bmi')).toContainText('Above the healthy range')

  await logWeight(page, '177', '2026-10-08T08:00')
  await expect(page.getByText(/−2\.2 lb/)).toBeVisible()
  await page.getByRole('tab', { name: /Weights/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: '177 lb' })).toBeVisible()

  await openTab(page, 'Settings')
  await choose(page, 'Weight unit', 'Kilograms')
  await openTab(page, 'Journal')
  await page.getByRole('tab', { name: /Weights/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: '81.3 kg' })).toBeVisible()
})

test('logs side effects and blood sugar, in the units chosen in Settings', async ({ page }) => {
  await openTab(page, 'Journal')
  await page.getByRole('button', { name: 'Log side effect' }).click()
  const effects = page.getByRole('dialog', { name: 'Side effects' })
  await effects.getByRole('button', { name: 'Joint pain' }).click()
  await effects.getByRole('button', { name: 'Nausea' }).click()
  await choose(effects, 'How strong', 'Moderate')
  await effects.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Side effects logged')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Side effects this week' })).toContainText(
    'Joint pain',
  )

  await page.getByRole('button', { name: 'Log blood sugar' }).click()
  const sugar = page.getByRole('dialog', { name: 'Blood sugar' })
  await sugar.getByLabel('HbA1c').fill('7.2')
  await sugar.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Reading logged')).toBeVisible()
  await expect(page.getByText('HbA1c 7.2%').first()).toBeVisible()

  await openTab(page, 'Settings')
  await choose(page, 'HbA1c unit', 'mmol/mol')
  await openTab(page, 'Journal')
  await expect(page.getByText('HbA1c 55 mmol/mol').first()).toBeVisible()

  await page.getByRole('tab', { name: /Side effects/ }).click()
  // The entry's title alone; the week's badge reads "Joint pain × 1".
  await expect(page.getByText('Joint pain', { exact: true })).toBeVisible()
})

test('shares a weight trend as an image without revealing the weight', async ({ page }) => {
  await openTab(page, 'Journal')
  await logWeight(page, '100', '2026-10-01T08:00')
  await logWeight(page, '98', '2026-10-08T08:00')

  await page.getByRole('button', { name: 'Share weight as an image' }).click()
  const share = page.getByRole('dialog', { name: 'Share as an image' })
  await expectDecoded(share.getByRole('img', { name: 'Preview of the image to share' }))
  await expect(share.getByText('Only the percent change is shown.')).toBeVisible()
  const image = page.waitForEvent('download')
  await share.getByRole('button', { name: 'Share' }).click()
  expect((await image).suggestedFilename()).toMatch(/^pepcalc-weight-\d{4}-\d{2}-\d{2}\.png$/)
})

test('saves photos, pins them to the weight line, shares a collage, and backs them up', async ({
  page,
}) => {
  await openTab(page, 'Journal')
  await logWeight(page, '100')
  const png = await makePng(page)
  for (const name of ['one.png', 'two.png', 'three.png']) await addPhoto(page, png, name)
  await expect(page.getByRole('button', { name: /^Front photo from / })).toHaveCount(3)
  await expect(
    page.getByRole('img', { name: /3 progress photos pinned to the line/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Compare' }).click()
  const compare = page.getByRole('dialog', { name: 'Compare' })
  for (const img of await compare.getByRole('img', { name: /^Progress photo from / }).all()) {
    await expectDecoded(img)
  }
  await compare.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Share collage' }).click()
  const collage = page.getByRole('dialog', { name: 'Share a collage' })
  const preview = collage.getByRole('img', { name: 'Preview of the image to share' })
  await expectDecoded(preview)
  await choose(collage, 'Shape', 'Story')
  await expect
    .poll(() =>
      preview.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight].join('x')),
    )
    .toBe('1080x1920')
  const shared = page.waitForEvent('download')
  await collage.getByRole('button', { name: 'Share' }).click()
  expect((await shared).suggestedFilename()).toMatch(/^pepcalc-photos-\d{4}-\d{2}-\d{2}\.png$/)
  await expect(collage).toBeHidden()

  await openTab(page, 'Settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save a backup' }).click()
  const backup = await download
  expect(backup.suggestedFilename()).toMatch(/^pepcalc-backup-\d{4}-\d{2}-\d{2}\.zip$/)

  // Change the data, then restore: the backup's three photos and weigh-in come back.
  await openTab(page, 'Journal')
  await page
    .getByRole('button', { name: /^Front photo from / })
    .first()
    .click()
  const photo = page.getByRole('dialog', { name: 'Progress photo' })
  await photo.getByRole('button', { name: 'Delete photo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Front photo from / })).toHaveCount(2)

  await openTab(page, 'Settings')
  await page.getByLabel('Backup file').setInputFiles((await backup.path())!)
  await page.getByRole('dialog').getByRole('button', { name: 'Restore backup' }).click()
  await expect(page.getByText('Backup restored')).toBeVisible()
  await openTab(page, 'Journal')
  await expect(page.getByRole('button', { name: /^Front photo from / })).toHaveCount(3)
  await expect(page.getByTestId('journal-weight')).toHaveText('100 kg')
})
