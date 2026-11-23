// SPDX-License-Identifier: MIT
import { PageHead, Table } from '../components/Doc'
import { GuideNav } from '../components/GuideNav'
import { Download } from '../components/Download'
import { caseFiles } from '../content/links'
import { useT } from '../i18n'

export function PrintCase() {
  const t = useT()
  const download = (url: string, name: string) => (
    <Download href={url} label={`${t('Download', 'Скачать')}: ${name}`}>
      {t('Download', 'Скачать')}
    </Download>
  )
  const parts = [
    [t('Frame and logo', 'Рамка и логотип'), '1', 'PLA/PETG/ABS', caseFiles.frame],
    [t('Back panel', 'Задняя панель'), '1', 'PLA/PETG/ABS', caseFiles.back],
    [t('Base cover', 'Крышка основания'), '1', 'PLA/PETG/ABS', caseFiles.base],
    [t('Bottom', 'Дно'), '1', 'PLA/PETG/ABS', caseFiles.bottom],
    [t('Corner bracket', 'Уголок'), '1', 'PLA/PETG/ABS', caseFiles.bracket],
    [t('Button caps', 'Колпачки кнопок'), '4', 'PLA/PETG/ABS/TPU', caseFiles.caps],
    [t('Feet', 'Ножки'), '6', 'TPU', caseFiles.feet],
  ]

  return (
    <>
      <PageHead eyebrow="Rev 1" title={t('Print the case', 'Печать корпуса')} />
      <div className="wrap page-body single">
        <div className="doc">
          <section>
            <p>
              {t(
                'Download the files and drag them into your slicer. Keep their orientation, choose your usual printer profile and a material from the table, and turn supports off.',
                'Скачайте файлы и перетащите их в слайсер. Сохраните положение деталей, выберите обычный профиль своего принтера и материал из таблицы, отключите поддержки.',
              )}
            </p>
            <p>
              {t(
                'We recommend printing the lettering in a different color.',
                'Рекомендуем печатать надпись другим цветом.',
              )}
            </p>
            <div className="buttons">
              <Download href={caseFiles.archive} quiet={false}>
                {t('Download all', 'Скачать всё')}
              </Download>
            </div>
          </section>

          <section>
            <h2>{t('Print files', 'Файлы для печати')}</h2>
            <Table
              head={[t('Part', 'Деталь'), t('Quantity', 'Количество'), t('Plastic type', 'Тип пластика'), t('File', 'Файл')]}
              rows={parts.map(([name, quantity, plastic_type, url]) => [name, quantity, plastic_type, download(url, name)])}
            />
          </section>

          <section>
            <h2>{t('Source model', 'Исходная модель')}</h2>
            <p>{t('The assembled case in STEP.', 'Корпус в сборе в формате STEP.')}</p>
            <div className="buttons">
              <Download href={caseFiles.step}>
                {t('Download STEP', 'Скачать STEP')}
              </Download>
            </div>
          </section>
          <GuideNav next={{ to: '/hardware#wiring', label: t('Continue assembly', 'Продолжить сборку') }} />
        </div>
      </div>
    </>
  )
}
