// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { inflate } from 'pako'
import { ESPLoader } from 'esptool-js'
import { md5 } from '../src/content/flashRead.ts'
import { isFlashVerificationError } from '../src/content/flashSession.ts'
import { fixture } from './helpers/flashFixtures.mjs'

for (const badAddress of [null, 0, 0x20000, 0x100000]) {
  test(`esptool verifies every compressed write; corrupt address: ${badAddress}`, async () => {
    const files = fixture('fresh').files
    const checked = []
    const device = Object.assign(Object.create(ESPLoader.prototype), {
      IS_STUB: true,
      FLASH_WRITE_SIZE: 0x4000,
      chip: { BOOTLOADER_FLASH_OFFSET: 0 },
      debug() {},
      info() {},
      async flashDeflBegin(size, compressedSize, address) {
        this.address = address
        this.compressed = []
        return Math.ceil(compressedSize / this.FLASH_WRITE_SIZE)
      },
      async flashDeflBlock(block) { this.compressed.push(...block) },
      async flashDeflFinish() {
        this.stored = inflate(new Uint8Array(this.compressed))
        if (this.address === badAddress) this.stored[0] ^= 1
      },
      async flashMd5sum(address, size) {
        checked.push(address)
        assert.equal(size, this.stored.length)
        return createHash('md5').update(this.stored).digest('hex')
      },
    })
    const writing = device.writeFlash({ fileArray: files, flashSize: 'keep', flashMode: 'keep',
      flashFreq: 'keep', eraseAll: false, compress: true, calculateMD5Hash: md5 })
    if (badAddress === null) {
      await writing
      assert.deepEqual(checked, files.map(file => file.address))
    } else {
      await assert.rejects(writing, error => {
        assert.match(error.message, /MD5 of file does not match data in flash/)
        assert.equal(isFlashVerificationError(error), true)
        return true
      })
      assert.equal(checked.at(-1), badAddress)
    }
  })
}

test('MD5 callback matches native MD5 for binary bytes and block boundaries', () => {
  for (const size of [0, 1, 55, 56, 63, 64, 65, 257]) {
    const data = Uint8Array.from({ length: size }, (_, index) => (index * 137) & 255)
    assert.equal(md5(data), createHash('md5').update(data).digest('hex'))
  }
})
