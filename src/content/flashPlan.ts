// SPDX-License-Identifier: MIT
import { md5 } from './flashRead.ts'

export const FLASH_BYTES = 0x400000
export const TABLE_ADDRESS = 0x8000
export const SECTOR_BYTES = 0x1000
export type Flavor = 'release' | 'debug'
export type InstallMode = 'preserve' | 'fresh'
export type Builds = Record<Flavor, string | null> & Partial<Record<'migration' | 'debug_migration', string | null>>
export type Part = { path: string; offset: number }
export type FlashFile = { data: Uint8Array; address: number }
type Partition = { name: string; type: number; subtype: number; offset: number; size: number; flags: number }
export class FlashPlanError extends Error {}

export function manifestPath(builds: Builds, flavor: Flavor, mode: InstallMode): string | null {
  return builds[mode === 'fresh' ? flavor : flavor === 'debug' ? 'debug_migration' : 'migration'] ?? null
}

function fail(): never { throw new FlashPlanError('manifest') }
const partition = (name: string, type: number, subtype: number, offset: number, size: number): Partition =>
  ({ name, type, subtype, offset, size, flags: 0 })
const DATA = [
  partition('nvs', 1, 2, 0x9000, 0x6000),
  partition('otadata', 1, 0, 0xf000, 0x2000),
  partition('phy_init', 1, 1, 0x11000, 0x1000),
  partition('appkv', 1, 2, 0x12000, 0xe000),
  partition('appcode', 1, 0x40, 0x300000, 0x50000),
  partition('apps', 1, 0x83, 0x350000, 0xa0000),
  partition('glyphs', 1, 0x41, 0x3f0000, 0x10000),
]
const RECOVERY = [...DATA,
  partition('factory', 0, 0, 0x20000, 0xe0000),
  partition('ota_0', 0, 0x10, 0x100000, 0x200000),
]
const LEGACY = [...DATA,
  partition('ota_0', 0, 0x10, 0x20000, 0x170000),
  partition('ota_1', 0, 0x11, 0x190000, 0x170000),
]

function partitions(raw: Uint8Array): Partition[] {
  if (raw.length < 64 || raw.length > SECTOR_BYTES || raw.length % 32) fail()
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const result: Partition[] = []
  for (let at = 0; at + 32 <= raw.length; at += 32) {
    const magic = view.getUint16(at, true)
    if (magic === 0xebeb) {
      const digest = Array.from(raw.subarray(at + 16, at + 32), byte => byte.toString(16).padStart(2, '0')).join('')
      if (md5(raw.subarray(0, at)) !== digest || !raw.subarray(at + 2, at + 16).every(byte => byte === 0xff) ||
          !raw.subarray(at + 32).every(byte => byte === 0xff)) fail()
      return result
    }
    if (magic !== 0x50aa) fail()
    const label = raw.subarray(at + 12, at + 28)
    const end = label.indexOf(0)
    const name = new TextDecoder().decode(end < 0 ? label : label.subarray(0, end))
    if (!/^[a-z_0-9]+$/.test(name) || result.some(entry => entry.name === name)) fail()
    result.push({ name, type: raw[at + 2], subtype: raw[at + 3], offset: view.getUint32(at + 4, true),
      size: view.getUint32(at + 8, true), flags: view.getUint32(at + 28, true) })
  }
  return fail()
}

function matches(actual: Partition[], expected: Partition[]): boolean {
  return actual.length === expected.length && expected.every(wanted => actual.some(got =>
    got.name === wanted.name && got.type === wanted.type && got.subtype === wanted.subtype &&
    got.offset === wanted.offset && got.size === wanted.size && got.flags === wanted.flags))
}

// Only the two shipped layouts share the user-data addresses. An unknown table
// must never turn a request to keep data into an erase or a guessed migration.
export function validateSource(raw: Uint8Array): void {
  try {
    const source = partitions(raw)
    if (matches(source, LEGACY) || matches(source, RECOVERY)) return
  } catch { /* Report a source layout error, including an unreadable table. */ }
  throw new FlashPlanError('source')
}

export function releaseUrl(path: string, base: URL): URL {
  const url = new URL(path, base)
  const directory = new URL('.', base)
  if (url.origin !== base.origin || !url.pathname.startsWith(directory.pathname) || url.search || url.hash ||
      url.username || url.password || !path || path.includes('\\')) fail()
  return url
}

export function manifestParts(raw: unknown, version: string, flavor: Flavor, mode: InstallMode): Part[] {
  if (!raw || typeof raw !== 'object') fail()
  const manifest = raw as Record<string, unknown>
  const expectedVersion = version.replace(/^v/, '') + (flavor === 'debug' ? '-debug' : '')
  if (manifest.version !== expectedVersion || !Array.isArray(manifest.builds) ||
      (mode === 'preserve' ? manifest.new_install_prompt_erase !== false : manifest.new_install_prompt_erase === false)) fail()
  const builds = manifest.builds.filter(build => build?.chipFamily === 'ESP32-C6')
  if (builds.length !== 1 || !Array.isArray(builds[0].parts) || builds[0].parts.length < 5 || builds[0].parts.length > 6) fail()
  const parts = builds[0].parts as Part[]
  const prefix = flavor === 'debug' ? 'debug-' : ''
  if (parts.some(part => !part || typeof part.path !== 'string' ||
      !new RegExp(`^${prefix}(bootloader|partition-table|ota_data_initial|perink_recovery|perinkpheral|apps)\\.bin$`).test(part.path) ||
      !Number.isSafeInteger(part.offset) || part.offset < 0 || part.offset >= FLASH_BYTES || part.offset % SECTOR_BYTES) ||
      new Set(parts.map(part => part.path)).size !== parts.length || new Set(parts.map(part => part.offset)).size !== parts.length) fail()
  return parts
}

async function validateImage(data: Uint8Array): Promise<void> {
  if (data.length < 24 || data[0] !== 0xe9 || data[12] !== 13 || data[13] !== 0 ||
      data[1] < 1 || data[1] > 16 || data[23] > 1) fail()
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let at = 24
  let checksum = 0xef
  for (let segment = 0; segment < data[1]; segment += 1) {
    if (at + 8 > data.length) fail()
    const size = view.getUint32(at + 4, true)
    at += 8
    if (size % 4 || size > data.length - at) fail()
    const end = at + size
    for (; at < end; at += 1) checksum ^= data[at]
  }
  // Require the complete checksum block before esptool can erase flash.
  const end = Math.ceil((at + 1) / 16) * 16
  if (data.length !== end + (data[23] ? 32 : 0) || data[end - 1] !== checksum ||
      !data.subarray(at, end - 1).every(byte => byte === 0)) fail()
  if (data[23]) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data.slice(0, end)))
    if (!digest.every((byte, index) => byte === data[end + index])) fail()
  }
}

export async function validateFiles(parts: Part[], files: FlashFile[], mode: InstallMode, source?: Uint8Array): Promise<{ recovery: boolean }> {
  if (files.length !== parts.length || files.some((file, index) => file.address !== parts[index].offset || !file.data.length)) fail()
  const table = files.find(file => file.address === TABLE_ADDRESS)
  if (!table) fail()
  const destination = partitions(table.data)
  const recovery = matches(destination, RECOVERY)
  if (!recovery && !matches(destination, LEGACY)) fail()
  if (mode === 'preserve') {
    if (!recovery) fail()
    if (!source) throw new FlashPlanError('source')
    validateSource(source)
  }
  const expected = [
    { name: 'bootloader.bin', offset: 0, capacity: TABLE_ADDRESS },
    { name: 'partition-table.bin', offset: TABLE_ADDRESS, capacity: SECTOR_BYTES },
    { name: 'ota_data_initial.bin', offset: 0xf000, capacity: 0x2000 },
    ...(recovery ? [{ name: 'perink_recovery.bin', offset: 0x20000, capacity: 0xe0000 }] : []),
    { name: 'perinkpheral.bin', offset: recovery ? 0x100000 : 0x20000, capacity: recovery ? 0x200000 : 0x170000 },
    ...(mode === 'fresh' ? [{ name: 'apps.bin', offset: 0x350000, capacity: 0xa0000 }] : []),
  ]
  if (expected.length !== files.length) fail()
  for (const entry of expected) {
    const index = parts.findIndex(part => part.offset === entry.offset && part.path.replace(/^debug-/, '') === entry.name)
    if (index < 0) fail()
    const data = files[index].data
    // esptool erases whole sectors, including the last partly written one.
    if (Math.ceil(data.length / SECTOR_BYTES) * SECTOR_BYTES > entry.capacity) fail()
    if (entry.name === 'ota_data_initial.bin' && (data.length !== entry.capacity || !data.every(byte => byte === 0xff))) fail()
    if (entry.name === 'bootloader.bin' || entry.name === 'perink_recovery.bin' || entry.name === 'perinkpheral.bin') {
      await validateImage(data)
    }
  }
  return { recovery }
}
