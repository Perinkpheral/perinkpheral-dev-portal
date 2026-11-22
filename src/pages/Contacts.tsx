import { PageHead, Table } from '../components/Doc'
import { author, repo } from '../content/links'
import { useT } from '../i18n'

export function Contacts() {
  const t = useT()
  return (
    <>
      <PageHead title={t('Contacts', 'Контакты')} />
      <div className="wrap page-body single">
        <div className="doc">
          <div className="contacts">
            <a className="panel" href={repo.firmware}>
              <p className="kind">GitHub</p>
              <p className="value">Perinkpheral/perinkpheral-os</p>
            </a>
            <a className="panel" href={`mailto:${author.email}`}>
              <p className="kind">{t('Email', 'Почта')}</p>
              <p className="value">{author.email}</p>
            </a>
            <a className="panel" href={`https://t.me/${author.telegram}`}>
              <p className="kind">Telegram</p>
              <p className="value">@{author.telegram}</p>
            </a>
          </div>

          <section>
            <h2>{t('Repositories', 'Репозитории')}</h2>
            <Table
              head={[t('Repository', 'Репозиторий'), t('Description', 'Описание')]}
              rows={[
                [<a href={repo.firmware}>perinkpheral-os</a>, t('Firmware, SDK, tools, hardware, application guide', 'Firmware, SDK, инструменты, hardware, руководство разработчика')],
                [<a href={repo.apps}>perinkpheral-apps</a>, t('Official applications and catalog', 'Официальные приложения и каталог')],
                [<a href={repo.clion}>perinkpheral-clion-plugin</a>, t('CLion plugin', 'Плагин CLion')],
                [<a href={repo.homeAssistant}>perinkpheral-hacs</a>, t('Home Assistant integration', 'Интеграция Home Assistant')],
                [<a href={repo.portal}>perinkpheral-dev-portal</a>, t('Developer portal', 'Портал разработчика')],
              ]}
            />
          </section>
        </div>
      </div>
    </>
  )
}
