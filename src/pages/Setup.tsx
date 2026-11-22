// SPDX-License-Identifier: MIT
import { Chapter, DocBody, PageHead } from '../components/Doc'
import { GuideNav } from '../components/GuideNav'
import { useT } from '../i18n'

export function Setup() {
  const t = useT()
  const wifi = { id: 'wifi', title: t('Connect to Wi-Fi', 'Подключите к Wi-Fi') }
  const apps = { id: 'apps', title: t('Install apps', 'Установите приложения') }
  const ready = { id: 'ready', title: t('Ready to use', 'Устройство готово') }
  return (
    <>
      <PageHead title={t('Set up the device', 'Настройка устройства')}>
        {t('Connect your device to the network and choose what it shows.', 'Подключите устройство к сети и выберите, что оно будет показывать.')}
      </PageHead>
      <DocBody chapters={[wifi, apps, ready]}>
        <Chapter chapter={wifi}>
          <p>{t('If the device is already connected to your home network, skip to ', 'Если устройство уже подключено к домашней сети, переходите к ')}<a href="#device-page">{t('opening its page', 'его веб-странице')}</a>.</p>
          <ol className="steps">
            <li>
              <h3>{t('Join the device’s network', 'Подключитесь к сети устройства')}</h3>
              <p>{t('Scan the QR code on the device with your phone and join its Wi-Fi network.', 'Отсканируйте телефоном QR-код на экране устройства и подключитесь к его Wi-Fi.')}</p>
              <p>{t('If the setup page does not open, visit http://192.168.4.1 while connected to that network.', 'Если страница настройки не открылась, перейдите на http://192.168.4.1, оставаясь в этой сети.')}</p>
            </li>
            <li>
              <h3>{t('Choose your home network', 'Выберите домашнюю сеть')}</h3>
              <p>{t('Open Settings - Network. Click Scan networks and select your 2.4 GHz network, or choose Enter network name to type its SSID. Enter the password and click Connect.', 'Откройте «Настройки - Сеть». Нажмите «Найти сети» и выберите свою сеть 2,4 ГГц либо выберите «Ввести название сети» для ручного ввода SSID. Введите пароль и нажмите «Подключить».')}</p>
              <p>{t('Press OK on the device when it asks for confirmation.', 'Когда устройство попросит подтверждение, нажмите на нём OK.')}</p>
            </li>
            <li>
              <h3 id="device-page">{t('Open the device’s page', 'Откройте страницу устройства')}</h3>
              <p>{t('Reconnect your phone or computer to the same home network. On the device, hold BACK to open the menu, choose About, then press OK to turn to its second page: enter the address shown there in your browser.', 'Верните телефон или компьютер в ту же домашнюю сеть. На устройстве удерживайте BACK, выберите в меню «О системе» и нажмите OK для перехода на вторую страницу: введите указанный там адрес в браузере.')}</p>
              <p>{t('If the .local name does not open, use the IP address.', 'Если имя .local не открывается, используйте IP-адрес.')}</p>
            </li>
          </ol>
          <div className="buttons">
            <a className="button quiet" href="#apps">
              {t('Install apps', 'Установить приложения')} <span className="arrow" aria-hidden="true">-&gt;</span>
            </a>
          </div>
        </Chapter>
        <Chapter chapter={apps}>
          <p>{t('A fresh installation includes Weather, Clock, ISS, Calendar, Timer, Stopwatch, Stocks and Air quality. Configure these under Installed apps. Use Catalog to install additional applications.', 'Чистая установка включает Weather, Clock, ISS, Calendar, Timer, Stopwatch, Stocks и Air quality. Настройте их в разделе «Мои приложения». Дополнительные приложения устанавливаются из каталога.')}</p>
          <ol className="steps">
            <li>
              <h3>{t('Choose an app', 'Выберите приложение')}</h3>
              <p>{t('On the device’s web page, open Catalog, choose an app and click Install. The official catalog is already connected.', 'На веб-странице устройства откройте «Каталог», выберите приложение и нажмите «Установить». Официальный каталог уже подключён.')}</p>
            </li>
            <li>
              <h3>{t('Set it up', 'Настройте приложение')}</h3>
              <p>{t('Open Installed apps and click the gear beside your app. Fill in the settings it needs, such as your city for weather, and save.', 'Откройте «Мои приложения» и нажмите шестерёнку у нужного приложения. Заполните его настройки, например город для погоды, и сохраните.')}</p>
              <p>{t('Apps without settings have no gear.', 'У приложений без настроек шестерёнки нет.')}</p>
            </li>
            <li>
              <h3>{t('Open it on the screen', 'Откройте на экране')}</h3>
              <p>{t('Hold BACK to open the device menu. Select your app with UP and DOWN, then press OK.', 'Удерживайте BACK, чтобы открыть меню устройства. Выберите приложение кнопками UP и DOWN, затем нажмите OK.')}</p>
            </li>
          </ol>
        </Chapter>
        <Chapter chapter={ready}>
          <p>{t('The device is ready: your app is on the screen, and network apps fetch their data over Wi-Fi.', 'Устройство готово: выбранное приложение на экране, а сетевые приложения получают данные по Wi-Fi.')}</p>
          <p>{t('Use the device’s web page whenever you want to change settings or add another app. Future firmware updates are in its Firmware section.', 'Возвращайтесь на веб-страницу устройства, чтобы менять настройки или добавлять приложения. Последующие обновления прошивки находятся в разделе «Прошивка» этой страницы.')}</p>
        </Chapter>
        <GuideNav
          previous={{ to: '/flash', label: 'Flash Firmware' }}
          next={{ to: '/hardware#assemble-case', label: t('Assemble the case', 'Собрать корпус') }}
        />
      </DocBody>
    </>
  )
}
