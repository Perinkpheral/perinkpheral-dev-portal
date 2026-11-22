import { Link } from 'react-router-dom'
import { Chapter, DocBody, Facts, PageHead } from '../components/Doc'
import { DeliveryDiagram, FlashDiagram, LayersDiagram } from '../components/Diagrams'
import { files, repo } from '../content/links'
import { useLocal, useT } from '../i18n'

const CHAPTERS = [
  { id: 'overview', en: 'Overview', ru: 'Обзор' },
  { id: 'architecture', en: 'Architecture', ru: 'Архитектура OS' },
  { id: 'delivery', en: 'Data Flow', ru: 'Data Flow' },
  { id: 'storage', en: 'Storage', ru: 'Хранилище' },
  { id: 'network', en: 'Network and updates', ru: 'Сеть и обновления' },
  { id: 'api', en: 'Web API', ru: 'Web API' },
]

export function Firmware() {
  const t = useT()
  const local = useLocal()
  const chapters = CHAPTERS.map((one) => ({ id: one.id, title: t(one.en, one.ru) }))
  const [overview, architecture, delivery, storage, network, api] = chapters
  return (
    <>
      <PageHead title="Firmware" />
      <DocBody chapters={chapters}>
        <Chapter chapter={overview}>
          <Facts
            rows={[
              [t('Chip', 'Микроконтроллер'), 'ESP32-C6'],
              [t('Apps', 'Приложения'), t('Up to 24', 'До 24')],
              [t('Network', 'Сеть'), 'Wi-Fi 6, HTTP, HTTPS'],
              [t('Updates', 'Обновления'), t('Over Wi-Fi', 'По Wi-Fi')],
              [t('Languages', 'Языки'), t('English, Russian', 'Английский, русский')],
              [t('Source', 'Исходный код'), <a href={repo.firmware}>Perinkpheral/perinkpheral-os</a>],
            ]}
          />
        </Chapter>

        <Chapter chapter={architecture}>
          <LayersDiagram />
        </Chapter>

        <Chapter chapter={delivery}>
          <DeliveryDiagram />
        </Chapter>

        <Chapter chapter={storage}>
          <FlashDiagram />
        </Chapter>

        <Chapter chapter={network}>
          <Facts
            rows={[
              [t('First setup', 'Первый запуск'), t('From a phone, over the device’s own Wi-Fi', 'С телефона, через Wi-Fi устройства')],
              [t('Firmware updates', 'Обновление прошивки'), t('From the device’s web page', 'Со страницы устройства')],
              [t('Confirmation', 'Подтверждение'), t('OK on the recovery screen', 'OK на экране recovery')],
            ]}
          />
          <p>{t(
            'The page downloads the firmware, then restarts the device into recovery. The screen shows preparation, then asks you to press OK to install. Settings and apps are kept.',
            'Страница скачивает прошивку и перезапускает устройство в recovery. Экран показывает подготовку, затем просит нажать OK для установки. Настройки и приложения сохраняются.',
          )}</p>
          <p>{t(
            'A new image must start its web server and join saved Wi-Fi within three minutes. With no saved network, its setup access point must be up after 20 seconds of uptime. With Wi-Fi deliberately disabled, the web server and 20 seconds of uptime suffice. Otherwise the device returns to recovery. The previous firmware is not kept. A later network outage does not trigger recovery.',
            'Новый образ должен запустить веб-сервер и подключиться к сохранённой сети Wi-Fi в течение трёх минут. Без сохранённой сети после 20 секунд работы должна быть включена точка доступа настройки. При намеренно отключённом Wi-Fi достаточно веб-сервера и 20 секунд работы. Иначе устройство возвращается в recovery. Предыдущая прошивка не сохраняется. Последующая потеря сети не вызывает переход в recovery.',
          )}</p>
          <p>{t(
            'Moving from the old two-slot firmware needs USB once. In the browser flasher, choose Keep data. It checks the existing layout before writing. After installation, press BACK on the recovery screen to start the firmware.',
            'Для перехода со старой прошивки с двумя слотами один раз нужен USB. В прошивальщике выберите «Сохранить данные». Он проверит разметку перед записью. После установки нажмите BACK на экране recovery для запуска прошивки.',
          )} <Link to={local('/flash')}>{t('Open flasher', 'Открыть прошивальщик')}</Link></p>
          <p>{t(
            'To enter recovery manually, choose Device → Enter recovery on the web page, or hold BACK while restarting and keep it held for three seconds.',
            'Чтобы войти в recovery вручную, выберите Device → Enter recovery на веб-странице или держите BACK при перезапуске и ещё три секунды после него.',
          )}</p>
          <p>{t(
            'If the main firmware does not answer, hold UP and BACK for ten seconds to restart, then keep BACK held for another three seconds. This restart combination is available in the main firmware, not in recovery.',
            'Если основная прошивка не отвечает, держите UP и BACK десять секунд для перезапуска, затем продолжайте держать BACK ещё три секунды. Эта комбинация перезапуска работает в основной прошивке, но не в recovery.',
          )}</p>
          <p>{t(
            'Recovery always opens the perink-recovery Wi-Fi network with its page at 192.168.4.1, and also connects to saved Wi-Fi when available. Its page accepts a main firmware .bin file.',
            'Recovery всегда открывает сеть perink-recovery со страницей по адресу 192.168.4.1 и также подключается к сохранённому Wi-Fi, когда он доступен. На странице можно загрузить .bin основной прошивки.',
          )}</p>
          <p>{t(
            'With saved Wi-Fi, recovery allows up to 30 seconds for connection: planned updates show preparation, and manual recovery shows Connecting until connected. Without saved Wi-Fi, connection instructions appear immediately. An active upload keeps the preparation screen until confirmation.',
            'При сохранённой сети recovery отводит до 30 секунд на подключение: запланированное обновление показывает подготовку, ручной вход - подключение до его завершения. Без сохранённой сети инструкции подключения появляются сразу. Во время загрузки экран подготовки сохраняется до подтверждения.',
          )}</p>
          <p>{t(
            'BACK, labelled Exit recovery, attempts to start the installed main firmware. A damaged image must be replaced first.',
            'BACK с подписью «Выйти из recovery» пытается запустить установленную основную прошивку. Повреждённый образ сначала нужно заменить.',
          )}</p>
          <p>{t(
            'OTA updates only the main firmware. Updating recovery itself requires USB: choose Keep data in the browser flasher to update both images while preserving settings and apps.',
            'OTA обновляет только основную прошивку. Для обновления самого recovery нужен USB: выберите «Сохранить данные» в прошивальщике, чтобы обновить оба образа, сохранив настройки и приложения.',
          )}</p>
          <p>{t(
            'From a local firmware build, idf.py -p PORT recovery-flash writes only recovery; update the main image separately when both have changed.',
            'Из локальной сборки команда idf.py -p PORT recovery-flash записывает только recovery; если изменились оба образа, основную прошивку обновите отдельно.',
          )}</p>
        </Chapter>

        <Chapter chapter={api}>
          <p>
            <a href={files.openapi}>OpenAPI specification</a>
          </p>
        </Chapter>
      </DocBody>
    </>
  )
}
