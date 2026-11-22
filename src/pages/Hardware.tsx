import { Link } from 'react-router-dom'
import { Chapter, DocBody, Facts, PageHead, Table } from '../components/Doc'
import { GuideNav } from '../components/GuideNav'
import { WiringDiagram } from '../components/Diagrams'
import { Render } from '../components/Pictures'
import { useLocal, useT } from '../i18n'

const CHAPTERS = [
  { id: 'overview', en: 'Overview', ru: 'Обзор' },
  { id: 'parts', en: 'Parts', ru: 'Детали' },
  { id: 'constraints', en: 'Before assembly', ru: 'Перед сборкой' },
  { id: 'printing', en: 'Printed parts', ru: 'Детали корпуса' },
  { id: 'wiring', en: 'Wiring', ru: 'Схема сборки' },
  { id: 'assembly', en: 'Assembly', ru: 'Сборка' },
  { id: 'fasteners', en: 'Fasteners', ru: 'Крепёж' },
]

export function Hardware() {
  const t = useT()
  const local = useLocal()
  const chapters = CHAPTERS.map((one) => ({ id: one.id, title: t(one.en, one.ru) }))
  const [overview, parts, constraints, printing, wiring, assembly, fasteners] =
    chapters
  return (
    <>
      <PageHead title="Hardware" />
      <DocBody chapters={chapters}>
        <Chapter chapter={overview}>
          <Render name="front34r" alt={t('The device, front right view', 'Устройство спереди справа')} />
          <Facts
            rows={[
              [t('Size', 'Размер'), t('111.5 x 103.5 x 86.5 mm with the feet', '111.5 x 103.5 x 86.5 мм с ножками')],
              [t('Board', 'Плата'), 'Seeed Studio XIAO ESP32-C6'],
              [t('Display', 'Экран'), t('Waveshare 4.2" e-Paper Module V2, 400 x 300 pixels', 'Waveshare 4.2" e-Paper Module V2, 400 x 300 точек')],
              [t('Battery', 'Аккумулятор'), t('Li-Ion 3.7 V, charges over USB-C', 'Li-Ion 3.7 В, заряжается по USB-C')],
              [t('Screws', 'Винты'), 'M2.5'],
              [t('Tools', 'Инструменты'), t('Soldering iron, screwdriver, FDM printer', 'Паяльник, отвёртка, FDM-принтер')],
            ]}
          />
        </Chapter>

        <Chapter chapter={parts}>
          <Table
            head={[t('Part', 'Деталь'), t('Model', 'Модель'), t('Qty', 'Кол-во'), t('Notes', 'Примечание')]}
            rows={[
              [t('Microcontroller', 'Микроконтроллер'), 'Seeed Studio XIAO ESP32-C6', '1', t('Has a battery charger and an antenna connector', 'Со встроенной зарядкой и разъёмом антенны')],
              [t('Display', 'Экран'), 'Waveshare 4.2inch e-Paper Module, V2 (SSD1683)', '1', t('Version 2 only', 'Только версия 2')],
              [t('Antenna', 'Антенна'), 'Seeed FPC Antenna A-01, 2.4/5 GHz', '1', t('Flat antenna with an 80 mm cable', 'Плоская, кабель 80 мм')],
              [t('Buttons', 'Кнопки'), '"Independent key switch module 4P"', '1', t('A small board with four buttons, sold under this name', 'Плата с четырьмя кнопками, продаётся под этим названием')],
              [t('Battery', 'Аккумулятор'), t('Li-Ion/LiPo 3.7 V, size code 955465, 4000 mAh', 'Li-Ion/LiPo 3.7 В, типоразмер 955465, 4000 мАч'), '1', t('With a protection board', 'С платой защиты')],
              [t('Screws', 'Винты'), 'M2.5 x 4', '5', t('3 display to frame, 2 back panel', '3 экран к рамке, 2 задняя панель')],
              [t('Screws', 'Винты'), 'M2.5 x 6', '9', t('4 bottom to cover, 4 base to back panel, 1 display corner', '4 дно к основанию, 4 основание к задней панели, 1 угол экрана')],
              [t('Wire', 'Провод'), t('Thin hook-up wire', 'Тонкий монтажный'), t('~0.3 m', '~0.3 м'), t('Buttons and battery', 'Кнопки и аккумулятор')],
              [t('Heat shrink tube', 'Термоусадка'), t('1.5-2 mm', '1.5-2 мм'), t('~0.1 m', '~0.1 м'), t('Insulating soldered joints', 'Изоляция мест пайки')],
              [t('Tape', 'Скотч'), t('Thin double-sided', 'Тонкий двусторонний'), '-', t('Antenna and battery', 'Антенна и аккумулятор')],
            ]}
          />
        </Chapter>

        <Chapter chapter={constraints}>
          <h3>{t('Display', 'Экран')}</h3>
          <ul>
            <li>{t('Only version 2 of the display works: look for the V2 sticker on the back.', 'Подходит только вторая версия экрана: на обороте наклейка V2.')}</li>
            <li>{t('Unscrew the brass spacers: the display is screwed straight to the frame.', 'Открутите латунные стойки: экран крепится прямо к рамке.')}</li>
            <li>{t('Plug in the display cable first: the connector cannot be reached once the display is in place.', 'Сначала подключите шлейф: когда экран на месте, до разъёма не добраться.')}</li>
            <li>{t('Do not bend the thin ribbon at the glass edge sharply.', 'Не перегибайте тонкий шлейф у края стекла.')}</li>
          </ul>
          <h3>{t('Board', 'Плата')}</h3>
          <ul>
            <li>{t('The USB-C port goes into the opening in the right wall.', 'Разъём USB-C входит в окно в правой стенке.')}</li>
            <li>{t('The battery pads are on the underside of the board.', 'Площадки аккумулятора на нижней стороне платы.')}</li>
          </ul>
          <h3>{t('Battery', 'Аккумулятор')}</h3>
          <ul>
            <li>{t('Use a battery with a protection board: the XIAO does not protect the battery from deep discharge.', 'Нужен аккумулятор с платой защиты: XIAO не защищает его от глубокого разряда.')}</li>
            <li>{t('The battery compartment fits up to 70 x 54 x 12.5 mm.', 'Отсек вмещает аккумулятор до 70 x 54 x 12.5 мм.')}</li>
          </ul>
          <h3>{t('Buttons', 'Кнопки')}</h3>
          <ul>
            <li>{t('The board sits on two pins in the bottom, solder pads towards the XIAO.', 'Плата садится на два штыря в дне, площадками к XIAO.')}</li>
            <li>{t('The caps fit standard 6 x 6 mm buttons.', 'Колпачки под стандартные кнопки 6 x 6 мм.')}</li>
          </ul>
        </Chapter>

        <Chapter chapter={printing}>
          <p>{t('Download the case files and print the parts.', 'Скачайте файлы корпуса и распечатайте детали.')}</p>
          <div className="buttons">
            <Link className="button" to={local('/hardware/print')}>
              {t('Print files', 'Файлы для печати')} <span className="arrow">-&gt;</span>
            </Link>
          </div>
        </Chapter>

        <Chapter chapter={wiring}>
          <WiringDiagram />
          <Table
            head={[t('Wire', 'Провод'), t('Pin on the XIAO', 'Пин на XIAO')]}
            rows={[
              [t('Display VCC, GND', 'Экран VCC, GND'), '3V3, GND'],
              [t('Display DIN, CLK', 'Экран DIN, CLK'), 'D10, D8'],
              [t('Display CS, DC', 'Экран CS, DC'), 'D7, D5'],
              [t('Display RST, BUSY', 'Экран RST, BUSY'), 'D4, D6'],
              [t('Buttons 1, 2, 3, 4', 'Кнопки 1, 2, 3, 4'), 'D0, D1, D2, D3'],
              [t('Buttons V, G (power)', 'Кнопки V, G (питание)'), t('3V3, GND: soldered to the display\'s VCC and GND wires', '3V3, GND: пайкой с проводами VCC и GND экрана')],
              [t('Battery +, -', 'Аккумулятор +, -'), t('BAT+, BAT- pads under the board', 'Площадки BAT+, BAT- под платой')],
              [t('Antenna', 'Антенна'), t('Antenna connector', 'Разъём антенны')],
            ]}
          />
        </Chapter>

        <Chapter chapter={assembly}>
          <ol className="steps">
            <li>
              <h3>{t('Print', 'Печать')}</h3>
              <p>{t('Print the case from the ready-oriented 3MF files. If using TPU feet, press them into the bottom.', 'Напечатайте корпус из 3MF с готовой ориентацией деталей. Если нужны ножки из TPU, вдавите их в дно.')}</p>
            </li>
            <li>
              <h3>{t('Mount the display', 'Экран')}</h3>
              <p>
                {t(
                  'Unscrew the spacers, plug in the cable and put the display into the frame from the back. Viewed from behind, the bottom left corner takes an M2.5 x 6 screw through the bracket. Use M2.5 x 4 screws for the other three corners.',
                  'Открутите стойки, подключите шлейф и вставьте экран в рамку сзади. Если смотреть сзади, в левом нижнем углу установите уголок и винт M2.5 x 6. В остальных трёх углах: M2.5 x 4.',
                )}
              </p>
            </li>
            <li>
              <h3>{t('Solder', 'Пайка')}</h3>
              <p>
                {t(
                  'Before installing the XIAO, solder the display and buttons as in the wiring table, with button wires no longer than 35 mm. Solder the battery wires to BAT+ and BAT- on the underside of the XIAO.',
                  'До установки XIAO припаяйте экран и кнопки по схеме сборки, провода кнопок не длиннее 35 мм. Провода аккумулятора припаяйте к BAT+ и BAT- на нижней стороне XIAO.',
                )}
              </p>
            </li>
            <li>
              <h3>{t('Install the board, buttons and battery', 'Плата, кнопки и аккумулятор')}</h3>
              <p>
                {t(
                  'Put the XIAO on its two supports with USB-C in the opening of the right wall and the button board on its pins. Secure the battery in its compartment with thin double-sided tape.',
                  'Поставьте XIAO на две опоры разъёмом USB-C в окно правой стенки, плату кнопок на её штыри. Закрепите аккумулятор в отсеке тонким двусторонним скотчем.',
                )}
              </p>
            </li>
            <li>
              <h3>{t('Antenna', 'Антенна')}</h3>
              <p>
                {t(
                  'Stick the antenna inside the base cover, away from the battery, and plug it into the XIAO. The standard firmware uses the ceramic antenna. To use the external antenna, build with APP_ANTENNA_EXTERNAL enabled.',
                  'Приклейте антенну внутри крышки основания, подальше от аккумулятора, и подключите к XIAO. Стандартная прошивка использует керамическую антенну. Для внешней антенны соберите прошивку с включённым APP_ANTENNA_EXTERNAL.',
                )}
              </p>
            </li>
            <li>
              <h3>{t('First start', 'Первый запуск')}</h3>
              <p>
                <Link to={local('/flash')}>{t('Install the firmware', 'Установите прошивку')}</Link>
                {t(' and check the display and all four buttons before assembling the case.', ' и проверьте экран и все четыре кнопки до сборки корпуса.')}
              </p>
            </li>
            <li>
              <h3 id="assemble-case">{t('Assemble the case', 'Собрать корпус')}</h3>
              <p>
                {t(
                  'Insert the button caps into the base cover from the inside. Screw the back panel to the frame, the bottom to the base and the base to the back panel.',
                  'Вставьте колпачки кнопок в крышку основания изнутри. Привинтите заднюю панель к рамке, дно к основанию и основание к задней панели.',
                )}
              </p>
            </li>
          </ol>
        </Chapter>

        <Chapter chapter={fasteners}>
          <Table
            head={[t('Where', 'Где'), t('Screw', 'Винт'), t('Qty', 'Кол-во'), t('Note', 'Примечание')]}
            rows={[
              [t('Display to frame, three corners', 'Экран к рамке, три угла'), 'M2.5 x 4', '3', ''],
              [t('Display, bottom left viewed from behind', 'Экран, левый нижний угол при взгляде сзади'), 'M2.5 x 6', '1', t('No longer than 6 mm', 'Не длиннее 6 мм')],
              [t('Back panel to frame', 'Задняя панель к рамке'), 'M2.5 x 4', '1', t('No longer than 4 mm', 'Не длиннее 4 мм')],
              [t('Back panel to corner bracket', 'Задняя панель к уголку'), 'M2.5 x 4', '1', ''],
              [t('Bottom to base', 'Дно к основанию'), 'M2.5 x 6', '4', t('Up to 8 mm', 'До 8 мм')],
              [t('Base to back panel', 'Основание к задней панели'), 'M2.5 x 6', '4', t('No longer than 6 mm', 'Не длиннее 6 мм')],
            ]}
          />
        </Chapter>

        <GuideNav
          id="flashing"
          previous={{ to: '/start', label: t('Getting started', 'Начало работы') }}
        />

      </DocBody>
    </>
  )
}
