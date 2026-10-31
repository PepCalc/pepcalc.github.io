import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Accept the first-run notice. The dialog closes only once the acceptance is on disk, so its
 * button disappearing is the point after which a reload keeps it accepted.
 */
export async function acceptDisclaimer(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'For research and education only' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: "I'm 18 or older and understand" }).click()
  await expect(page.getByRole('button', { name: "I'm 18 or older and understand" })).toBeHidden()
}

/** Press the button named `value` in the toggle group named `group`. */
export async function choose(page: Page | Locator, group: string, value: string) {
  await page
    .getByRole('group', { name: group })
    .getByRole('button', { name: value, exact: true })
    .click()
}
