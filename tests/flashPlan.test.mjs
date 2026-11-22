// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { manifestPath, manifestParts, releaseUrl, validateFiles, validateSource } from '../src/content/flashPlan.ts'

import { fixture, recovery, legacy, table, image, firstInstallOtaData } from './helpers/flashFixtures.mjs'

test('missing migration never falls back to an erasing manifest', () => {
  const builds = { release: 'manifest.json', debug: 'debug-manifest.json' }
  assert.equal(manifestPath(builds, 'release', 'preserve'), null)
  assert.equal(manifestPath(builds, 'debug', 'preserve'), null)
  assert.equal(manifestPath(builds, 'release', 'fresh'), 'manifest.json')
  const current = { ...builds, migration: 'migration-manifest.json', debug_migration: 'debug-migration-manifest.json' }
  assert.equal(manifestPath(current, 'release', 'preserve'), 'migration-manifest.json')
  assert.equal(manifestPath(current, 'debug', 'preserve'), 'debug-migration-manifest.json')
})
for (const flavor of ['release', 'debug']) for (const mode of ['fresh', 'preserve']) {
  test(`${flavor} ${mode} uses matching files and accepts both shipped source layouts`, async () => {
    const f = fixture(mode, recovery, flavor)
    assert.deepEqual(manifestParts(f.manifest, 'v0.1.35', flavor, mode), f.parts)
    for (const source of [legacy, recovery]) assert.deepEqual(await validateFiles(f.parts, f.files, mode, table(source)),
      { recovery: true, startsMain: mode === 'fresh' })
  })
}
for (const flavor of ['release', 'debug']) {
  test(`older ${flavor} recovery-layout fresh installs still accept blank metadata and need BACK`, async () => {
    const f = fixture('fresh', recovery, flavor, false)
    assert.deepEqual(manifestParts(f.manifest, 'v0.1.35', flavor, 'fresh'), f.parts)
    assert.deepEqual(await validateFiles(f.parts, f.files, 'fresh'), { recovery: true, startsMain: false })
  })
  test(`${flavor} Keep data rejects first-install metadata in both manifest and file validation`, async () => {
    const f = fixture('preserve', recovery, flavor, true)
    assert.throws(() => manifestParts(f.manifest, '0.1.35', flavor, 'preserve'), { message: 'manifest' })
    await assert.rejects(() => validateFiles(f.parts, f.files, 'preserve', table(legacy)), { message: 'manifest' })
  })
  test(`${flavor} legacy layout rejects first-install metadata`, async () => {
    const f = fixture('fresh', legacy, flavor, true)
    await assert.rejects(() => validateFiles(f.parts, f.files, 'fresh'), { message: 'manifest' })
  })
}
test('first-install metadata rejects a change to any of its 8192 bytes', async () => {
  const f = fixture('fresh')
  const data = f.files[2].data
  for (let index = 0; index < data.length; index += 1) {
    data[index] ^= 1
    await assert.rejects(() => validateFiles(f.parts, f.files, 'fresh'), { message: 'manifest' }, `byte ${index}`)
    data[index] ^= 1
  }
})
for (const [name, mutate] of [
  ['blank image under first-install name', f => { f.files[2].data.fill(255) }],
  ['first-install image under blank name', f => { f.parts[2].path = 'ota_data_initial.bin' }],
  ['truncated image', f => { f.files[2].data = f.files[2].data.subarray(0, 8191) }],
  ['one sector only', f => { f.files[2].data = f.files[2].data.subarray(0, 4096) }],
  ['extra byte', f => { f.files[2].data = new Uint8Array([...f.files[2].data, 255]) }],
  ['second boot record', f => { f.files[2].data.set(firstInstallOtaData().subarray(0, 32), 4096) }],
  ['unknown metadata name', f => { f.parts[2].path = 'otadata.bin' }],
  ['another allowed image at OTA address', f => { f.parts[2].path = 'perinkpheral.bin' }],
  ['wrong metadata address', f => { f.parts[2].offset = 0x11000; f.files[2].address = 0x11000 }],
]) test(`reject fresh install before erasing: ${name}`, async () => {
  const f = fixture('fresh'); mutate(f)
  await assert.rejects(() => validateFiles(f.parts, f.files, 'fresh'), { message: 'manifest' })
})
test('old releases still support an explicit fresh install', async () => {
  const f = fixture('fresh', legacy)
  delete f.manifest.new_install_prompt_erase
  manifestParts(f.manifest, '0.1.35', 'release', 'fresh')
  assert.deepEqual(await validateFiles(f.parts, f.files, 'fresh'), { recovery: false, startsMain: true })
  await assert.rejects(() => validateFiles(f.parts, f.files, 'preserve', table(legacy)))
})
for (const [name, mutate] of [
  ['missing erase policy', m => { delete m.new_install_prompt_erase }],
  ['erasing policy', m => { m.new_install_prompt_erase = true }],
  ['wrong version', m => { m.version = '0.1.34' }],
  ['wrong chip', m => { m.builds[0].chipFamily = 'ESP32-S3' }],
  ['duplicate chip', m => { m.builds.push(m.builds[0]) }],
  ['duplicate part', m => { m.builds[0].parts.push(m.builds[0].parts[0]) }],
  ['external image', m => { m.builds[0].parts[0].path = 'https://example.com/bootloader.bin' }],
  ['unaligned address', m => { m.builds[0].parts[0].offset = 1 }],
  ['out of flash', m => { m.builds[0].parts[0].offset = 0x400000 }],
]) test(`reject migration manifest: ${name}`, () => {
  const f = fixture(); mutate(f.manifest)
  assert.throws(() => manifestParts(f.manifest, '0.1.35', 'release', 'preserve'))
})
for (const [name, mutate] of [
  ['blank board', () => Buffer.alloc(0x1000, 0xff)],
  ['damaged digest', raw => { raw[32] ^= 1; return raw }],
  ['unknown user-data address', () => table(legacy.map(entry => entry[0] === 'apps' ? [...entry.slice(0, 3), 0x340000, entry[4]] : entry))],
  ['unknown flags', () => table(legacy.map(entry => [...entry, 1]))],
  ['extra partition', () => table([...legacy, ['other', 1, 0, 0x18000, 0x1000]])],
  ['duplicate partition', () => table([...legacy, legacy[0]])],
  ['truncated table', raw => raw.subarray(0, 64)],
]) test(`reject source table: ${name}`, () => {
  assert.throws(() => validateSource(mutate(table(legacy))), { message: 'source' })
})
for (const [name, mutate] of [
  ['main crosses data boundary', f => { f.files[4].data = new Uint8Array(0x200001) }],
  ['recovery crosses main boundary', f => { f.files[3].data = new Uint8Array(0xe0001) }],
  ['bootloader crosses table', f => { f.files[0].data = new Uint8Array(0x8001) }],
  ['table crosses NVS', f => { f.files[1].data = new Uint8Array(0x1001) }],
  ['nonblank OTA metadata', f => { f.files[2].data[0] = 0 }],
  ['short OTA metadata', f => { f.files[2].data = new Uint8Array(4096).fill(255) }],
  ['wrong image chip', f => { f.files[4].data[12] = 5 }],
  ['invalid image header', f => { f.files[4].data[0] = 0 }],
  ['empty image', f => { f.files[4].data = new Uint8Array() }],
  ['wrong destination layout', f => { f.files[1].data = table(legacy) }],
  ['apps included in migration', f => { f.parts.push({ path: 'apps.bin', offset: 0x350000 }); f.files.push({ address: 0x350000, data: new Uint8Array(4096) }) }],
  ['write redirected to settings', f => { f.parts[4].offset = 0x9000; f.files[4].address = 0x9000 }],
  ['mismatched download address', f => { f.files[4].address = 0x20000 }],
]) test(`reject before writing: ${name}`, async () => {
  const f = fixture(); mutate(f)
  await assert.rejects(() => validateFiles(f.parts, f.files, 'preserve', table(legacy)))
})
test('preservation requires a source table; fresh install ignores unknown source', async () => {
  const keep = fixture(); await assert.rejects(() => validateFiles(keep.parts, keep.files, 'preserve'), { message: 'source' })
  const fresh = fixture('fresh'); await validateFiles(fresh.parts, fresh.files, 'fresh', new Uint8Array(4096))
})
test('release URLs stay in the published directory', () => {
  const base = new URL('https://perinkpheral.github.io/perinkpheral-os/flash/v0.1.35/manifest.json')
  assert.equal(releaseUrl('bootloader.bin', base).pathname, '/perinkpheral-os/flash/v0.1.35/bootloader.bin')
  for (const path of ['../bootloader.bin', '//example.com/bootloader.bin', 'https://example.com/file', '/file', '?x=1', '#x', '']) {
    assert.throws(() => releaseUrl(path, base))
  }
})

for (const hashed of [false, true]) {
  test(`complete multi-segment images pass with appended SHA: ${hashed}`, async () => {
    const f = fixture()
    for (const index of [0, 3, 4]) f.files[index].data = image(hashed, [4, 0, 16])
    assert.deepEqual(await validateFiles(f.parts, f.files, 'preserve', table(legacy)), { recovery: true, startsMain: false })
  })
}
for (const index of [0, 3, 4]) for (const [name, mutate] of [
  ['header only', raw => raw.subarray(0, 24)],
  ['zero segments', raw => { raw[1] = 0; return raw }],
  ['too many segments', raw => { raw[1] = 17; return raw }],
  ['missing segment header', raw => { raw[1] = 2; return raw.subarray(0, 40) }],
  ['truncated segment header', raw => raw.subarray(0, 31)],
  ['truncated segment data', raw => raw.subarray(0, 33)],
  ['segment beyond image', raw => { new DataView(raw.buffer).setUint32(28, 0xfffffffc, true); return raw }],
  ['unaligned segment', raw => { new DataView(raw.buffer).setUint32(28, 3, true); return raw }],
  ['missing checksum', raw => raw.subarray(0, 47)],
  ['bad checksum', raw => { raw[47] ^= 1; return raw }],
  ['corrupted segment', raw => { raw[32] ^= 1; return raw }],
  ['invalid padding', raw => { raw[40] = 1; return raw }],
  ['missing SHA', raw => raw.subarray(0, 48)],
  ['truncated SHA', raw => raw.subarray(0, -1)],
  ['bad SHA', raw => { raw[48] ^= 1; return raw }],
  // Keep the XOR checksum unchanged to prove SHA is checked independently.
  ['corruption with matching checksum', raw => { raw[32] ^= 1; raw[33] ^= 1; return raw }],
  ['invalid SHA flag', raw => { raw[23] = 2; return raw }],
  ['unexpected trailing bytes', raw => new Uint8Array([...raw, 0xff])],
]) test(`reject image ${index} before writing: ${name}`, async () => {
  const f = fixture()
  f.files[index].data = mutate(image())
  await assert.rejects(() => validateFiles(f.parts, f.files, 'preserve', table(legacy)), { message: 'manifest' })
})

test('checksum remains required without appended SHA', async () => {
  const f = fixture()
  f.files[4].data = image(false)
  f.files[4].data[32] ^= 1
  await assert.rejects(() => validateFiles(f.parts, f.files, 'preserve', table(legacy)), { message: 'manifest' })
})
