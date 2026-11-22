// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react'
import { useT } from '../i18n'

// Diagrams drawn as the device would draw them: ink lines, boxes, one face.

const INK = '#141413'
const PAPER = '#e9e7e1'
const DIM = '#6b6862'

type BoxProps = {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub?: string
  filled?: boolean
  dashed?: boolean
}

function Box({ x, y, w, h, title, sub, filled = false, dashed = false }: BoxProps) {
  const fg = filled ? PAPER : INK
  const middle = y + h / 2
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={filled ? INK : PAPER}
        stroke={INK}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '6 4' : undefined}
      />
      <text x={x + w / 2} y={sub ? middle - 4 : middle + 5} textAnchor="middle" fontSize={14} fill={fg}>
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={middle + 15} textAnchor="middle" fontSize={11} fill={filled ? '#b9b5ad' : DIM}>
          {sub}
        </text>
      )}
    </g>
  )
}

function Arrow({ points, label, dashed = false, labelAt }: { points: [number, number][]; label?: string; dashed?: boolean; labelAt?: [number, number] }) {
  const [x1, y1] = points[points.length - 2]
  const [x2, y2] = points[points.length - 1]
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 8
  const left: [number, number] = [x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45)]
  const right: [number, number] = [x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45)]
  return (
    <g>
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke={INK}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '5 4' : undefined}
      />
      <polygon points={[[x2, y2], left, right].map((p) => p.join(',')).join(' ')} fill={INK} />
      {label && labelAt && (
        <text x={labelAt[0]} y={labelAt[1]} fontSize={11} fill={DIM} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  )
}

function Diagram({ width, height, label, children }: { width: number; height: number; label: string; children: ReactNode }) {
  return (
    <figure className="diagram">
      <div className="canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
          {children}
        </svg>
      </div>
    </figure>
  )
}

// ---- the layers of Perinkpheral OS ----

export function LayersDiagram() {
  const t = useT()
  return (
    <Diagram width={760} height={560} label={t('The layers of Perinkpheral OS; recovery is a separate image', 'Слои Perinkpheral OS; recovery - отдельный образ')}>
      <Box x={10} y={10} w={530} h={50} title={t('Apps', 'Приложения')} sub={t('Including Settings, About and setup', 'В том числе настройки, информация и подключение')} filled />
      <Box x={10} y={74} w={530} h={40} title="host_api · ABI 3" />
      <Box x={10} y={128} w={530} h={50} title="wasm3" sub={t('One loaded app instance', 'Один загруженный экземпляр приложения')} />
      <Box x={10} y={192} w={260} h={50} title={t('Navigation', 'Навигация')} />
      <Box x={280} y={192} w={260} h={50} title={t('Scenes', 'Сцены')} />
      <Box x={10} y={256} w={530} h={40} title={t('Graphics', 'Графика')} />
      <Box x={10} y={310} w={530} h={40} title={t('Screen refresh', 'Обновление экрана')} />
      <Box x={10} y={364} w={530} h={40} title={t('Drivers', 'Драйверы')} />
      <Box x={560} y={10} w={190} h={50} title="Perinkpheral OS" sub={t('Event loop', 'Цикл событий')} filled />
      <Box x={560} y={74} w={190} h={50} title={t('Timers', 'Таймеры')} />
      <Box x={560} y={138} w={190} h={50} title={t('Network', 'Сеть')} />
      <Box x={560} y={202} w={190} h={50} title={t('Wi-Fi and time', 'Wi-Fi и время')} />
      <Box x={560} y={266} w={190} h={50} title={t('Web page', 'Веб-страница')} />
      <Box x={560} y={330} w={190} h={50} title={t('Storage', 'Хранилище')} />
      <Box x={10} y={424} w={740} h={56} title={t('Recovery · separate boot image', 'Recovery · отдельный загрузочный образ')}
        sub={t('Receives and writes the main firmware update', 'Принимает и записывает обновление основной прошивки')} dashed />
      <Box x={10} y={510} w={740} h={28} title="ESP32-C6" />
    </Diagram>
  )
}

// ---- how data reaches an application ----

export function DeliveryDiagram() {
  const t = useT()
  return (
    <Diagram width={820} height={600} label={t('Picked values or raw response chunks reach one app instance', 'Выбранные значения или части ответа поступают одному экземпляру приложения')}>
      <Box x={10} y={20} w={180} h={56} title={t('Schedule', 'Расписание')} />
      <Box x={10} y={100} w={180} h={56} title={t('On demand', 'По запросу')} />
      <Arrow points={[[190, 48], [235, 48], [235, 80], [260, 80]]} />
      <Arrow points={[[190, 128], [235, 128], [235, 96], [260, 96]]} />
      <Box x={260} y={60} w={180} h={56} title={t('Device', 'Устройство')} filled />
      <Arrow points={[[440, 88], [490, 88]]} />
      <Box x={490} y={60} w={150} h={56} title={t('Source', 'Источник')} />
      <Arrow points={[[640, 88], [680, 88]]} />
      <Box x={680} y={60} w={130} h={56} title={t('Response', 'Ответ')} />
      <Arrow points={[[715, 116], [715, 175], [610, 175]]} label="pick" labelAt={[680, 165]} />
      <Box x={360} y={147} w={250} h={56} title={t('Selected values', 'Выбранные значения')} sub="app_on_picked" />
      <Arrow points={[[775, 116], [775, 255], [610, 255]]} label={t('raw body', 'тело ответа')} labelAt={[700, 245]} />
      <Box x={360} y={227} w={250} h={56} title={t('Response chunks', 'Части ответа')} sub="app_on_data" />
      <Arrow points={[[360, 175], [300, 175], [300, 210], [250, 210]]} />
      <Arrow points={[[360, 255], [300, 255], [300, 226], [250, 226]]} />
      <Box x={20} y={190} w={230} h={56} title={t('App on screen?', 'Приложение на экране?')} filled />
      <Arrow points={[[80, 246], [80, 320]]} label={t('yes', 'да')} labelAt={[60, 285]} />
      <Box x={10} y={320} w={210} h={56} title={t('Deliver to app', 'Передать приложению')} />
      <Arrow points={[[190, 246], [190, 300], [480, 300], [480, 320]]} label={t('no', 'нет')} labelAt={[260, 290]} />
      <Box x={290} y={320} w={410} h={60} title={t('Temporarily load recipient', 'Временно загрузить получателя')}
        sub={t('Unload the foreground app; deliver the response', 'Выгрузить активное приложение; передать ответ')} />
      <Arrow points={[[495, 380], [495, 410]]} />
      <Box x={290} y={410} w={410} h={56} title={t('Focus requested and allowed?', 'Фокус запрошен и разрешён?')} filled />
      <Arrow points={[[390, 466], [390, 495], [180, 495], [180, 520]]} label={t('no', 'нет')} labelAt={[280, 485]} />
      <Arrow points={[[600, 466], [600, 520]]} label={t('yes', 'да')} labelAt={[625, 495]} />
      <Box x={10} y={520} w={340} h={56} title={t('Restore previous screen', 'Восстановить прежний экран')} />
      <Box x={430} y={520} w={340} h={56} title={t('Show recipient', 'Показать получателя')} />
    </Diagram>
  )
}

// ---- the flash ----

const PARTITIONS: { name: string; ru: string; size: string; weight: number; filled?: boolean }[] = [
  { name: 'settings', ru: 'настройки', size: '24K', weight: 1.7 },
  { name: 'app data', ru: 'данные', size: '56K', weight: 1.4 },
  { name: 'recovery', ru: 'recovery', size: '896K', weight: 2.4, filled: true },
  { name: 'firmware', ru: 'прошивка', size: '2M', weight: 3.2, filled: true },
  { name: 'app code', ru: 'код', size: '320K', weight: 1.6 },
  { name: 'app files', ru: 'файлы', size: '640K', weight: 2 },
  { name: 'fonts', ru: 'шрифты', size: '64K', weight: 1.4 },
]

export function FlashDiagram() {
  const t = useT()
  const width = 760
  const total = PARTITIONS.reduce((sum, part) => sum + part.weight, 0)
  const lefts = PARTITIONS.map((_, index) =>
    PARTITIONS.slice(0, index).reduce((sum, part) => sum + (part.weight / total) * width, 0),
  )
  return (
    <Diagram
      width={width}
      height={120}
      label={t('Main flash partitions, not to scale', 'Основные разделы флеш, без масштаба')}
    >
      {PARTITIONS.map((part, index) => {
        const w = (part.weight / total) * width
        const x = lefts[index]
        return (
          <g key={part.name}>
            <rect x={x} y={20} width={w} height={60} fill={part.filled ? INK : PAPER} stroke={INK} strokeWidth={1.5} />
            <text x={x + w / 2} y={46} textAnchor="middle" fontSize={13} fill={part.filled ? PAPER : INK}>
              {t(part.name, part.ru)}
            </text>
            <text x={x + w / 2} y={64} textAnchor="middle" fontSize={11} fill={part.filled ? '#b9b5ad' : DIM}>
              {part.size}
            </text>
          </g>
        )
      })}
      <text x={width / 2} y={104} fontSize={11} fill={DIM} textAnchor="middle">
        {t('Not to scale. Bootloader and service areas: another 48 KiB.', 'Без масштаба. Загрузчик и служебные области: ещё 48 КиБ.')}
      </text>
    </Diagram>
  )
}

// ---- the wiring ----

const PANEL_PINS: [string, string][] = [
  ['VCC', '3V3'],
  ['GND', 'GND'],
  ['DIN', 'D10'],
  ['CLK', 'D8'],
  ['CS', 'D7'],
  ['DC', 'D5'],
  ['RST', 'D4'],
  ['BUSY', 'D6'],
]

const BUTTON_PINS: [string, string][] = [
  ['1 UP', 'D0'],
  ['2 OK', 'D1'],
  ['3 DOWN', 'D2'],
  ['4 BACK', 'D3'],
  ['V', '3V3'],
  ['G', 'GND'],
]

export function WiringDiagram() {
  const t = useT()
  const row = 30
  const top = 56
  const parts = [
    { name: 'Waveshare 4.2" V2', pins: PANEL_PINS },
    { name: t('Buttons 4P', 'Кнопки 4P'), pins: BUTTON_PINS },
  ]
  return (
    <div className="wiring-diagrams">
      {parts.map(({ name, pins }) => {
        const height = top + row * pins.length
        return (
          <Diagram key={name} width={360} height={height + 10} label={`${name} - XIAO ESP32-C6`}>
            <rect x={10} y={10} width={160} height={height - 10} fill={PAPER} stroke={INK} strokeWidth={1.5} />
            <text x={90} y={32} textAnchor="middle" fontSize={13}>
              {name}
            </text>
            <rect x={230} y={10} width={120} height={height - 10} fill={INK} stroke={INK} strokeWidth={1.5} />
            <text x={290} y={32} textAnchor="middle" fontSize={13} fill={PAPER}>
              XIAO ESP32-C6
            </text>
            {pins.map(([pin, xiao], index) => {
              const y = top + index * row
              return (
                <g key={pin}>
                  <text x={24} y={y + 4} fontSize={14}>{pin}</text>
                  <line x1={170} y1={y} x2={230} y2={y} stroke={INK} strokeWidth={1.5} />
                  <text x={244} y={y + 4} fontSize={14} fill={PAPER}>{xiao}</text>
                </g>
              )
            })}
          </Diagram>
        )
      })}
    </div>
  )
}
