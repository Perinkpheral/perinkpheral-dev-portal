// SPDX-License-Identifier: MIT
// Render the actual applications with fixed demonstration data, never live accounts.
// Every frame is compared with its reviewed picture in assets/showcase/<name>.png: a frame
// that differs - an error screen, missing data, any change nobody looked at - fails the
// build, and nothing is published. `npm run screens -- --update` writes the pictures anew
// from the current applications; look at each before committing it.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sdk = resolve(process.env.PERINKPHERAL || join(root, '../perinkpheral-os'))
const apps = resolve(process.env.PERINKPHERAL_APPS || join(root, '../perinkpheral-apps'))
const work = mkdtempSync(join(tmpdir(), 'perinkpheral-showcase-'))
const fixtures = join(root, 'assets/showcase')
const output = join(root, 'public/screens')
const update = process.argv.includes('--update')
try {
  mkdirSync(output, { recursive: true })
  const names = readdirSync(fixtures).filter(file => file.endsWith('.json')).map(file => file.slice(0, -5))
  for (const name of names) {
    const scenario = JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8'))
    const folder = join(work, name)
    mkdirSync(folder)
    writeFileSync(join(folder, 'scenario.json'), JSON.stringify({
      ...scenario, app: join(apps, 'apps', name), glyphs: join(apps, 'glyphs'),
    }))
    const reviewed = join(fixtures, `${name}.png`)
    if (!update) {
      if (!existsSync(reviewed)) throw new Error(`${name}: no reviewed picture ${reviewed}; run npm run screens -- --update and look at it`)
      copyFileSync(reviewed, join(folder, `${name}.png`))
    }
  }
  // Frames are made in a temporary folder; the applications' own regression baselines stay intact.
  try {
    execFileSync(join(sdk, 'tools/perinkpheral'), ['sim-test', work, ...(update ? ['--update'] : [])], { stdio: 'inherit' })
  } catch {
    throw new Error('A showcase frame differs from its reviewed picture in assets/showcase: ' +
      'nothing is published. Fix the fixture or the application, or run npm run screens -- --update and review the pictures.')
  }
  for (const name of names) {
    if (update) copyFileSync(join(work, name, `${name}.png`), join(fixtures, `${name}.png`))
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(work, name, `${name}.png`),
      '-vf', 'scale=800:600:flags=neighbor,format=rgb24',
      '-frames:v', '1', '-update', '1', join(output, `${name}.png`)], { stdio: 'inherit' })
  }
  const revision = folder => execFileSync('git', ['-C', folder, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  writeFileSync(join(output, 'sources.json'), JSON.stringify({ firmware: revision(sdk), apps: revision(apps) }, null, 2) + '\n')
} finally {
  rmSync(work, { recursive: true, force: true })
}
