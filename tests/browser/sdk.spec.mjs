// SPDX-License-Identifier: MIT
import { expect, test } from '@playwright/test'

for (const path of ['/sdk', '/ru/sdk']) {
  test(`${path} onboarding enters the cloned SDK directory`, async ({ page }) => {
    await page.goto(path)
    const commands = page.locator('pre').filter({ hasText: 'git clone' })
    await expect(commands).toHaveCount(1)
    const text = await commands.innerText()
    const repository = text.match(/git clone \S+\/([^/\s]+)\.git/)[1]
    expect(text).toContain(`\ncd ${repository}\n`)
    expect(text.trim().endsWith('\ntools/perinkpheral')).toBe(true)
  })
}
