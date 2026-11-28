// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ESPLoader, Transport } from 'esptool-js'
import { FlashNavigation } from '../components/FlashNavigation'
import { isFlashVerificationError, openMonitorPort, restartTransport } from '../content/flashSession'
import { Facts, PageHead } from '../components/Doc'
import { GuideNav } from '../components/GuideNav'
import { md5, readFlashRange, readWholeFlash } from '../content/flashRead'
import { FLASH_BYTES, TABLE_ADDRESS, SECTOR_BYTES, FlashPlanError, manifestPath, manifestParts, releaseUrl, validateFiles } from '../content/flashPlan'
import type { Builds, Flavor, InstallMode } from '../content/flashPlan'
import { useT } from '../i18n'

// The first flash from a browser: the board on a USB cable, Web Serial and
// Espressif's esptool-js. Any release of the firmware, for release or for
// debugging: the firmware's repository puts the files of every release on its
// Pages, where a browser may read them, with flash/index.json listing them -
// the version, the date, the notes and a manifest in the form of ESP Web Tools
// for each build. A migration preserves user data after checking both layouts;
// a fresh install erases the board. The whole flash can be read into a file: a copy
// of what the board holds, settings and Wi-Fi password among it.

const RELEASES = 'https://perinkpheral.github.io/perinkpheral-os/flash/'
const ESPRESSIF = 0x303a
type Release = { version: string; date: string; notes: string; builds: Builds }

// The notes as CHANGES.md has them, the line about the flasher aside: a point a line.
const notesOf = (release: Release) =>
  release.notes
    .split(/\n\s*\nA first flash/)[0]
    .split(/\n(?=- )/)
    .map((point) => point.trim().replace(/^- /, '').replace(/\s*\n\s*/g, ' '))
    .filter(Boolean)

// `code` of a note as code, the rest as text
const Note = ({ text }: { text: string }) => (
  <>{text.split('`').map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part))}</>
)

// The steps' pictures, eleven cells a side in the manner of the device's icons, all
// filled, so that they weigh the same
const ICON = {
  plug: ['...#...#...', '...#...#...', '...#...#...', '.#########.', '.#########.', '.#########.', '..#######..', '...#####...', '.....#.....', '.....#.....', '.....#.....'],
  list: ['##.########', '##.########', '...........', '...........', '##.########', '##.########', '...........', '...........', '##.########', '##.########'],
  chip: ['..#.#.#.#..', '...........', '#.#######.#', '..#######..', '#.#######.#', '..#######..', '#.#######.#', '..#######..', '#.#######.#', '...........', '..#.#.#.#..'],
  save: ['....###....', '....###....', '....###....', '.#########.', '..#######..', '...#####...', '....###....', '.....#.....', '...........', '##.......##', '###########'],
  bolt: ['......###..', '.....###...', '....###....', '...###.....', '..#######..', '.....###...', '....###....', '...###.....', '..###......', '.###.......'],
  signal: ['.......##', '.......##', '.......##', '....##.##', '....##.##', '....##.##', '.##.##.##', '.##.##.##', '.##.##.##'],
  warning: ['.....#.....', '....#.#....', '....#.#....', '...#...#...', '...#.#.#...', '..#..#..#..', '..#..#..#..', '.#.......#.', '.#...#...#.', '#.........#', '###########'],
}

// A picture cropped to its ink and set in the middle of a square: every step's picture
// the same size, whatever cells it takes
function StepIcon({ rows }: { rows: string[] }) {
  const inkRows = rows.map((row, y) => (row.includes('#') ? y : -1)).filter((y) => y >= 0)
  const inkColumns = rows.flatMap((row) => [...row].flatMap((cell, x) => (cell === '#' ? [x] : [])))
  const top = Math.min(...inkRows)
  const left = Math.min(...inkColumns)
  const width = Math.max(...inkColumns) - left + 1
  const height = Math.max(...inkRows) - top + 1
  const side = Math.max(width, height)
  const box = `${left - (side - width) / 2} ${top - (side - height) / 2} ${side} ${side}`
  return (
    <svg className="app-icon" viewBox={box} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row.matchAll(/#+/g)].map((run) => (
          <rect key={`${y}-${run.index}`} x={run.index} y={y} width={run[0].length} height={1} />
        )),
      )}
    </svg>
  )
}

// What to do, in order.
const STEPS: [string[], [string, string], [string, string]][] = [
  [ICON.plug, ['Connect the board', 'Подключите плату'], ['USB-C cable with data.', 'Кабель USB-C с данными.']],
  [ICON.list, ['Choose a version', 'Выберите версию'], ['And a build: Release or Debug.', 'И сборку: Релиз или Отладка.']],
  [ICON.chip, ['Click Connect', 'Нажмите «Подключить»'], ['Pick the board in the list.', 'Выберите плату в списке.']],
  [ICON.save, ['Back up', 'Сохраните копию'], ['Optional: the whole flash.', 'Необязательно: весь флеш.']],
  [ICON.bolt, ['Click Install', 'Нажмите «Установить»'], ['New board: choose Fresh install.', 'Новая плата: «Чистая установка».']],
  [ICON.signal, ['Wait for the start', 'Дождитесь запуска'], ['Keep data: press BACK.', 'С сохранением данных: BACK.']],
]

type Phase =
  | { name: 'idle' }
  | { name: 'monitor' }
  | { name: 'monitor-starting' }
  | { name: 'connecting' }
  | { name: 'disconnecting' }
  | { name: 'connected'; chip: string; mac: string; saved?: string }
  | { name: 'reading'; chip: string; mac: string; done: number }
  | { name: 'preparing' }
  | { name: 'erasing' }
  | { name: 'writing'; done: number }
  | { name: 'done'; startsMain: boolean; mode: InstallMode }
  | { name: 'error'; message: string }

function Progress({ value }: { value: number }) {
  return (
    <div className="flash-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${value}%` }} />
    </div>
  )
}

export function Flash() {
  const t = useT()
  // Web Serial, asked of the browser; a page built ahead of time assumes it
  const supported = useSyncExternalStore(
    () => () => {},
    () => 'serial' in navigator,
    () => true,
  )
  const [releases, setReleases] = useState<Release[] | null | 'none' | 'failed'>(null)
  const [releaseAttempt, setReleaseAttempt] = useState(0)
  const [navigationBlocked, setNavigationBlocked] = useState(false)
  const clientReady = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [chosen, setChosen] = useState(0)
  const [flavor, setFlavor] = useState<Flavor>('release')
  const [mode, setMode] = useState<InstallMode>('preserve')
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [log, setLog] = useState('')
  const loader = useRef<ESPLoader | null>(null)
  const monitorPort = useRef<SerialPort | null>(null)
  const monitorReader = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const consoleView = useRef<HTMLPreElement | null>(null)

  // the console follows what comes last
  useEffect(() => {
    const view = consoleView.current
    if (view) {
      view.scrollTop = view.scrollHeight
    }
  }, [log])
  const transport = useRef<Transport | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${RELEASES}index.json`, { cache: 'no-cache', signal: controller.signal })
      .then((answer) => {
        if (!answer.ok) throw new Error('release index download')
        return answer.json()
      })
      .then((list: Release[]) => {
        if (!Array.isArray(list)) throw new Error('release index format')
        setChosen(0)
        setReleases(list.length ? list : 'none')
      })
      .catch(() => { if (!controller.signal.aborted) setReleases('failed') })
    return () => controller.abort()
  }, [releaseAttempt])

  const current = Array.isArray(releases) ? releases[chosen] : null
  // a release made before there were builds for debugging has the one
  const build: Flavor = current && current.builds[flavor] ? flavor : 'release'
  const installPath = current ? manifestPath(current.builds, build, mode) : null

  // Normal navigation awaits reset through FlashNavigation. Unmount also releases
  // an idle connection; active operations must finish before the port is touched.
  const operation = useRef(false)
  const mounted = useRef(false)
  useEffect(
    () => {
      mounted.current = true
      return () => {
        mounted.current = false
        const reader = monitorReader.current
        const port = monitorPort.current
        monitorReader.current = null
        monitorPort.current = null
        void (async () => {
          await reader?.cancel().catch(() => {})
          await port?.close().catch(() => {})
        })()
        if (!operation.current) {
          const line = transport.current
          transport.current = null
          loader.current = null
          void restartTransport(line).then(() => line?.disconnect()).catch(() => {})
        }
      }
    },
    [],
  )

  const say = (line: string) => setLog((text) => text + line)
  const terminal = {
    clean: () => setLog(''),
    writeLine: (line: string) => say(`${line}\n`),
    write: (line: string) => say(line),
  }

  const restart = () => restartTransport(transport.current)

  const release = async () => {
    try {
      await transport.current?.disconnect()
    } catch {
      // the port is gone already
    }
    transport.current = null
    loader.current = null
  }

  const disconnect = async () => {
    operation.current = true
    setPhase({ name: 'disconnecting' })
    await restart()
    await release()
    operation.current = false
    setPhase({ name: 'idle' })
  }

  const connect = async () => {
    operation.current = true
    setPhase({ name: 'connecting' })
    try {
      const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: ESPRESSIF }] })
      const { ESPLoader, Transport } = await import('esptool-js')
      transport.current = new Transport(port, false)
      loader.current = new ESPLoader({ transport: transport.current, baudrate: 921600, terminal })
      await loader.current.main()
      const chip = loader.current.chip.CHIP_NAME
      if (chip !== 'ESP32-C6') {
        await release()
        setPhase({ name: 'error', message: t(`This is ${chip}, not ESP32-C6.`, `Это ${chip}, а не ESP32-C6.`) })
        return
      }
      const mac = await loader.current.chip.readMac(loader.current)
      setPhase({ name: 'connected', chip, mac })
    } catch (error) {
      await release()
      const cancelled = error instanceof DOMException && error.name === 'NotFoundError'
      setPhase(
        cancelled
          ? { name: 'idle' }
          : { name: 'error', message: t('The board does not answer.', 'Плата не отвечает.') },
      )
    } finally {
      operation.current = false
    }
  }

  const install = async () => {
    const device = loader.current
    if (!device || !installPath || !current) return
    operation.current = true
    setPhase({ name: 'preparing' })
    let writing = false
    try {
      const manifestUrl = releaseUrl(installPath, new URL(RELEASES))
      const answer = await fetch(manifestUrl, { cache: 'no-cache' })
      if (!answer.ok) throw new Error('manifest download')
      const parts = manifestParts(await answer.json(), current.version, build, mode)
      const files = await Promise.all(parts.map(async (part) => {
        const answer = await fetch(releaseUrl(part.path, manifestUrl))
        if (!answer.ok) throw new Error('image download')
        return { data: new Uint8Array(await answer.arrayBuffer()), address: part.offset }
      }))
      const source = mode === 'preserve' ? await readFlashRange(device, TABLE_ADDRESS, SECTOR_BYTES) : undefined
      const { startsMain } = await validateFiles(parts, files, mode, source)
      const total = files.reduce((sum, file) => sum + file.data.length, 0)
      const before = files.map((_, index) => files.slice(0, index).reduce((sum, file) => sum + file.data.length, 0))
      writing = true
      setPhase(mode === 'fresh' ? { name: 'erasing' } : { name: 'writing', done: 0 })
      await device.writeFlash({
        fileArray: files,
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: mode === 'fresh',
        compress: true,
        calculateMD5Hash: md5,
        reportProgress: (index, written, size) => {
          const share = (before[index] + (written / size) * files[index].data.length) / total
          setPhase({ name: 'writing', done: Math.round(share * 100) })
        },
      })
      await restart()
      await release()
      setPhase({ name: 'done', startsMain, mode })
    } catch (error) {
      if (!writing) await restart()
      await release()
      const message = error instanceof FlashPlanError
        ? error.message === 'source'
          ? t('This flash layout cannot be migrated safely. Nothing was written. Back up before choosing a fresh install.',
              'Эту разметку нельзя безопасно перенести. Ничего не записано. Сохраните копию перед чистой установкой.')
          : t('The firmware files do not match a supported layout. Nothing was written.',
              'Файлы прошивки не соответствуют поддерживаемой разметке. Ничего не записано.')
        : writing
          ? isFlashVerificationError(error)
            ? t('The written data did not verify. Connect again and reinstall.', 'Записанные данные не прошли проверку. Подключите ещё раз и переустановите прошивку.')
            : t('Writing stopped. Connect again.', 'Запись прервалась. Подключите ещё раз.')
          : t('Preparation failed. Nothing was written. Connect again.', 'Подготовка не удалась. Ничего не записано. Подключите ещё раз.')
      setPhase({ name: 'error', message })
    } finally {
      operation.current = false
    }
  }

  // What the board's firmware writes on its console, from a restart on: the
  // way to see why a board that does not answer does not.
  const monitor = async () => {
    setPhase({ name: 'monitor-starting' })
    let port: SerialPort | null = null
    try {
      port = await navigator.serial.requestPort({ filters: [{ usbVendorId: ESPRESSIF }] })
      if (!mounted.current) return
      await openMonitorPort(port)
      // Unmount may finish before open resolves, so cleanup cannot own this port yet.
      if (!mounted.current) {
        await port.close().catch(() => {})
        return
      }
      monitorPort.current = port
      setLog('')
      // a reset into the firmware, as esptool's hard reset over USB-JTAG
      await port.setSignals({ dataTerminalReady: false, requestToSend: true })
      if (monitorPort.current !== port) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (monitorPort.current !== port) return
      await port.setSignals({ requestToSend: false })
      if (monitorPort.current !== port) return
      setPhase({ name: 'monitor' })
      const decoder = new TextDecoder()
      while (port.readable && monitorPort.current === port) {
        const reader = port.readable.getReader()
        monitorReader.current = reader
        try {
          for (;;) {
            const { value, done } = await reader.read()
            if (done) {
              break
            }
            say(decoder.decode(value, { stream: true }))
          }
        } catch {
          // the board went away, or Stop was pressed
        } finally {
          reader.releaseLock()
          if (monitorReader.current === reader) {
            monitorReader.current = null
          }
        }
      }
    } catch (error) {
      if (!mounted.current) return
      const cancelled = error instanceof DOMException && error.name === 'NotFoundError'
      if (cancelled) {
        setPhase({ name: 'idle' })
      } else {
        // a port that opened and then failed is let go, or nothing could open it again
        if (port && monitorPort.current === port) {
          await closeMonitor()
        }
        setPhase({ name: 'error', message: t('The port does not open.', 'Порт не открывается.') })
      }
    }
  }

  // The reader and the port let go each on its own: a reader already gone
  // must not keep the port open.
  const closeMonitor = async () => {
    const port = monitorPort.current
    const reader = monitorReader.current
    monitorPort.current = null
    monitorReader.current = null
    try {
      await reader?.cancel()
    } catch {
      // released already
    }
    try {
      await port?.close()
    } catch {
      // closed already
    }
  }

  const stopMonitor = async () => {
    await closeMonitor()
    setPhase({ name: 'idle' })
  }


  // the whole flash into a file the browser saves
  const save = async (chip: string, mac: string) => {
    if (!loader.current) {
      return
    }
    operation.current = true
    setPhase({ name: 'reading', chip, mac, done: 0 })
    try {
      const data = await readWholeFlash(loader.current, FLASH_BYTES, (read, size) =>
        setPhase({ name: 'reading', chip, mac, done: Math.floor((read / size) * 100) }),
      )
      const name = `perinkpheral-backup-${mac.replace(/:/g, '')}-${new Date().toISOString().slice(0, 10)}.bin`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/octet-stream' }))
      link.download = name
      link.click()
      URL.revokeObjectURL(link.href)
      setPhase({ name: 'connected', chip, mac, saved: name })
    } catch {
      await restart()
      await release()
      setPhase({ name: 'error', message: t('Reading stopped. Connect again.', 'Чтение прервалось. Подключите ещё раз.') })
    } finally {
      operation.current = false
    }
  }

  const version = current?.version ?? null
  const busy =
    phase.name === 'monitor-starting' || phase.name === 'connecting' || phase.name === 'disconnecting' || phase.name === 'preparing' || phase.name === 'erasing' || phase.name === 'writing' || phase.name === 'reading'

  let body
  if (!supported) {
    body = <p>{t('Needs Chrome or Edge on a computer.', 'Нужен Chrome или Edge на компьютере.')}</p>
  } else if (phase.name === 'idle' || phase.name === 'connecting' || phase.name === 'monitor-starting') {
    const list = Array.isArray(releases) ? releases : []
    body = (
      <>
        {releases === 'failed' ? <>
          <p role="alert">{t('Could not load firmware versions. Check your connection and try again.', 'Не удалось загрузить версии прошивки. Проверьте соединение и попробуйте ещё раз.')}</p>
          <button type="button" className="button" disabled={busy} onClick={() => { setReleases(null); setReleaseAttempt((attempt) => attempt + 1) }}>{t('Try again', 'Повторить')}</button>
        </> : releases === 'none' ? (
          <p>{t('No firmware is published yet.', 'Прошивка ещё не опубликована.')}</p>
        ) : <div className="flash-choice">
          <label>
            <span>{t('Version', 'Версия')}</span>
            <select
              value={chosen}
              disabled={busy || !list.length}
              onChange={(event) => setChosen(Number(event.target.value))}
            >
              {list.map((one, index) => (
                <option key={one.version} value={index}>
                  {one.version}
                  {index === 0 ? t(' (latest)', ' (последняя)') : ''}
                  {one.date ? ` - ${one.date}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="flash-build" role="radiogroup" aria-label={t('Build', 'Сборка')}>
            <span>{t('Build', 'Сборка')}</span>
            <div>
              {(['release', 'debug'] as Flavor[]).map((one) => (
                <button
                  key={one}
                  type="button"
                  role="radio"
                  aria-checked={build === one}
                  disabled={busy || !current?.builds[one]}
                  onClick={() => setFlavor(one)}
                >
                  {one === 'release' ? t('Release', 'Релиз') : t('Debug', 'Отладка')}
                </button>
              ))}
            </div>
          </div>
          <p className="dim">
            {build === 'release'
              ? t('Smaller, for everyday use.', 'Компактнее, для повседневной работы.')
              : t('With the development tools: screen, buttons and apps over the network.',
                  'С инструментами разработчика: экран, кнопки и приложения по сети.')}
          </p>
          {current && notesOf(current).length > 0 && (
            <details className="flash-notes">
              <summary>{t('What is new', 'Что нового')}</summary>
              <ul>
                {notesOf(current).map((point) => (
                  <li key={point}>
                    <Note text={point} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>}
        <p>{t('Connect the board to this computer with a USB-C cable.', 'Подключите плату к компьютеру кабелем USB-C.')}</p>
        <div className="buttons">
          <button type="button" className="button" onClick={connect} disabled={busy || !version}>
            {phase.name === 'connecting' ? t('Connecting', 'Подключение') : t('Connect', 'Подключить')}
          </button>
          <button type="button" className="button quiet" onClick={monitor} disabled={busy}>
            {t('Monitor', 'Монитор')}
          </button>
        </div>
      </>
    )
  } else if (phase.name === 'monitor') {
    body = (
      <>
        <p>{t('The board restarts; what it writes is below.', 'Плата перезапускается, её вывод ниже.')}</p>
        <pre className="flash-console" ref={consoleView}>
          {log || '...'}
        </pre>
        <div className="buttons">
          <button type="button" className="button quiet" onClick={() => navigator.clipboard.writeText(log)}>
            {t('Copy', 'Копировать')}
          </button>
          <button type="button" className="button quiet" onClick={stopMonitor}>
            {t('Stop', 'Остановить')}
          </button>
        </div>
      </>
    )
  } else if (phase.name === 'connected') {
    body = (
      <>
        <Facts
          rows={[
            [t('Chip', 'Чип'), phase.chip],
            ['MAC', phase.mac],
          ]}
        />
        {phase.saved ? (
          <p>
            {t('Backup saved:', 'Резервная копия сохранена:')} <code>{phase.saved}</code>
          </p>
        ) : null}
        <div className="flash-choice">
          <label>
            <span>{t('Install', 'Установка')}</span>
            <select value={mode} onChange={event => setMode(event.target.value as InstallMode)}>
              <option value="preserve">{t('Keep data', 'Сохранить данные')}</option>
              <option value="fresh">{t('Fresh install', 'Чистая установка')}</option>
            </select>
          </label>
          <p className={mode === 'fresh' || !installPath ? 'flash-warning' : 'dim'}>
            {mode === 'fresh'
              ? t('Everything on the board is erased.', 'Всё на плате будет стёрто.')
              : installPath
                ? t('Keeps settings, Wi-Fi, apps and their data. Checks the layout before writing. Pre-release apps may need an update or rebuild for 0.2.0.',
                    'Сохраняет настройки, Wi-Fi, приложения и их данные. Проверяет разметку перед записью. Приложения из предварительных версий могут требовать обновления или пересборки для 0.2.0.')
                : t('This release has no migration build. Choose a newer release to keep data.',
                    'У этой версии нет сборки для переноса. Выберите более новую версию, чтобы сохранить данные.')}
          </p>
        </div>
        <div className="buttons">
          <button type="button" className="button" onClick={install} disabled={!installPath}>
            {t('Install', 'Установить')}
          </button>
          <button type="button" className="button quiet" onClick={() => save(phase.chip, phase.mac)}>
            {t('Back up', 'Создать резервную копию')}
          </button>
          <button
            type="button"
            className="button quiet"
            onClick={disconnect}
          >
            {t('Disconnect', 'Отключить')}
          </button>
        </div>
      </>
    )
  } else if (phase.name === 'disconnecting') {
    body = <p>{t('Disconnecting', 'Отключение')}</p>
  } else if (phase.name === 'reading') {
    body = (
      <>
        <p>
          {t('Reading the flash', 'Чтение флеша')}
          <span className="flash-percent">{phase.done}%</span>
        </p>
        <Progress value={phase.done} />
        <p className="dim">{t('Keep the board connected.', 'Не отключайте плату.')}</p>
      </>
    )
  } else if (phase.name === 'preparing' || phase.name === 'erasing' || phase.name === 'writing') {
    const done = phase.name === 'writing' ? phase.done : 0
    body = (
      <>
        <p>
          {phase.name === 'preparing' ? t('Checking firmware and layout', 'Проверка прошивки и разметки') : phase.name === 'erasing' ? t('Erasing', 'Стирание') : t('Writing', 'Запись')}
          {phase.name === 'writing' && <span className="flash-percent">{done}%</span>}
        </p>
        <Progress value={done} />
        <p className="dim">{t('Keep the board connected.', 'Не отключайте плату.')}</p>
      </>
    )
  } else if (phase.name === 'done') {
    body = (
      <>
        <p>
          {phase.startsMain
            ? t('Installed. The device starts automatically and shows the setup screen with a QR code.',
                'Установлено. Устройство запустится само и покажет экран настройки с QR-кодом.')
            : t('Installed. On the recovery screen, press BACK to start the firmware.',
                'Установлено. На экране recovery нажмите BACK, чтобы запустить прошивку.')}
        </p>
        <p>
          {phase.mode === 'preserve'
            ? t('Wi-Fi and apps are kept. Pre-release apps may need an update or rebuild for 0.2.0.', 'Wi-Fi и приложения сохранены. Приложения из предварительных версий могут требовать обновления или пересборки для 0.2.0.')
            : t('Then scan the QR code to set up Wi-Fi.', 'Затем отсканируйте QR-код, чтобы настроить Wi-Fi.')}
        </p>
      </>
    )
  } else {
    body = (
      <>
        <p className="flash-warning">{phase.message}</p>
        <div className="buttons">
          <button type="button" className="button" onClick={() => setPhase({ name: 'idle' })}>
            {t('Try again', 'Ещё раз')}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {clientReady && <FlashNavigation
        busy={busy}
        connected={phase.name === 'connected'}
        disconnect={disconnect}
        onBlocked={() => setNavigationBlocked(true)}
      />}
      {navigationBlocked && busy && <p className="wrap" role="alert">{t('Wait for the operation to finish before leaving this page.', 'Дождитесь завершения операции перед переходом на другую страницу.')}</p>}

      <PageHead title={t('Flash', 'Прошивка')} />
      <div className="wrap flash-page">
        <div className="flash-main">
          <section className="flasher" aria-live="polite">
            <div className="flasher-head">
              <span>perINKpheral</span>
              <span>{version ? `${version}${build === 'debug' ? ' debug' : ''}` : ''}</span>
            </div>
            <div className="flasher-body">{body}</div>
            {log && phase.name !== 'monitor' && (
              <details className="flasher-log">
                <summary>{t('Log', 'Журнал')}</summary>
                <pre>{log}</pre>
              </details>
            )}
          </section>
          <div className="flash-browser" role="note">
            <StepIcon rows={ICON.warning} />
            <p>
              {t(
                'Requires Chrome or Edge on a computer. Safari, Firefox and mobile browsers do not support Web Serial.',
                'Нужен Chrome или Edge на компьютере. Safari, Firefox и мобильные браузеры не поддерживают Web Serial.',
              )}
            </p>
          </div>
        </div>
        <aside>
          <ol className="flash-steps">
            {STEPS.map(([icon, title, text], index) => (
              <li key={title[0]}>
                <span className="flash-step-icon">
                  <StepIcon rows={icon} />
                </span>
                <div>
                  <h3>
                    <span className="flash-step-number">{index + 1}.</span>
                    {t(...title)}
                  </h3>
                  <p>{t(...text)}</p>
                </div>
              </li>
            ))}
          </ol>
          <details>
            <summary>{t('The board is not listed', 'Платы нет в списке')}</summary>
            <p>{t('Use a USB cable that carries data. On the XIAO, hold BOOT, press and release RESET, then release BOOT and click Connect again.', 'Используйте USB-кабель с передачей данных. На XIAO удерживайте BOOT, нажмите и отпустите RESET, затем отпустите BOOT и снова нажмите «Подключить».')}</p>
          </details>
        </aside>
      </div>
      {!busy && (
        <div className="wrap">
          <GuideNav
            previous={{ to: '/hardware', label: 'Hardware' }}
            next={{ to: '/setup', label: t('Set up the device', 'Настроить устройство') }}
          />
        </div>
      )}
    </>
  )
}
