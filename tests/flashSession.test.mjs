// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isFlashVerificationError, openMonitorPort } from '../src/content/flashSession.ts'

function pendingPort() {
  const calls = []
  let resolve, reject
  const opening = new Promise((yes, no) => { resolve = yes; reject = no })
  const port = {
    open(options) { calls.push(options); return opening },
    async close() { calls.push('close') },
  }
  return { port, calls, resolve, reject }
}

test('a never-resolving monitor open times out at ten seconds and allows a retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const first = pendingPort()
  let settled = false
  const timeout = assert.rejects(openMonitorPort(first.port), /open timed out/).then(() => { settled = true })
  t.mock.timers.tick(9_999)
  await Promise.resolve()
  assert.equal(settled, false)
  t.mock.timers.tick(1)
  await timeout
  assert.deepEqual(first.calls, [{ baudRate: 115200 }])

  const retry = pendingPort()
  const opened = openMonitorPort(retry.port)
  retry.resolve()
  await opened
  // A late old open must be released without closing the successful retry.
  first.resolve()
  await Promise.resolve()
  assert.deepEqual(first.calls, [{ baudRate: 115200 }, 'close'])
  assert.deepEqual(retry.calls, [{ baudRate: 115200 }])
})

test('late open rejection after a timeout is handled', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const first = pendingPort()
  const timeout = assert.rejects(openMonitorPort(first.port), /open timed out/)
  t.mock.timers.tick(10_000)
  await timeout
  first.reject(new Error('Unplugged'))
  await Promise.resolve()
  assert.deepEqual(first.calls, [{ baudRate: 115200 }])
})

test('late close failure after a timeout is handled', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const first = pendingPort()
  first.port.close = async () => { first.calls.push('close'); throw new Error('Unplugged') }
  const timeout = assert.rejects(openMonitorPort(first.port), /open timed out/)
  t.mock.timers.tick(10_000)
  await timeout
  first.resolve()
  await Promise.resolve()
  assert.deepEqual(first.calls, [{ baudRate: 115200 }, 'close'])
})

for (const outcome of ['success', 'failure']) {
  test(`monitor open ${outcome} before the deadline clears the timeout`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const attempt = pendingPort()
    const opening = openMonitorPort(attempt.port)
    if (outcome === 'success') {
      attempt.resolve()
      await opening
    } else {
      const rejected = assert.rejects(opening, /Unavailable/)
      attempt.reject(new Error('Unavailable'))
      await rejected
    }
    t.mock.timers.tick(10_000)
    await Promise.resolve()
    assert.deepEqual(attempt.calls, [{ baudRate: 115200 }])
  })
}

test('unrelated write failures are not reported as verification failures', () => {
  for (const error of [new Error('USB disconnected during write'), new Error('Timeout'), null, 'MD5 of file does not match data in flash!']) {
    assert.equal(isFlashVerificationError(error), false)
  }
})
