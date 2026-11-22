import { Facts, PageHead, Table } from '../components/Doc'
import { author, files, repo } from '../content/links'
import { useT } from '../i18n'

const BASE = import.meta.env.BASE_URL

export function Credits() {
  const t = useT()
  return (
    <>
      <PageHead title={t('Credits', 'Лицензии')} />
      <div className="wrap page-body single">
        <div className="doc">
          <section>
            <h2>{t('The project', 'Проект')}</h2>
            <Facts
              rows={[
                [t('Author', 'Автор'), author.name],
                [t('License', 'Лицензия'), <a href={files.license}>MIT</a>],
                ['Firmware, SDK, hardware', <a href={repo.firmware}>perinkpheral-os</a>],
                [t('Applications', 'Приложения'), <a href={repo.apps}>perinkpheral-apps</a>],
              ]}
            />
          </section>

          <section>
            <h2>{t('In the firmware', 'В прошивке')}</h2>
            <Table
              head={[t('Component', 'Компонент'), t('Author', 'Автор'), t('License', 'Лицензия')]}
              rows={[
                [<a href="https://github.com/espressif/esp-idf">ESP-IDF</a>, 'Espressif Systems', 'Apache License 2.0'],
                [<a href="https://github.com/wasm3/wasm3">Wasm3</a>, 'Steven Massey, Volodymyr Shymanskyy', 'MIT'],
                [<a href="https://github.com/Mbed-TLS/mbedtls">Mbed TLS</a>, 'The Mbed TLS Contributors', 'Apache License 2.0'],
                [<a href="https://github.com/littlefs-project/littlefs">LittleFS</a>, 'Arm Limited', 'BSD 3-Clause'],
                [<a href="https://github.com/joltwallet/esp_littlefs">esp_littlefs</a>, 'Brian Pugh', 'MIT'],
                [<a href="https://github.com/espressif/esp-protocols">mDNS</a>, 'Espressif Systems', 'Apache License 2.0'],
                [<a href="https://github.com/nayuki/QR-Code-generator">QR Code generator</a>, 'Project Nayuki', 'MIT'],
              ]}
            />
          </section>

          <section>
            <h2>{t('Typefaces', 'Шрифты')}</h2>
            <Table
              head={[t('Typeface', 'Шрифт'), t('Author', 'Автор'), t('License', 'Лицензия')]}
              rows={[
                [
                  <a href="https://github.com/rektdeckard/departure-mono">Departure Mono</a>,
                  'Helena Zhang',
                  <a href={`${BASE}licenses/OFL-DepartureMono.txt`}>SIL Open Font License 1.1</a>,
                ],
                [
                  <a href="https://github.com/scfried/soft-type-jersey">Jersey</a>,
                  t('The Soft Type Project Authors; Cyrillic added', 'The Soft Type Project Authors; кириллица добавлена'),
                  <a href={`${BASE}licenses/OFL-Jersey.txt`}>SIL Open Font License 1.1</a>,
                ],
              ]}
            />
          </section>

          <section>
            <h2>Hardware</h2>
            <Table
              head={[t('Part', 'Деталь'), t('Maker', 'Производитель')]}
              rows={[
                ['XIAO ESP32-C6', 'Seeed Studio'],
                ['4.2inch e-Paper Module V2', 'Waveshare'],
                ['FPC Antenna A-01', 'Seeed Studio'],
              ]}
            />
          </section>

          <section>
            <h2>{t('Data sources of the official applications', 'Источники данных официальных приложений')}</h2>
            <Table
              head={[t('Source', 'Источник'), t('Used by', 'Где используется')]}
              rows={[
                [<a href="https://open-meteo.com">Open-Meteo</a>, 'weather, air'],
                [<a href="https://finance.yahoo.com">Yahoo Finance</a>, 'stocks'],
                [<a href="https://www.moex.com">{t('Moscow Exchange', 'Московская биржа')}</a>, 'stocks'],
                ['Where the ISS at?', 'iss'],
                ['CBR-XML-Daily', 'rates'],
                ['Bank of Russia', 'rates, metals'],
                [t('User-selected Statuspage services', 'Сервисы Statuspage, выбранные пользователем'), 'status'],
                [t('User-selected calendar provider', 'Поставщик календаря, выбранный пользователем'), 'calendar'],
                [t("User's Home Assistant instance", 'Экземпляр Home Assistant пользователя'), 'ha'],
                [<a href="https://photon.komoot.io">Photon</a>, t('device web UI: place search', 'страница устройства: поиск места')],
                [<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, t('place data for Photon, ODbL', 'данные мест для Photon, ODbL')],
              ]}
            />
          </section>

          <section>
            <h2>{t('Tools', 'Инструменты')}</h2>
            <Table
              head={[t('Tool', 'Инструмент'), t('Use', 'Назначение')]}
              rows={[
                [<a href="https://github.com/WebAssembly/wasi-sdk">wasi-sdk</a>, t('Application compiler', 'Компилятор приложений')],
                [<a href="https://kotlinlang.org">Kotlin</a>, t('SDK tools and CLion plugin', 'Инструменты SDK и плагин CLion')],
                [<a href="https://www.blender.org">Blender</a>, t('Enclosure renders', 'Рендеры корпуса')],
                [<a href="https://www.autodesk.com/products/fusion-360">Fusion</a>, t('Enclosure model', 'Модель корпуса')],
                [<a href="https://react.dev">React</a>, t('This site, with Vite and Sass', 'Этот сайт, вместе с Vite и Sass')],
              ]}
            />
          </section>
        </div>
      </div>
    </>
  )
}
