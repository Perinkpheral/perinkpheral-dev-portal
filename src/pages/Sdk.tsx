import { Chapter, Code, DocBody, Facts, PageHead, Table } from '../components/Doc'
import { Carousel } from '../components/Pictures'
import { files, repo } from '../content/links'
import { useT } from '../i18n'

const KIT = [
  { name: 'kit-parts', en: 'Text, icons, value, bar', ru: 'Текст, иконки, значение, шкала' },
  { name: 'kit-list', en: 'List', ru: 'Список' },
  { name: 'kit-options', en: 'Options', ru: 'Варианты' },
  { name: 'stocks', en: 'Chart', ru: 'График' },
  { name: 'kit-picker', en: 'Picker', ru: 'Выбор значения' },
  { name: 'kit-date', en: 'Date and time', ru: 'Дата и время' },
  { name: 'kit-time', en: 'Time', ru: 'Время' },
  { name: 'kit-message', en: 'Message', ru: 'Сообщение' },
  { name: 'kit-question', en: 'Question', ru: 'Вопрос' },
  { name: 'kit-working', en: 'Work in progress', ru: 'Ожидание' },
]

const CHAPTERS = [
  { id: 'overview', en: 'Overview', ru: 'Обзор' },
  { id: 'start', en: 'Getting started', ru: 'Начало работы' },
  { id: 'application', en: 'Example', ru: 'Пример' },
  { id: 'manifest', en: 'The manifest', ru: 'Манифест' },
  { id: 'model', en: 'Handlers and state', ru: 'Обработчики и состояние' },
  { id: 'data', en: 'Network data', ru: 'Данные из сети' },
  { id: 'kit', en: 'Graphics and UI kit', ru: 'Графика и UI kit' },
  { id: 'limits', en: 'Limits', ru: 'Ограничения' },
  { id: 'tools', en: 'Tools', ru: 'Инструменты' },
  { id: 'clion', en: 'CLion plugin', ru: 'Плагин CLion' },
  { id: 'publishing', en: 'Publishing', ru: 'Публикация' },
  { id: 'reference', en: 'Reference', ru: 'Справка' },
]

const HELLO = `
#include "app_text.h"
#include "host_api.h"

static const char PRESSES_KEY[] = "presses";
static int32_t presses;

void app_on_load(void)
{
    /* Restore state: Perinkpheral OS unloads the application
     * when it leaves the screen. */
    kv_get(PRESSES_KEY, sizeof PRESSES_KEY - 1, &presses, sizeof presses);
}

void app_on_terminate(void)
{
    kv_set(PRESSES_KEY, sizeof PRESSES_KEY - 1, &presses, sizeof presses);
}

void app_on_button(int32_t event)
{
    if (event == BTN_OK_PRESSED) {
        presses++;
        screen_redraw(HOST_REDRAW_NORMAL);
    }
}

void app_on_draw(void)
{
    char line[32];
    app_text_t text;
    app_text_start(&text, line, sizeof line);
    app_text_add(&text, "Presses: ");
    app_text_add_number(&text, presses);

    gfx_draw_text(HOST_UI_MARGIN, HOST_UI_MARGIN, HOST_FONT_TEXT, "Hello from wasm", 15);
    gfx_draw_text(HOST_UI_MARGIN, 60, HOST_FONT_TEXT, line, app_text_length(line));
}
`

const MANIFEST = `
{
  "name": "weather",
  "title": "Weather",
  "author": "Your name",
  "version": "0.2.5",
  "abi": 3,
  "format": "json",
  "settings": [
    { "key": "city", "type": "place", "title": "City",
      "latitude": "lat", "longitude": "lon" },
    { "key": "lat", "type": "number", "title": "Latitude" },
    { "key": "lon", "type": "number", "title": "Longitude" },
    { "key": "every", "type": "choice", "title": "Update interval",
      "options": ["15 min", "30 min", "1 hour", "3 hours"] }
  ],
  "polls": [
    {
      "url": "https://api.open-meteo.com/v1/forecast?latitude={{lat}}&longitude={{lon}}&current=temperature_2m,weather_code",
      "every": "{{every}}",
      "pick": ["current.temperature_2m", "current.weather_code"]
    }
  ]
}
`

const VALUES = `
void app_on_picked(int32_t poll, int32_t http_status)
{
    /* Values of the "pick" paths, in order. 1 decimal: tenths. */
    int32_t temperature, code;
    if (poll == 0 && http_status == 200 &&
        app_value_number(0, 1, &temperature) &&
        app_value_number(1, 0, &code)) {
        state.temperature = temperature;
        state.code = code;
        app_state_save("state", &state, sizeof state);
        screen_redraw(HOST_REDRAW_NORMAL);
    }
}
`

const POLL_FORMATS = `
{
  "polls": [
    { "url": "https://media.example.test/by-type", "every": 60 },
    { "url": "https://media.example.test/search", "every": 60,
      "method": "POST", "format": "xml",
      "headers": { "Content-Type": "application/xml" },
      "body": "<Query limit=\\"1\\"/>" },
    { "url": "https://media.example.test/sessions", "every": 60,
      "format": "json", "pick": ["[0].NowPlayingItem.Name"] },
    { "url": "https://media.example.test/untyped", "every": 60 }
  ]
}
`

export function Sdk() {
  const t = useT()
  const chapters = CHAPTERS.map((one) => ({ id: one.id, title: t(one.en, one.ru) }))
  const [overview, start, application, manifest, model, data, kit, limits, tools, clion, publishing, reference] =
    chapters
  return (
    <>
      <PageHead title="SDK" />
      <DocBody chapters={chapters}>
        <Chapter chapter={overview}>
          <Facts
            rows={[
              [t('Language', 'Язык'), t('C, compiled to WebAssembly', 'C, компилируется в WebAssembly')],
              ['ABI', '3 · firmware 0.1.30+'],
              ['API', <a href={files.hostApi}>sdk/host_api.h</a>],
              [t('Memory', 'Память'), t('Up to 64 KiB of linear memory per app', 'До 64 КиБ линейной памяти на приложение')],
              [t('Numbers', 'Числа'), t('No floating point; decimals as fixed-point numbers', 'Без плавающей точки; дробные - числами с фиксированной точкой')],
              [t('Package', 'Пакет'), t('app.wasm, manifest.json, translations, pictures, files', 'app.wasm, manifest.json, переводы, картинки, файлы')],
            ]}
          />
        </Chapter>

        <Chapter chapter={start}>
          <ol className="steps">
            <li>
              <h3>{t('Install the toolchain', 'Тулчейн')}</h3>
              <p>{t('wasi-sdk (verified with 34), Java 21 or later, Git. The simulator also needs a C compiler and Make.', 'wasi-sdk (проверено с 34), Java 21 или новее, Git. Для симулятора также нужны компилятор C и Make.')}</p>
              <Code label="shell">{`
git clone ${repo.firmware}.git
cd perinkpheral-os
export WASI_SDK_PATH="<wasi-sdk directory>"
tools/perinkpheral
`}</Code>
            </li>
            <li>
              <h3>{t('Create an application', 'Новое приложение')}</h3>
              <Code label="shell">{`tools/perinkpheral new ../myapp --author "Your name" --title "My App"`}</Code>
            </li>
            <li>
              <h3>{t('Build', 'Сборка')}</h3>
              <Code label="shell">{`tools/perinkpheral build ../myapp --out ../myapp/build`}</Code>
            </li>
            <li>
              <h3>{t('Run in the simulator', 'Запуск в симуляторе')}</h3>
              <Code label="shell">{`tools/perinkpheral sim ../myapp`}</Code>
            </li>
            <li>
              <h3>{t('Run on the device', 'Запуск на устройстве')}</h3>
              <p>{t('Install a Debug firmware build for run, screenshots and button control. Replace the example hostname with the address on the second About page.', 'Для run, снимков экрана и управления кнопками нужна прошивка Debug. Замените пример адресом со второй страницы About.')}</p>
              <Code label="shell">{`
export PERINKPHERAL_HOST=perinkpheral-xxxx.local
tools/perinkpheral run ../myapp --shot screen.png
tools/perinkpheral press 2 2 --shot pressed.png
tools/perinkpheral log --follow
`}</Code>
            </li>
          </ol>
        </Chapter>

        <Chapter chapter={application}>
          <Code label="hello.c">{HELLO}</Code>
        </Chapter>

        <Chapter chapter={manifest}>
          <Code label="manifest.json">{MANIFEST}</Code>
          <p>{t('Set author to your name, up to 63 UTF-8 bytes. Perinkpheral is reserved for the official catalog.', 'Укажите своё имя в author: до 63 байт UTF-8. Имя Perinkpheral зарезервировано для официального каталога.')}</p>
          <Table
            head={[t('Key', 'Ключ'), t('Meaning', 'Значение')]}
            rows={[
              [<code>name</code>, t('Unique id: 1-13 ASCII characters, a-z, 0-9, - and _', 'Уникальный id: 1-13 символов, a-z, 0-9, - и _')],
              [<code>title</code>, t('Name in the menu, up to 23 characters', 'Название в меню, до 23 символов')],
              [<code>polls</code>, t('Web requests the device makes on a schedule, up to 4', 'Запросы, которые устройство делает по расписанию, до 4')],
              [<code>hosts</code>, t('Servers allowed for requests from code; manifest polls are exempt', 'Серверы для запросов из кода; запросы манифеста не требуют этого списка')],
              [<code>settings</code>, t('Up to 8. Types: text, secret, number, choice, toggle, place, url, link, list', 'До 8. Типы: text, secret, number, choice, toggle, place, url, link, list')],
              [<code>intents</code>, t('System events to receive: device start, clock change, network back', 'Системные события: запуск устройства, смена времени, появление сети')],
              [<code>icon</code>, t('11 x 11 pixel icon: # black, . white', 'Иконка 11 x 11 точек: # чёрный, . белый')],
              [<code>fullscreen</code>, t('Use the whole screen, without the top bar', 'Весь экран, без верхней строки')],
              [<code>writes_files</code>, t('The app saves files; 32 KB are reserved for it', 'Приложение пишет файлы; под них зарезервировано 32 КБ')],
              [<code>system</code>, t('Access to device settings, clock and apps; the user confirms on install', 'Доступ к настройкам устройства, часам и приложениям; пользователь подтверждает при установке')],
              [<code>certificates</code>, t('Up to two additional CA certificates, PEM or DER, at most 4 KiB each; currently valid and trusted only for this application’s requests.', 'До двух дополнительных сертификатов CA в PEM или DER, не более 4 КиБ каждый; действующих и используемых только для запросов этого приложения.')],
              [<code>companion</code>, t('An HTTPS companion page that supplies settings through the device page; the user saves the resulting form.', 'HTTPS-страница настройки, передающая значения в форму страницы устройства; пользователь сохраняет заполненную форму.')],
              [<code>firmware</code>, t('Minimum firmware version, computed from the ABI floor, imports, exports, recognized manifest features and any higher explicit minimum.', 'Минимальная версия прошивки, вычисляемая по версии ABI, импортам, экспортам, распознаваемым возможностям манифеста и явно указанному более высокому минимуму.')],
            ]}
          />
          <p>{t('Polls default to GET. The method field also accepts POST, PUT, DELETE, PATCH, HEAD, PROPFIND and REPORT. Non-GET methods and bodies require firmware 0.1.80. Bodies are limited to 1024 bytes before and after template expansion; GET and HEAD cannot have a body. Polls can run at startup, after reconnection and through poll_run(), so state-changing endpoints must tolerate repeated requests.', 'По умолчанию используется GET. Поле method также принимает POST, PUT, DELETE, PATCH, HEAD, PROPFIND и REPORT. Методы кроме GET и тела запросов требуют прошивку 0.1.80. Тело ограничено 1024 байтами до и после подстановки значений; GET и HEAD не допускают тела. Опросы могут выполняться при запуске, после восстановления сети и через poll_run(), поэтому изменяющие состояние обработчики должны допускать повторные запросы.')}</p>
        </Chapter>

        <Chapter chapter={model}>
          <Table
            head={[t('Function', 'Функция'), t('Called when', 'Когда вызывается')]}
            rows={[
              [<code>app_on_load()</code>, t('The app starts', 'Приложение запускается')],
              [<code>app_on_focus() / app_on_blur()</code>, t('The app appears on screen or leaves it', 'Приложение появляется на экране или уходит с него')],
              [<code>app_on_terminate()</code>, t('Last call before normal unloading; save persistent state here. Not called after a fault or for light sleep.', 'Последний вызов перед штатной выгрузкой; здесь сохраняют постоянное состояние. После сбоя и при лёгком сне не вызывается.')],
              [<code>app_on_button(event)</code>, t('A button is pressed, released, or held', 'Кнопку нажали, отпустили или удерживают')],
              [<code>app_on_back()</code>, t('A short BACK press. Without this handler, Perinkpheral OS closes the app. Long BACK opens the menu; BACK with UP or DOWN switches applications.', 'Короткое нажатие BACK. Без этого обработчика Perinkpheral OS закрывает приложение. Долгое нажатие BACK открывает меню; BACK вместе с UP или DOWN переключает приложения.')],
              [<code>app_on_draw()</code>, t('The screen needs drawing', 'Нужно нарисовать экран')],
              [<code>app_on_timer(id)</code>, t('A timer fired, while the app is on screen', 'Сработал таймер, пока приложение на экране')],
              [<code>app_on_alarm(id)</code>, t('An alarm fired, even if the app is closed', 'Сработал будильник, даже если приложение закрыто')],
              [<code>app_on_picked(poll, status)</code>, t('Scheduled data arrived, already parsed', 'Пришли данные по расписанию, уже разобранные')],
              [<code>app_on_data(...)</code>, t('A piece of a response arrived', 'Пришла часть ответа')],
              [<code>app_on_settings()</code>, t('The user changed the settings', 'Пользователь изменил настройки')],
              [<code>app_on_intent(type)</code>, t('A system event the app asked for', 'Системное событие, на которое приложение подписано')],
              [<code>app_on_installed() / app_on_updated()</code>, t('First start after install or update', 'Первый запуск после установки или обновления')],
            ]}
          />
          <p>{t('Alarms are cleared by device restarts and application updates; restore them in the started intent and app_on_updated().', 'Перезапуск устройства и обновление приложения удаляют будильники; восстанавливайте их в обработчиках события started и app_on_updated().')}</p>
          <h3>{t('Buttons and state', 'Кнопки и состояние')}</h3>
          <Facts
            rows={[
              [t('Buttons', 'Кнопки'), t('1 up, 2 OK, 3 down, 4 back; hold BACK for the menu', '1 вверх, 2 OK, 3 вниз, 4 назад; удержание BACK открывает меню')],
              [t('Saved data', 'Сохранённые данные'), 'kv_set(), kv_get()'],
            ]}
          />
          <p>{t('Keep persistent data in KV. Save temporary navigation and unfinished edits with session_set() in app_on_blur() and restore them with session_get() in app_on_focus(). Sessions survive unloads while the app remains in the stack; leaving the stack or restarting the device clears them. Sessions hold up to 1024 bytes; using more than 128 bytes requires an explicit firmware minimum of 0.1.61.', 'Постоянные данные храните в KV. Временное состояние навигации и незавершённые изменения сохраняйте через session_set() в app_on_blur() и восстанавливайте через session_get() в app_on_focus(). Сессии сохраняются при выгрузке, пока приложение остаётся в стеке; выход из стека или перезапуск устройства удаляет их. Сессия вмещает до 1024 байт; для объёма более 128 байт явно укажите минимальную прошивку 0.1.61.')}</p>
        </Chapter>

        <Chapter chapter={data}>
          <Facts
            rows={[
              [t('On a schedule', 'По расписанию'), t('Requests in the manifest', 'Запросы в манифесте')],
              [t('On demand', 'По запросу'), t('http_send() from the code', 'http_send() из кода')],
              [t('Ready values', 'Готовые значения'), t('For JSON responses, pick delivers extracted values to app_on_picked()', 'Для ответа JSON поле pick передаёт извлечённые значения в app_on_picked()')],
              [t('Raw response', 'Ответ как есть'), t('app_on_data() gets the bytes piece by piece', 'app_on_data() получает байты ответа частями')],
              [t('Show on screen', 'Показать на экране'), t('screen_request() requests foreground display from a background handler. Refused within 30 seconds of a button press or a previous grant, or while a confirmation question is open. Refused requests are not retried.', 'screen_request() запрашивает вывод приложения из фонового обработчика. Запрос отклоняется в течение 30 секунд после нажатия кнопки или предыдущего разрешения, а также при открытом вопросе подтверждения. Отклонённые запросы не повторяются.')],
            ]}
          />
          <Code label="weather.c">{VALUES}</Code>
          <h3>{t('Response formats', 'Форматы ответов')}</h3>
          <p>{t('From firmware 0.1.100, set format to json, xml or raw in an ABI 3 manifest. A poll can override the application default. Requests from code use the application default.', 'Начиная с прошивки 0.1.100 в манифесте ABI 3 можно указать format со значением json, xml или raw. Формат опроса имеет приоритет над форматом приложения. Запросы из кода используют формат приложения.')}</p>
          <p>{t('Explicit json or xml overrides the response Content-Type. With no format declaration, the response MIME type selects JSON or XML, including +json and +xml subtypes. Unknown or missing MIME types reach app_on_data() unchanged, as do responses explicitly marked raw.', 'Явные json и xml переопределяют Content-Type ответа. Без поля format JSON или XML выбирается по MIME-типу ответа, включая подтипы +json и +xml. При неизвестном или отсутствующем MIME-типе байты передаются в app_on_data() без изменений, как и при явном raw.')}</p>
          <p>{t('Register a 1–12,288 byte buffer with document_buffer_set() in app_on_load() to receive a complete JSON or XML body in app_on_document(). For http_send() and polls without pick, export app_on_data() if the format is raw or omitted. An explicit json or xml format allows app_on_document() alone. When both handlers are present, chunks arrive first in app_on_data(). JSON polls with pick use app_on_picked() exclusively. Set format to json to keep picking from a server that mislabels its JSON.', 'Зарегистрируйте буфер от 1 до 12 288 байт через document_buffer_set() в app_on_load(), чтобы получать целый ответ JSON или XML в app_on_document(). Для http_send() и опросов без pick экспортируйте app_on_data(), если указан raw или формат не задан. При явном json или xml достаточно app_on_document(). Если есть оба обработчика, фрагменты сначала поступают в app_on_data(). Опросы JSON с pick вызывают только app_on_picked(). Чтобы извлекать значения, когда сервер неверно маркирует JSON, задайте format со значением json.')}</p>
          <Code label="manifest.json">{POLL_FORMATS}</Code>
          <p>{t('The example combines Plex-style XML and Jellyfin-style JSON. It shows an automatically detected GET, a read-only XML query sent by POST with a response override, and an unknown MIME type delivered as bytes.', 'Пример сочетает XML в стиле Plex и JSON в стиле Jellyfin. В нём есть GET с автоматическим определением, запрос на чтение XML через POST с переопределением формата ответа и потоковая доставка неизвестного MIME-типа.')}{' '}<a href={files.pollFormats}>{t('Runnable example and tests', 'Рабочий пример и тесты')}</a></p>

        </Chapter>

        <Chapter chapter={kit}>
          <Table
            head={[t('Part', 'Часть'), t('Functions', 'Функции')]}
            rows={[
              [t('Text in four styles', 'Текст в четырёх стилях'), 'ui_draw_text, ui_draw_text_lines, ui_draw_title'],
              [t('List with scroll bar', 'Список с полосой прокрутки'), 'ui_draw_list_row, ui_list_visible'],
              [t('Dialog: text, icon, buttons', 'Диалог: текст, иконка, кнопки'), 'ui_draw_notice'],
              [t('Tile: name, picture, value', 'Плитка: название, картинка, значение'), 'ui_draw_cell, ui_cell_fit'],
              [t('Chart: line, area, bars, steps', 'График: линия, область, столбцы, ступени'), 'ui_draw_chart'],
              [t('Value with unit', 'Значение с единицей'), 'ui_draw_value'],
              [t('Choice of a value, date and time', 'Выбор значения, даты и времени'), 'ui_draw_picker, ui_draw_date'],
              [t('Message while there is nothing to show', 'Сообщение, пока показывать нечего'), 'ui_draw_reason'],
            ]}
          />
          <Carousel screens slides={KIT.map((one) => ({ name: one.name, caption: t(one.en, one.ru) }))} />
        </Chapter>

        <Chapter chapter={limits}>
          <Table
            head={[t('What', 'Что'), t('Limit', 'Предел')]}
            rows={[
              [t('Module file', 'Файл модуля'), t('48 KiB', '48 КиБ')],
              [t('Linear memory', 'Линейная память'), t('Up to 64 KiB: the stack and static data, sized by the build', 'До 64 КиБ: стек и статические данные, размер определяет сборка')],
              [t('Time per call', 'Время на вызов'), '3 s'],
              [t('Saved data', 'Сохранённые данные'), t('2 KiB including settings and storage overhead; at most 1 KiB per value. Each key costs 64 bytes plus its value rounded up to 32 bytes.', '2 КиБ вместе с настройками и накладными расходами; до 1 КиБ на значение. Каждый ключ занимает 64 байта плюс размер значения, округлённый вверх до 32 байт.')],
              [t('Files', 'Файлы'), t('64 KiB for package files, charged in whole 4 KiB blocks per file. Applications that write files share 32 KiB between package and runtime files.', '64 КиБ для файлов пакета; каждый файл учитывается целыми блоками по 4 КиБ. Приложения с записью файлов делят 32 КиБ между файлами пакета и создаваемыми файлами.')],
              [t('Scheduled requests', 'Запросы по расписанию'), t('4, every 10 s to 1 day', '4, от 10 с до суток')],
              [t('Requests waiting', 'Запросов в очереди'), t('At most 16 waiting per app; all apps share a 16 KiB queue budget. One request runs at a time for the device.', 'До 16 ожидающих запросов на приложение; общая очередь всех приложений ограничена 16 КиБ. Устройство выполняет один запрос за раз.')],
              [t('Response size', 'Размер ответа'), t('256 KB parsed, 4 MB piece by piece', '256 КБ с разбором, 4 МБ частями')],
              [t('Settings', 'Настройки'), t('8, values up to 255 bytes', '8, значения до 255 байт')],
              [t('Timers and alarms', 'Таймеры и будильники'), t('4 and 4', '4 и 4')],
              [t('Apps on a device', 'Приложений на устройстве'), t('Up to 24, while there is space', 'До 24, пока хватает места')],
            ]}
          />
          <p>{t(
            'The application’s memory and the interpreter’s share one 112 KiB area reserved at startup: what an app does not use for data is room for its code. If the estimate exceeds 64 KiB and the minimum firmware version is older than 0.1.95, the build warns about compatibility. If your app needs the larger arena, declare firmware 0.1.95 in its manifest.',
            'Память приложения и память интерпретатора делят одну область размером 112 КиБ, резервируемую при запуске: то, что приложение не занимает данными, достаётся его коду. Если оценка превышает 64 КиБ, а минимальная версия прошивки ниже 0.1.95, сборка предупреждает о совместимости. Если приложению нужна увеличенная арена, укажите версию прошивки 0.1.95 в его манифесте.',
          )}</p>
          <p>{t(
            'The build separately warns when the memory and the code estimate together exceed the 112 KiB area, regardless of the minimum firmware version. Check the build’s memory report and verify interpreter headroom on a device.',
            'Если память и оценка кода вместе превышают область в 112 КиБ, сборка выдаёт отдельное предупреждение независимо от минимальной версии прошивки. Проверяйте отчёт сборки о памяти и запас памяти интерпретатора на устройстве.',
          )}</p>
        </Chapter>

        <Chapter chapter={tools}>
          <Table
            head={[t('Command', 'Команда'), t('Description', 'Описание')]}
            rows={[
              [<code>new &lt;dir&gt; --author NAME</code>, t('Start a new app', 'Новое приложение')],
              [<code>build &lt;app&gt; --out &lt;dir&gt;</code>, t('Build and check', 'Собрать и проверить')],
              [<code>sim &lt;app&gt;</code>, t('Run in the simulator', 'Запустить в симуляторе')],
              [<code>run &lt;app&gt;</code>, t('Run on the device', 'Запустить на устройстве')],
              [<code>serve [app]</code>, t('A page with the device screen, buttons and log', 'Страница с экраном устройства, кнопками и логом')],
              [<code>shot / press / open</code>, t('Screenshot, press buttons, open an app', 'Скриншот, нажатия кнопок, открыть приложение')],
              [<code>log [--follow]</code>, t('Device log', 'Лог устройства')],
              [<code>set &lt;app&gt; &lt;key&gt; &lt;value&gt;</code>, t('Write an application KV value; requires Debug firmware. For declared settings on release firmware, use the device page or /api/apps/settings.', 'Записать значение KV приложения; требуется прошивка Debug. Для объявленных настроек в релизной прошивке используйте страницу устройства или /api/apps/settings.')],
              [<code>catalog &lt;folder&gt; --out &lt;dir&gt;</code>, t('Build a catalog', 'Собрать каталог')],
              [<code>publish &lt;folder&gt; --repo owner/repository</code>, t('Publish to your GitHub repository', 'Опубликовать в своём репозитории GitHub')],
              [<code>strings export / import</code>, t('Translations as a spreadsheet', 'Переводы таблицей')],
              [<code>flash [image]</code>, t('Update over Wi-Fi; press OK in recovery to confirm', 'Обновить по Wi-Fi; подтвердить кнопкой OK в recovery')],
              [<code>usb &lt;port&gt;</code>, t('Control a device over USB', 'Управлять устройством по USB')],
            ]}
          />
        </Chapter>

        <Chapter chapter={clion}>
          <Facts
            rows={[
              [t('Runs on', 'Где работает'), t('Device, simulator (macOS, Linux)', 'Устройство, симулятор (macOS, Linux)')],
              [t('Includes', 'Что умеет'), t('Toolchain setup, live device screen, manifest checks, firmware upload', 'Установка тулчейна, живой экран устройства, проверка манифеста, загрузка прошивки')],
              [t('Source', 'Исходники'), <a href={repo.clion}>perinkpheral-clion-plugin</a>],
            ]}
          />
        </Chapter>

        <Chapter chapter={publishing}>
          <p>{t('Publish apps to your own public GitHub repository. Install Git and ', 'Приложения публикуются в вашем публичном репозитории GitHub. Установите Git и ')}<a href="https://cli.github.com/">GitHub CLI</a>{t(', then sign in:', ', затем войдите в аккаунт:')}</p>
          <Code label="shell">{`gh auth login`}</Code>
          <p>{t('Create a repository once. Replace OWNER with your GitHub username:', 'Один раз создайте репозиторий. Вместо OWNER укажите свой логин GitHub:')}</p>
          <Code label="shell">{`gh repo create OWNER/my-perink-apps --public`}</Code>
          <p>{t('Publish the apps from your local apps folder:', 'Опубликуйте приложения из своей локальной папки apps:')}</p>
          <Code label="shell">{`tools/perinkpheral publish apps --repo OWNER/my-perink-apps`}</Code>
          <p>{t('The command builds the apps and updates catalog/ in the repository. Keep all apps you want to publish in the supplied folder: each run replaces the catalog. Files outside catalog/ stay unchanged.', 'Команда собирает приложения и обновляет catalog/ в репозитории. В указанной папке должны быть все приложения для публикации: каждый запуск заменяет каталог целиком. Файлы вне catalog/ сохраняются.')}</p>
          <p>{t('Copy the printed repository link. On the device page, open Catalog → Sources (the gear), add the link and save. Your apps will appear with an Install button.', 'Скопируйте ссылку на репозиторий из вывода команды. На странице устройства откройте Каталог → Источники (шестерёнка), добавьте ссылку и сохраните. Приложения появятся с кнопкой «Установить».')}</p>
          <p>{t('For an update, increase version in manifest.json and run publish again. Refresh the catalog on the device page to see the update.', 'Для обновления увеличьте version в manifest.json и снова выполните publish. Обновите каталог на странице устройства, чтобы увидеть новую версию.')}</p>
        </Chapter>

        <Chapter chapter={reference}>
          <div className="grid">
            <a className="panel" href={repo.firmware}>
              <h3>perinkpheral-os</h3>
              <p className="dim">{t('SDK, tools, firmware.', 'SDK, инструменты, прошивка.')}</p>
            </a>
            <a className="panel" href={repo.apps}>
              <h3>perinkpheral-apps</h3>
              <p className="dim">{t('Official apps and their catalog.', 'Официальные приложения и каталог.')}</p>
            </a>
            <a className="panel" href={repo.clion}>
              <h3>perinkpheral-clion-plugin</h3>
              <p className="dim">{t('CLion plugin.', 'Плагин CLion.')}</p>
            </a>
          </div>
        </Chapter>
      </DocBody>
    </>
  )
}
