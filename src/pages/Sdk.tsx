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

#define MARGIN      HOST_UI_MARGIN

static const char PRESSES_KEY[] = "presses";
#define PRESSES_KEY_LENGTH ((int32_t)sizeof PRESSES_KEY - 1)

static int32_t presses;
static int32_t storage_failed;
static int32_t restore_failed;

static void draw_line(int32_t line, const char *text)
{
    int32_t line_height = gfx_font_height(HOST_FONT_TEXT);
    gfx_draw_text(MARGIN, MARGIN + line * line_height, HOST_FONT_TEXT, text, app_text_length(text));
}

void app_on_load(void)
{
    int32_t loaded = 0;
    int32_t length = kv_get(PRESSES_KEY, PRESSES_KEY_LENGTH, &loaded, sizeof loaded);
    presses = length == (int32_t)sizeof loaded && loaded >= 0 ? loaded : 0;
    storage_failed = length < 0 && length != HOST_ERR_NOT_FOUND;
    restore_failed = storage_failed;
}

void app_on_button(int32_t event)
{
    if (restore_failed) return;
    switch (event) {
    case BTN_UP_PRESSED:
    case BTN_OK_PRESSED:
    case BTN_DOWN_PRESSED:
        if (presses < INT32_MAX) {
            int32_t proposed = presses + 1;
            storage_failed = kv_set(PRESSES_KEY, PRESSES_KEY_LENGTH, &proposed, sizeof proposed) < 0;
            if (!storage_failed) {
                presses = proposed;
            }
        }
        screen_redraw(HOST_REDRAW_NORMAL);
        break;
    }
}

void app_on_draw(void)
{
    if (restore_failed) {
        draw_line(0, "Storage error.");
        return;
    }
    char counter_buffer[32];
    app_text_t counter;
    app_text_start(&counter, counter_buffer, sizeof counter_buffer);
    app_text_add(&counter, "Presses: ");
    app_text_add_number(&counter, presses);

    draw_line(0, "Hello from wasm");
    draw_line(2, counter_buffer);
    if (storage_failed) {
        draw_line(4, "Storage error.");
    }
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
#include "app_state.h"
#include "app_values.h"
#include "host_api.h"

static struct weather_state {
    int32_t version, temperature, code;
} state;
static int32_t restore_failed;

void app_on_load(void)
{
    int32_t status = app_state_load("state", &state, sizeof state, 1);
    restore_failed = status < 0 && status != HOST_ERR_NOT_FOUND;
    if (status != HOST_OK) {
        state = (struct weather_state){ .version = 1 };
    }
    if (restore_failed) {
        log_write(HOST_LOG_ERROR, "State restore failed", 20);
    }
}

void app_on_picked(int32_t poll, int32_t http_status)
{
    if (restore_failed) return;
    /* Values of the "pick" paths, in order. 1 decimal: tenths. */
    struct weather_state proposed = state;
    if (poll == 0 && http_status == 200 &&
        app_value_number(0, 1, &proposed.temperature) &&
        app_value_number(1, 0, &proposed.code)) {
        if (!app_state_save("state", &proposed, sizeof proposed)) {
            log_write(HOST_LOG_ERROR, "State save failed", 17);
            return;
        }
        state = proposed;
        screen_redraw(HOST_REDRAW_NORMAL);
    }
}
`

const LOCALIZED_TEXT = `
#include "app_text.h"
#include "strings.h"

/* Call from app_on_draw(). */
void draw_presses(int32_t presses)
{
    char line[32];
    host_text_argument_t arguments[] = { { .number = presses } };
    int32_t length = app_text_fill(app_string(STR_PRESSES), arguments, 1, line, sizeof line);
    if (length >= 0) {
        ui_draw_text(HOST_UI_MARGIN, 60, HOST_UI_TEXT, line, length, 0);
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
      "pick": ["[0].NowPlayingItem.Name"] },
    { "url": "https://media.example.test/untyped", "manual": true }
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
              ['ABI', t('3 · firmware 0.2.0+', '3 · прошивка 0.2.0+')],
              ['API', <a href={files.hostApi}>sdk/host_api.h</a>],
              [t('Memory', 'Память'), t('Up to 64 KiB of linear memory per app', 'До 64 КиБ линейной памяти на приложение')],
              [t('Numbers', 'Числа'), t('No floating point; decimals as fixed-point numbers', 'Без плавающей точки; дробные - числами с фиксированной точкой')],
              [t('Package', 'Пакет'), t('app.wasm, manifest.json, optional translation tables and packaged files. Pictures from pictures/ are compiled into app.wasm.', 'app.wasm, manifest.json, необязательные таблицы переводов и файлы пакета. Изображения из pictures/ компилируются в app.wasm.')],
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
              <p>{t('Debug firmware is required for run and button control. Screenshots also work with release firmware. Replace the example hostname with the address on the second About page.', 'Для run и управления кнопками нужна прошивка Debug. Снимки экрана доступны и с релизной прошивкой. Замените пример адресом со второй страницы About.')}</p>
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
          <p>{t('The SDK starter validates the restored count and saves each change before display. KV read errors other than HOST_ERR_NOT_FOUND block changes; save errors appear on screen.', 'Стартовый пример SDK проверяет восстановленный счётчик и сохраняет каждое изменение перед отображением. Ошибки чтения KV, кроме HOST_ERR_NOT_FOUND, блокируют изменения; ошибки сохранения выводятся на экран.')}{' '}<a href={files.hello}>{t('SDK starter', 'Стартовый пример SDK')}</a></p>
        </Chapter>

        <Chapter chapter={manifest}>
          <Code label="manifest.json">{MANIFEST}</Code>
          <p>{t('Set author to your name, up to 63 UTF-8 bytes. Perinkpheral is reserved for the official catalog.', 'Укажите своё имя в author: до 63 байт UTF-8. Имя Perinkpheral зарезервировано для официального каталога.')}</p>
          <Table
            head={[t('Key', 'Ключ'), t('Meaning', 'Значение')]}
            rows={[
              [<code>name</code>, t('Unique id: 1-13 ASCII characters, a-z, 0-9, - and _', 'Уникальный id: 1-13 символов, a-z, 0-9, - и _')],
              [<code>title</code>, t('Name in the menu, up to 23 characters', 'Название в меню, до 23 символов')],
              [<code>polls</code>, t('Up to 4 manifest polls in total: automatic or manual', 'До 4 опросов манифеста суммарно: автоматических или ручных')],
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
          <p>{t('ABI 3 is frozen from the 0.2.0 baseline. The builder sets firmware to at least 0.2.0. Baseline features need no HOST_SINCE_ stamps; later additions retain permanent introduction stamps. An explicit minimum is required for later behavior or increased limits that the builder cannot infer.', 'ABI 3 заморожен с базовой версии 0.2.0. Сборщик устанавливает firmware не ниже 0.2.0. Возможности базовой версии не требуют отметок HOST_SINCE_; последующие дополнения получают постоянные отметки версии появления. Для последующего поведения или увеличенных лимитов, которые сборщик не может определить, требуется явный минимум.')}</p>
          <p>{t('Polls default to GET. The method field also accepts POST, PUT, DELETE, PATCH, HEAD, PROPFIND and REPORT. Bodies are limited to 1024 bytes before and after template expansion; GET and HEAD cannot have a body.', 'По умолчанию используется GET. Поле method также принимает POST, PUT, DELETE, PATCH, HEAD, PROPFIND и REPORT. Тело ограничено 1024 байтами до и после подстановки значений; GET и HEAD не допускают тела.')}</p>
          <p>{t('Automatic polls run at startup, on settings changes and periodically. A poll with manual: true starts only through poll_run(), never at startup, on settings changes or periodically. For manual polls, every is optional; a supplied value is validated but unused. A requested round retains transport-failure retries on reconnection; healthy or never-requested manual polls do not start on reconnection. Endpoints that change state must tolerate repeated requests.', 'Автоматические опросы выполняются при запуске, изменении настроек и периодически. Опрос с manual: true запускается только через poll_run(), а не при запуске устройства, изменении настроек или периодически. Для ручного опроса every необязателен; указанное значение проверяется, но не используется. Запрошенный цикл сохраняет повторные попытки после транспортного сбоя при восстановлении сети; ручные опросы без сбоя или без запроса при восстановлении сети не запускаются. Обработчики, изменяющие состояние, должны допускать повторные запросы.')}</p>
          <p>{t('A positive Retry-After from a manifest poll defers all manifest polls of that application, including accepted poll_run() requests, and ends active list rounds. HTTP 429 without a positive delay uses 60 s. Firmware measures this cooldown in uptime; later wall-clock changes do not affect it. Responses to http_send() impose no firmware cooldown. Applications manage direct-request cooldowns using host_answer_info_t.retry_after from answer_info().', 'Положительный Retry-After в ответе на опрос манифеста откладывает все опросы манифеста этого приложения, включая принятые запросы poll_run(), и завершает активные циклы по спискам. Для HTTP 429 без положительной задержки используется 60 с. Прошивка отсчитывает задержку по времени работы устройства; последующие изменения часов на неё не влияют. Ответы на http_send() не задают задержку в прошивке. Приложения управляют задержками прямых запросов через host_answer_info_t.retry_after из answer_info().')}</p>
        </Chapter>

        <Chapter chapter={model}>
          <Table
            head={[t('Function', 'Функция'), t('Called when', 'Когда вызывается')]}
            rows={[
              [<code>app_on_load()</code>, t('The app starts', 'Приложение запускается')],
              [<code>app_on_focus() / app_on_blur()</code>, t('The app appears on screen or leaves it', 'Приложение появляется на экране или уходит с него')],
              [<code>app_on_terminate()</code>, t('Last call before normal unloading; save persistent state here. Not called after a fault or for light sleep.', 'Последний вызов перед штатной выгрузкой; здесь сохраняют постоянное состояние. После сбоя и при лёгком сне не вызывается.')],
              [<code>app_on_button(event)</code>, t('Raw KEYDOWN/KEYUP and interpreted PRESSED/LONG_PRESSED events', 'События KEYDOWN/KEYUP и распознанные PRESSED/LONG_PRESSED')],
              [<code>app_on_back()</code>, t('A short BACK press. Without this handler, Perinkpheral OS closes the app. Long BACK opens the menu; BACK with UP or DOWN switches applications.', 'Короткое нажатие BACK. Без этого обработчика Perinkpheral OS закрывает приложение. Долгое нажатие BACK открывает меню; BACK вместе с UP или DOWN переключает приложения.')],
              [<code>app_on_draw()</code>, t('The screen needs drawing', 'Нужно нарисовать экран')],
              [<code>app_on_timer(id)</code>, t('A timer fired, while the app is on screen', 'Сработал таймер, пока приложение на экране')],
              [<code>app_on_alarm(id)</code>, t('An alarm fired, even if the app is closed', 'Сработал будильник, даже если приложение закрыто')],
              [<code>app_on_picked(poll, status)</code>, t('A manifest poll with nonempty pick returned extracted JSON values or a failure', 'Опрос манифеста с непустым pick вернул извлечённые значения JSON или ошибку')],
              [<code>app_on_data(...)</code>, t('A piece of a response arrived', 'Пришла часть ответа')],
              [<code>app_on_document(...)</code>, t('A structured response completed or failed', 'Структурированный ответ завершён или завершился ошибкой')],
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
          <p>{t('Events encode (button << 4) | action. BTN_OF(event) and BTN_ACTION_OF(event) decode the fields. BTN_KEYDOWN and BTN_KEYUP report physical transitions. BTN_PRESSED occurs on release of a short press; BTN_LONG_PRESSED occurs after 600 ms and has no subsequent short press. Ignore unknown actions. BACK actions reserved by Perinkpheral OS follow the app_on_back() rules above.', 'Событие кодируется как (button << 4) | action. BTN_OF(event) и BTN_ACTION_OF(event) извлекают поля. BTN_KEYDOWN и BTN_KEYUP сообщают о физических переходах. BTN_PRESSED возникает при отпускании после короткого нажатия; BTN_LONG_PRESSED — через 600 мс без последующего короткого нажатия. Неизвестные действия игнорируются. Действия BACK, зарезервированные Perinkpheral OS, следуют правилам app_on_back() выше.')}</p>
          <p>{t('Keep persistent data in KV. app_state_load() returns HOST_OK only for an exact size and version match, HOST_ERR_NOT_FOUND for absent or incompatible state, and other negative codes for failures. On any failure, initialize the whole display state. After a storage failure, do not save or forget that key until a later restore succeeds or establishes absence or incompatibility. Check app_state_save(): it returns false on failure, which may already have changed storage.', 'Постоянные данные хранятся в KV. app_state_load() возвращает HOST_OK только при точном совпадении размера и версии, HOST_ERR_NOT_FOUND при отсутствии или несовместимости состояния и другие отрицательные коды при ошибках. При любой ошибке состояние для отображения инициализируется целиком. После ошибки хранилища нельзя сохранять или удалять этот ключ, пока последующее восстановление не завершится успешно или не установит отсутствие либо несовместимость. Результат app_state_save() проверяется: false означает ошибку, которая могла уже изменить хранилище.')}</p>
          <p>{t('Save temporary navigation and unfinished edits with session_set() in app_on_blur() and restore them with session_get() in app_on_focus(). Sessions survive unloads while the app remains in the stack; leaving the stack or restarting the device clears them. Sessions hold up to 1024 bytes.', 'Временное состояние навигации и незавершённые изменения сохраняйте через session_set() в app_on_blur() и восстанавливайте через session_get() в app_on_focus(). Сессии сохраняются при выгрузке, пока приложение остаётся в стеке; выход из стека или перезапуск устройства удаляет их. Сессия вмещает до 1024 байт.')}</p>
          <h3>{t('Time', 'Время')}</h3>
          <p>{t('Explicit conversions time_local_at(), time_text() and time_from_local() accept HOST_TIME_MIN..HOST_TIME_MAX: 1970-01-01 through 2100-01-01 inclusive, UTC. Zero denotes the Unix epoch. Current-clock validity and alarm_set_at() use HOST_CLOCK_MIN..HOST_CLOCK_MAX: 2026-01-01 through 2100-01-01 inclusive, UTC. time_now() returns zero when the current clock is unknown.', 'Явные преобразования time_local_at(), time_text() и time_from_local() принимают HOST_TIME_MIN..HOST_TIME_MAX: от 1970-01-01 до 2100-01-01 включительно, UTC. Ноль обозначает начало эпохи Unix. Проверка текущих часов и alarm_set_at() используют HOST_CLOCK_MIN..HOST_CLOCK_MAX: от 2026-01-01 до 2100-01-01 включительно, UTC. time_now() возвращает ноль, если текущее время неизвестно.')}</p>
        </Chapter>

        <Chapter chapter={data}>
          <Facts
            rows={[
              [t('Automatic', 'Автоматически'), t('Manifest polls with an every interval', 'Опросы манифеста с интервалом every')],
              [t('On demand', 'По запросу'), t('poll_run() for a manifest poll, including manual polls; http_send() for direct requests', 'poll_run() для опроса манифеста, включая ручные; http_send() для прямых запросов')],
              [t('Ready values', 'Готовые значения'), t('For JSON responses, pick delivers extracted values to app_on_picked()', 'Для ответа JSON поле pick передаёт извлечённые значения в app_on_picked()')],
              [t('Raw response', 'Ответ как есть'), t('app_on_data() gets the bytes piece by piece', 'app_on_data() получает байты ответа частями')],
              [t('Show on screen', 'Показать на экране'), t('screen_request() requests foreground display from a background handler. Refused within 30 seconds of a button press or a previous grant, or while a confirmation question is open. Refused requests are not retried.', 'screen_request() запрашивает вывод приложения из фонового обработчика. Запрос отклоняется в течение 30 секунд после нажатия кнопки или предыдущего разрешения, а также при открытом вопросе подтверждения. Отклонённые запросы не повторяются.')],
            ]}
          />
          <Code label="weather.c">{VALUES}</Code>
          <p>{t('Nonempty pick selects JSON extraction regardless of Content-Type; explicit raw or xml cannot accompany it. The complete body must be valid JSON, even if a requested field was found earlier. An invalid picked 2xx body gives HOST_FAILED_NO_ANSWER. Non-2xx statuses are preserved; invalid bodies supply no values. Applications must validate the expected schema and scalar types.', 'Непустой pick выбирает извлечение JSON независимо от Content-Type; явные raw или xml с ним несовместимы. Всё тело должно быть корректным JSON, даже если запрошенное поле найдено раньше. Некорректное тело с pick при статусе 2xx даёт HOST_FAILED_NO_ANSWER. Статусы вне 2xx сохраняются; некорректные тела не предоставляют значений. Приложения должны проверять ожидаемую схему и типы скалярных значений.')}</p>
          <p>{t('For streamed responses, only HOST_DATA_LAST establishes completion. HOST_DATA_FAILED invalidates all preceding pieces. Delivery can stop without either flag if the receiving instance is interrupted or settings stop the stream. Discard partial data; the next HOST_DATA_FIRST starts a new response. Piece data is valid only until app_on_data() returns.', 'Для потоковых ответов только HOST_DATA_LAST подтверждает завершение. HOST_DATA_FAILED делает все предыдущие фрагменты недействительными. Доставка может прекратиться без обоих флагов при прерывании получающего экземпляра или остановке потока изменением настроек. Частичные данные отбрасываются; следующий HOST_DATA_FIRST начинает новый ответ. Данные фрагмента действительны только до возврата из app_on_data().')}</p>
          <h3>{t('Direct requests', 'Прямые запросы')}</h3>
          <p>{t('http_send() accepts tags HOST_REQUEST_FIRST..HOST_REQUEST_LAST, currently 16..INT32_MAX. Other values are rejected. Keep a changing tag within these bounds and test before incrementing to avoid signed overflow. Do not reuse a tag while an older answer with that tag can still arrive.', 'http_send() принимает метки HOST_REQUEST_FIRST..HOST_REQUEST_LAST, сейчас 16..INT32_MAX. Другие значения отклоняются. Изменяемая метка должна оставаться в этих пределах; граница проверяется до увеличения, чтобы избежать переполнения знакового числа. Нельзя повторно использовать метку, пока ещё может прийти старый ответ с ней.')}</p>
          <Code label="C">{`/* tag is already in HOST_REQUEST_FIRST..HOST_REQUEST_LAST. */
tag = tag < HOST_REQUEST_LAST ? tag + 1 : HOST_REQUEST_FIRST;`}</Code>
          <h3>{t('Response formats', 'Форматы ответов')}</h3>
          <p>{t('Set format to json, xml or raw in an ABI 3 manifest. A poll can override the application default. Requests from code use the application default.', 'В манифесте ABI 3 поле format принимает json, xml или raw. Формат опроса имеет приоритет над форматом приложения. Запросы из кода используют формат приложения.')}</p>
          <p>{t('Without nonempty pick, explicit json or xml overrides Content-Type. With neither nonempty pick nor a format declaration, the response MIME type selects JSON or XML, including +json and +xml subtypes. Unknown or missing MIME types reach app_on_data() unchanged, as do responses explicitly marked raw.', 'Без непустого pick явные json и xml переопределяют Content-Type. Если нет ни непустого pick, ни поля format, JSON или XML выбирается по MIME-типу ответа, включая подтипы +json и +xml. При неизвестном или отсутствующем MIME-типе байты передаются в app_on_data() без изменений, как и при явном raw.')}</p>
          <p>{t('Register application-owned storage of 1 to 12,288 bytes with document_buffer_set() in app_on_load() to receive a validated JSON body or a document in the supported XML subset through app_on_document(). Keep the storage valid until successful replacement or unload; register it again after reload. Temporary stack storage is unsuitable. Leave the buffer untouched while receiving.', 'Для получения проверенного тела JSON или документа поддерживаемого подмножества XML через app_on_document() в app_on_load() регистрируется буфер приложения размером от 1 до 12 288 байт через document_buffer_set(). Память должна оставаться действительной до успешной замены буфера или выгрузки; после повторной загрузки регистрация выполняется заново. Временный буфер в стеке непригоден. Во время приёма буфер не изменяется.')}</p>
          <p>{t('For http_send() and polls without nonempty pick, export app_on_data() if format is raw or omitted. An explicit json or xml allows app_on_document() alone. With both handlers, chunks reach app_on_data() before the document result. Without a raw consumer, document errors and non-2xx responses can complete early with zero bytes and the remaining body is not read. Nonempty pick uses app_on_picked() exclusively. An interrupted instance receives no later completion.', 'Для http_send() и опросов без непустого pick требуется экспорт app_on_data(), если указан raw или формат не задан. При явном json или xml достаточно app_on_document(). При наличии обоих обработчиков фрагменты поступают в app_on_data() до результата документа. Без получателя фрагментов ошибки документа и ответы вне 2xx могут завершаться досрочно с нулевой длиной, без чтения остатка тела. Непустой pick использует только app_on_picked(). Прерванный экземпляр не получает последующего завершения.')}</p>
          <p>{t('Structured XML supports one root, at most 12,288 bytes, 256 elements, 16 levels and 64 attributes per element. Text nodes, BOMs, comments, DTDs and numeric character references are unsupported. xml_child(), xml_attr() and xml_attrs() query this attribute-only subset; document delivery uses the same validator.', 'Структурированный XML поддерживает один корень, до 12 288 байт, 256 элементов, 16 уровней и 64 атрибутов на элемент. Текстовые узлы, BOM, комментарии, DTD и числовые ссылки на символы не поддерживаются. xml_child(), xml_attr() и xml_attrs() работают с этим подмножеством, содержащим только атрибуты; доставка документа использует тот же валидатор.')}{' '}<a href={files.xmlApi}>{t('XML contract', 'Контракт XML')}</a></p>
          <Code label="manifest.json">{POLL_FORMATS}</Code>
          <p>{t('The example has three automatic polls and one manual poll. Poll 1 sends a read-only XML query by POST; poll 2 selects JSON through pick regardless of MIME type. Poll 3 starts through poll_run(3); an unknown response MIME type is delivered as bytes.', 'В примере три автоматических опроса и один ручной. Опрос 1 отправляет запрос на чтение XML через POST; опрос 2 выбирает JSON через pick независимо от MIME-типа. Опрос 3 запускается через poll_run(3); неизвестный MIME-тип ответа передаётся байтами.')}{' '}<a href={files.pollFormats}>{t('Response-format example and tests', 'Пример форматов ответов и тесты')}</a></p>

        </Chapter>

        <Chapter chapter={kit}>
          <Table
            head={[t('Part', 'Часть'), t('Functions', 'Функции')]}
            rows={[
              [t('Text in four styles', 'Текст в четырёх стилях'), t('ui_draw_text, ui_draw_text_lines, ui_draw_title. Multiline input is cut to 512 bytes at UTF-8 boundaries; at most 8 lines.', 'ui_draw_text, ui_draw_text_lines, ui_draw_title. Многострочный текст обрезается до 512 байт по границам UTF-8; не более 8 строк.')],
              [t('List with scroll bar', 'Список с полосой прокрутки'), 'ui_draw_list_row, ui_list_visible'],
              [t('Dialog: text, icon, buttons', 'Диалог: текст, иконка, кнопки'), 'ui_draw_notice'],
              [t('Tile: name, picture, value', 'Плитка: название, картинка, значение'), 'ui_draw_cell, ui_cell_fit'],
              [t('Chart: line, area, bars, steps', 'График: линия, область, столбцы, ступени'), t('ui_draw_chart. HOST_CHART_FIXED_RANGE uses host_chart_t.minimum and maximum, requires minimum < maximum and overrides HOST_CHART_FROM_ZERO.', 'ui_draw_chart. HOST_CHART_FIXED_RANGE использует host_chart_t.minimum и maximum, требует minimum < maximum и имеет приоритет над HOST_CHART_FROM_ZERO.')],
              [t('Value with unit', 'Значение с единицей'), 'ui_draw_value'],
              [t('Choice of a value, date and time', 'Выбор значения, даты и времени'), 'ui_draw_picker, ui_draw_date'],
              [t('Message while there is nothing to show', 'Сообщение, пока показывать нечего'), 'ui_draw_reason'],
            ]}
          />
          <p>{t('Drawing requires app_on_draw(). Text measurement, font metrics and geometry queries work in any handler, including ui_text_width(), ui_text_height(), ui_list_visible(), ui_cell_fit(), gfx_width() and gfx_height().', 'Рисование требует app_on_draw(). Измерение текста, метрики шрифта и геометрические запросы доступны в любом обработчике, включая ui_text_width(), ui_text_height(), ui_list_visible(), ui_cell_fit(), gfx_width() и gfx_height().')}</p>
          <h3>{t('Localized patterns', 'Локализованные шаблоны')}</h3>
          <Code label="strings/en.json">{`{ "presses": "Presses: {0}" }`}</Code>
          <Code label="strings/ru.json">{`{ "presses": "Нажатий: {0}" }`}</Code>
          <Code label="C">{LOCALIZED_TEXT}</Code>
          <p>{t('app_text_fill() passes a NUL-terminated pattern to text_fill(), reserves one byte for the terminator and returns the byte length or the original negative error code. With positive capacity, an error leaves an empty string. Capacity zero returns zero without calling text_fill(); negative capacity returns HOST_ERR_ARGUMENT.', 'app_text_fill() передаёт шаблон с завершающим NUL в text_fill(), резервирует байт под терминатор и возвращает длину в байтах либо исходный отрицательный код ошибки. При положительной ёмкости ошибка оставляет пустую строку. Нулевая ёмкость возвращает ноль без вызова text_fill(); отрицательная возвращает HOST_ERR_ARGUMENT.')}</p>
          <Carousel screens slides={KIT.map((one) => ({ name: one.name, caption: t(one.en, one.ru) }))} />
        </Chapter>

        <Chapter chapter={limits}>
          <Table
            head={[t('What', 'Что'), t('Limit', 'Предел')]}
            rows={[
              [t('Module file', 'Файл модуля'), t('48 KiB', '48 КиБ')],
              [t('Linear memory', 'Линейная память'), t('At most 65,536 bytes for stack and static data, sized to the byte at build time; cannot grow. Builder and runtime reject growable or oversized declarations.', 'Не более 65 536 байт для стека и статических данных; размер задаётся при сборке с точностью до байта и не может расти. Сборщик и среда выполнения отклоняют растущую память и превышение лимита.')],
              [t('Handler execution budget', 'Бюджет выполнения обработчика'), t('3 s, checked cooperatively at yield points and after return; native calls and scheduling can extend elapsed time.', '3 с, проверяется кооперативно в точках передачи управления и после возврата; нативные вызовы и планирование могут увеличить фактическое время.')],
              [t('Saved data', 'Сохранённые данные'), t('2 KiB including settings and storage overhead; at most 1 KiB per value. Each key costs 64 bytes plus its value rounded up to 32 bytes.', '2 КиБ вместе с настройками и накладными расходами; до 1 КиБ на значение. Каждый ключ занимает 64 байта плюс размер значения, округлённый вверх до 32 байт.')],
              [t('Files', 'Файлы'), t('64 KiB for package files, charged in whole 4 KiB blocks per file. Applications that write files share 32 KiB between package and runtime files.', '64 КиБ для файлов пакета; каждый файл учитывается целыми блоками по 4 КиБ. Приложения с записью файлов делят 32 КиБ между файлами пакета и создаваемыми файлами.')],
              [t('Manifest polls', 'Опросы манифеста'), t('4 total, automatic and manual. Manifest validation accepts automatic intervals of 10 s to 1 day. Power saving imposes a 300 s periodic floor; queueing and cooldowns can delay execution.', '4 суммарно, автоматических и ручных. Манифест допускает автоматические интервалы от 10 с до суток. Экономия энергии устанавливает периодический минимум 300 с; очередь и задержки сервера могут откладывать выполнение.')],
              [t('Requests waiting', 'Запросов в очереди'), t('At most 16 waiting per app; all apps share a 16 KiB queue budget. One request runs at a time for the device.', 'До 16 ожидающих запросов на приложение; общая очередь всех приложений ограничена 16 КиБ. Устройство выполняет один запрос за раз.')],
              [t('Response size', 'Размер ответа'), t('256 KiB with JSON pick; 4 MiB streamed; complete-document delivery is limited to the registered buffer, at most 12,288 bytes.', '256 КиБ с JSON pick; 4 МиБ при потоковой передаче; доставка целого документа ограничена зарегистрированным буфером, не более 12 288 байт.')],
              [t('Settings', 'Настройки'), t('8, values up to 255 bytes', '8, значения до 255 байт')],
              [t('Timers and alarms', 'Таймеры и будильники'), t('4 and 4', '4 и 4')],
              [t('Apps on a device', 'Приложений на устройстве'), t('Up to 24, while there is space', 'До 24, пока хватает места')],
            ]}
          />
          <p>{t(
            'The application’s linear memory, interpreter and contract scratch allocations share one 112 KiB area reserved at startup. With 64 KiB of linear memory, 48 KiB remains for the interpreter and contract scratch memory. Their combined peak use must fit this area.',
            'Линейная память приложения, интерпретатор и временные выделения памяти контракта делят одну область размером 112 КиБ, резервируемую при запуске. При 64 КиБ линейной памяти остаётся 48 КиБ для интерпретатора и временной памяти контракта. Их суммарное пиковое использование должно помещаться в эту область.',
          )}</p>
          <p>{t(
            'The build warns when linear memory and estimated interpreter use together exceed the 112 KiB area, regardless of the minimum firmware version. The estimate is advisory and does not measure peak use. Check the build’s memory report and verify interpreter headroom on a device.',
            'Если линейная память и оценка использования памяти интерпретатором вместе превышают область в 112 КиБ, сборка выдаёт предупреждение независимо от минимальной версии прошивки. Оценка носит справочный характер и не измеряет пиковое использование. Проверяйте отчёт сборки о памяти и запас памяти интерпретатора на устройстве.',
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
              [<code>strings export / import</code>, t('Translations as a spreadsheet. app_string() selects localized patterns; app_text_fill() formats them with a terminating NUL.', 'Переводы таблицей. app_string() выбирает локализованные шаблоны; app_text_fill() подставляет значения и добавляет завершающий NUL.')],
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
