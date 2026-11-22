// SPDX-License-Identifier: MIT
import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { fixture } from '../helpers/flashFixtures.mjs'

const release = { version: '0.1.35', date: '', notes: '', builds: { release: '0.1.35/manifest.json' } }
const resets = ['bootloader', 'DTR:false', 'RTS:true', 'RTS:false', 'disconnect']

async function serial(page, gate) {
  page.on('pageerror', (error) => { throw error })
  await page.addInitScript(gate => {
    window.serialCalls = []
    Object.defineProperty(navigator, 'serial', { value: { requestPort: async () => ({}) } })
    if (gate === undefined) return
    const wait = () => new Promise(resolve => { window.continueMonitor = resolve })
    const port = {
      async open() {
        window.serialCalls.push('open')
        if (gate === 'open') await wait()
      },
      async close() { window.serialCalls.push('close') },
      async setSignals() {
        window.serialCalls.push('signals')
        if (gate === 'reset') await wait()
      },
      readable: {
        getReader() {
          window.serialCalls.push('reader')
          return {
            read: () => new Promise(resolve => {
              window.cancelRead = () => resolve({ done: true })
              window.writeMonitor = text => resolve({ value: new TextEncoder().encode(text), done: false })
            }),
            cancel: async () => window.cancelRead(),
            releaseLock() { window.serialCalls.push('releaseLock') },
          }
        },
      },
    }
    navigator.serial.requestPort = async () => {
      window.serialCalls.push('request')
      if (gate === 'request') await wait()
      if (gate === 'cancel') throw new DOMException('Cancelled', 'NotFoundError')
      if (gate === 'failure') throw new Error('Port unavailable')
      return { ...port }
    }
  }, gate)
  // Only fake transport is ever loaded: tests cannot request real hardware.
  await page.route('**/esptool-js.js*', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    export class Transport {
      async disconnect() { window.serialCalls.push('disconnect') }
      async setDTR(value) { window.serialCalls.push('DTR:' + value) }
      async setRTS(value) { window.serialCalls.push('RTS:' + value) }
    }
    export class ESPLoader {
      chip = { CHIP_NAME: 'ESP32-C6', readMac: async () => 'aa:bb:cc:dd:ee:ff' }
      async main() { window.serialCalls.push('bootloader') }
      async writeFlash(options) {
        window.serialCalls.push('write:start')
        await new Promise(resolve => { window.finishWrite = resolve })
        if (window.failWrite) throw new Error('USB disconnected during write')
        const expected = ${JSON.stringify(fixture('fresh').files.map(file => createHash('md5').update(file.data).digest('hex')))}
        for (const [index, file] of options.fileArray.entries()) {
          if (options.calculateMD5Hash) {
            if (options.calculateMD5Hash(file.data) !== expected[index] || window.failVerification === index)
              throw new Error('MD5 of file does not match data in flash!')
          } else {
            throw new Error('Missing flash verification callback')
          }
        }
        window.serialCalls.push('write:end')
      }
    }
  ` }))
  await page.route('https://perinkpheral.github.io/perinkpheral-os/flash/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('index.json')) return route.fulfill({ json: [release] })
    const data = fixture('fresh')
    if (path.endsWith('manifest.json')) return route.fulfill({ json: data.manifest })
    const part = data.parts.findIndex((part) => path.endsWith('/' + part.path))
    if (part < 0) return route.abort()
    return route.fulfill({ body: Buffer.from(data.files[part].data) })
  })
}

async function connect(page) {
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByText('aa:bb:cc:dd:ee:ff')).toBeVisible()
}

test('a cold esptool import cannot delay the port chooser past user activation', async ({ page }) => {
  await serial(page)
  let finishImport
  const imported = new Promise(resolve => { finishImport = resolve })
  await page.route('**/esptool-js.js*', async route => {
    await imported
    await route.fallback()
  })
  await page.goto('/flash')
  await page.evaluate(() => {
    navigator.serial.requestPort = async () => {
      if (!navigator.userActivation.isActive) throw new DOMException('User activation required', 'SecurityError')
      window.serialCalls.push('request')
      return {}
    }
  })
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  try {
    // The chooser must already have run while the import is still blocked.
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['request'])
    await page.waitForFunction(() => !navigator.userActivation.isActive)
  } finally {
    finishImport()
  }
  await expect(page.getByText('aa:bb:cc:dd:ee:ff')).toBeVisible()
  expect(await page.evaluate(() => window.serialCalls)).toEqual(['request', 'bootloader'])
})

test('cancelling Connect restores controls without loading esptool', async ({ page }) => {
  await serial(page, 'cancel')
  let imports = 0
  await page.route('**/esptool-js.js*', route => { imports++; return route.fallback() })
  await page.goto('/flash')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => window.serialCalls)).toEqual(['request'])
  expect(imports).toBe(0)
  await expect(page.getByText('The board does not answer.')).toHaveCount(0)
})

for (const way of ['next', 'back', 'language']) {
  test(`leaving a connected board via ${way} restarts before disconnecting`, async ({ page }) => {
    await serial(page)
    await page.goto('/start')
    await page.getByRole('link', { name: /Flash/ }).first().click()
    await expect(page).toHaveURL(/\/flash$/)
    await connect(page)
    if (way === 'next') await page.getByRole('link', { name: /Set up the device/ }).click()
    if (way === 'back') await page.goBack()
    if (way === 'language') await page.getByRole('button', { name: 'Русский', exact: true }).first().click()
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(resets)
    await expect(page).toHaveURL(way === 'next' ? /\/setup$/ : way === 'back' ? /\/start$/ : /\/ru\/flash$/)
    if (way === 'language') await expect(page.getByRole('button', { name: 'Подключить', exact: true })).toBeVisible()
  })
}

test('navigation and tab close cannot interrupt writing; successful completion resets once', async ({ page }) => {
  await serial(page)
  await page.goto('/start')
  await page.getByRole('link', { name: /Flash/ }).first().click()
  await connect(page)
  await page.getByRole('combobox', { name: 'Install', exact: true }).selectOption('fresh')
  await page.getByRole('button', { name: 'Install', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['bootloader', 'write:start'])
  await page.getByRole('link', { name: 'Firmware', exact: true }).first().click()
  await expect(page.getByRole('alert')).toContainText('Wait for the operation')
  await expect(page).toHaveURL(/\/flash$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/flash$/)
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['bootloader', 'write:start'])
  // A reload or closing the tab is outside router control and needs a browser prompt.
  const dialog = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  await (await dialog).dismiss()
  expect(await page.evaluate(() => window.serialCalls)).toEqual(['bootloader', 'write:start'])
  await page.evaluate(() => window.finishWrite())
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual([
    'bootloader', 'write:start', 'write:end', ...resets.slice(1),
  ])
  await page.getByRole('link', { name: 'Firmware', exact: true }).first().click()
  await expect(page).toHaveURL(/\/firmware$/)
})

test('failed writing releases the port without attempting to boot an incomplete image', async ({ page }) => {
  await serial(page)
  await page.goto('/flash')
  await connect(page)
  await page.getByRole('combobox', { name: 'Install', exact: true }).selectOption('fresh')
  await page.getByRole('button', { name: 'Install', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['bootloader', 'write:start'])
  await page.evaluate(() => { window.failWrite = true; window.finishWrite() })
  await expect(page.getByText('Writing stopped. Connect again.')).toBeVisible()
  expect(await page.evaluate(() => window.serialCalls)).toEqual(['bootloader', 'write:start', 'disconnect'])
})

for (const [name, index] of [['bootloader', 0], ['recovery', 3], ['main', 4]]) {
  test(`${name} flash MD5 mismatch prevents success and reset`, async ({ page }) => {
    await serial(page)
    await page.goto('/flash')
    await connect(page)
    await page.getByRole('combobox', { name: 'Install', exact: true }).selectOption('fresh')
    await page.getByRole('button', { name: 'Install', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['bootloader', 'write:start'])
    await page.evaluate(index => { window.failVerification = index; window.finishWrite() }, index)
    await expect(page.getByText('The written data did not verify. Connect again and reinstall.')).toBeVisible()
    expect(await page.evaluate(() => window.serialCalls)).toEqual(['bootloader', 'write:start', 'disconnect'])
    await expect(page.getByText(/^Installed\./)).toHaveCount(0)
  })

  for (const defect of ['truncated', 'corrupt SHA']) {
    test(`${name} ${defect} prevents even a fresh erase or write`, async ({ page }) => {
      await serial(page)
      const f = fixture('fresh')
      const raw = f.files[index].data
      if (defect === 'corrupt SHA') raw[raw.length - 1] ^= 1
      await page.route('**/' + f.parts[index].path, route => route.fulfill({
        body: Buffer.from(defect === 'truncated' ? raw.subarray(0, 24) : raw),
      }))
      await page.goto('/flash')
      await connect(page)
      await page.getByRole('combobox', { name: 'Install', exact: true }).selectOption('fresh')
      await page.getByRole('button', { name: 'Install', exact: true }).click()
      await expect(page.getByText('The firmware files do not match a supported layout. Nothing was written.')).toBeVisible()
      expect(await page.evaluate(() => window.serialCalls)).toEqual(resets)
    })
  }
}

for (const gate of ['request', 'open', 'reset']) {
  test(`monitor startup blocks navigation during ${gate} and releases a port after forced unmount`, async ({ page }) => {
    await serial(page, gate)
    // Force an unmount as well as testing the router guard; a pending open cannot be cancelled.
    await page.route('**/src/main.tsx', route => route.fulfill({
      contentType: 'application/javascript', body: "import '/tests/helpers/flashHarness.tsx'",
    }))
    await page.goto('/flash')
    await page.getByRole('button', { name: 'Monitor', exact: true }).click()
    const before = gate === 'request' ? ['request'] : gate === 'open' ? ['request', 'open'] : ['request', 'open', 'signals']
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(before)
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled()
    await page.getByRole('link', { name: 'Firmware', exact: true }).first().click()
    await expect(page.getByRole('alert')).toContainText('Wait for the operation')
    await expect(page).toHaveURL(/\/flash$/)
    await page.evaluate(() => { window.unmountFlash(); window.continueMonitor() })
    const expected = gate === 'request' ? before : [...before, 'close']
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(expected)
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => window.serialCalls)).toEqual(expected)
  })
}

for (const gate of ['cancel', 'failure']) {
  test(`monitor startup ${gate} restores usable controls`, async ({ page }) => {
    await serial(page, gate)
    await page.goto('/flash')
    await page.getByRole('button', { name: 'Monitor', exact: true }).click()
    if (gate === 'failure') {
      await expect(page.getByText('The port does not open.')).toBeVisible()
      await page.getByRole('button', { name: 'Try again', exact: true }).click()
    }
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Monitor', exact: true })).toBeEnabled()
  })
}

test('monitor open timeout releases the busy page and a late open cannot replace a retry', async ({ page }) => {
  await serial(page, 'open')
  await page.goto('/flash')
  await page.clock.install()
  await page.getByRole('button', { name: 'Monitor', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['request', 'open'])
  await page.evaluate(() => { window.lateMonitor = window.continueMonitor })
  await page.clock.fastForward(10_000)
  await expect(page.getByText('The port does not open.')).toBeVisible()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Monitor', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['request', 'open', 'request', 'open'])
  await page.evaluate(() => window.lateMonitor())
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['request', 'open', 'request', 'open', 'close'])
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled()
  await page.evaluate(() => window.continueMonitor())
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toContain('signals')
  await page.clock.fastForward(100)
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'Firmware', exact: true }).first().click()
  await expect(page).toHaveURL(/\/firmware$/)
})

test('stopping a running monitor releases the reader and port', async ({ page }) => {
  await serial(page, 'none')
  await page.goto('/flash')
  await page.getByRole('button', { name: 'Monitor', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['request', 'open', 'signals', 'signals', 'reader'])
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['request', 'open', 'signals', 'signals', 'reader', 'releaseLock', 'close'])
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
})

for (const stage of ['open', 'running']) {
  test(`index failure during monitor ${stage} preserves the console and Stop`, async ({ page }) => {
    await serial(page, stage === 'open' ? 'open' : 'none')
    let failIndex
    const index = new Promise(resolve => { failIndex = resolve })
    await page.route('**/flash/index.json', async route => {
      await index
      await route.fulfill({ status: 503 })
    })
    await page.goto('/flash')
    await page.getByRole('button', { name: 'Monitor', exact: true }).click()
    if (stage === 'open') {
      await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual(['request', 'open'])
    } else {
      await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    }
    const failedIndex = page.waitForResponse('**/flash/index.json')
    failIndex()
    await (await failedIndex).finished()
    if (stage === 'open') {
      await expect(page.getByRole('alert')).toContainText('Could not load firmware versions')
      await expect(page.getByRole('button', { name: 'Monitor', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeDisabled()
      await page.evaluate(() => window.continueMonitor())
    }
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toContain('reader')
    await page.evaluate(() => window.writeMonitor('Firmware is running'))
    await expect(page.locator('.flash-console')).toHaveText('Firmware is running')
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual([
      'request', 'open', 'signals', 'signals', 'reader', 'releaseLock', 'close',
    ])
    await expect(page.getByRole('alert')).toContainText('Could not load firmware versions')
    await expect(page.getByRole('button', { name: 'Monitor', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled()
  })
}

for (const failure of ['network', 'http', 'empty']) {
  test(`monitor works after release index ${failure}`, async ({ page }) => {
    await serial(page, 'none')
    await page.route('**/flash/index.json', route => failure === 'network'
      ? route.abort()
      : route.fulfill(failure === 'http' ? { status: 503 } : { json: [] }))
    await page.goto('/flash')
    if (failure === 'empty') {
      await expect(page.getByText('No firmware is published yet.')).toBeVisible()
    } else {
      await expect(page.getByRole('alert')).toContainText('Could not load firmware versions')
    }
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Monitor', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.serialCalls)).toEqual([
      'request', 'open', 'signals', 'signals', 'reader', 'releaseLock', 'close',
    ])
    await expect(page.getByRole('button', { name: 'Monitor', exact: true })).toBeEnabled()
  })
}

for (const failure of ['network', 'http', 'empty']) {
  test(`release index ${failure} is distinguished and retry works`, async ({ page }) => {
    await serial(page)
    await page.route('**/flash/index.json', (route) => failure === 'network'
      ? route.abort()
      : route.fulfill(failure === 'http' ? { status: 503 } : { json: [] }))
    await page.goto('/flash')
    if (failure === 'empty') {
      await expect(page.getByText('No firmware is published yet.')).toBeVisible()
    } else {
      await expect(page.getByRole('alert')).toContainText('Could not load firmware versions')
      await expect(page.getByText('No firmware is published yet.')).toHaveCount(0)
      await page.unroute('**/flash/index.json')
      await page.getByRole('button', { name: 'Try again', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
    }
  })
}
